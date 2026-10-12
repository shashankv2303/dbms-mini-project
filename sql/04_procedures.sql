-- =====================================================================
-- SoundTrail  |  04_procedures.sql  |  Triggers, functions, procedures
-- Idempotent (CREATE OR REPLACE / DROP TRIGGER IF EXISTS). Run after 03_seed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- TRIGGER 1: keep track.play_count in sync with listen_history
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_listen_play_count() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE track SET play_count = play_count + 1 WHERE track_id = NEW.track_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE track SET play_count = GREATEST(play_count - 1, 0) WHERE track_id = OLD.track_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_listen_play_count ON listen_history;
CREATE TRIGGER trg_listen_play_count
AFTER INSERT OR DELETE ON listen_history
FOR EACH ROW EXECUTE FUNCTION fn_listen_play_count();

-- ---------------------------------------------------------------------
-- TRIGGER 2: playlist ordering. BEFORE INSERT fills a missing position
-- with max+1; AFTER DELETE closes the gap left by a removed track.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_playlist_track_before_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.position IS NULL THEN
        SELECT COALESCE(MAX(position), 0) + 1 INTO NEW.position
        FROM playlist_track WHERE playlist_id = NEW.playlist_id;
    END IF;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION fn_playlist_track_after_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE playlist_track
    SET position = position - 1
    WHERE playlist_id = OLD.playlist_id AND position > OLD.position;
    RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_playlist_track_pos_ins ON playlist_track;
CREATE TRIGGER trg_playlist_track_pos_ins
BEFORE INSERT ON playlist_track
FOR EACH ROW EXECUTE FUNCTION fn_playlist_track_before_insert();

DROP TRIGGER IF EXISTS trg_playlist_track_pos_del ON playlist_track;
CREATE TRIGGER trg_playlist_track_pos_del
AFTER DELETE ON playlist_track
FOR EACH ROW EXECUTE FUNCTION fn_playlist_track_after_delete();

-- ---------------------------------------------------------------------
-- TRIGGER 3: cold-start embedding. A newly inserted track gets the centroid
-- of its genre's existing vectors until a real embedding is supplied.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_track_default_embedding() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_centroid vector(128);
BEGIN
    IF NEW.genre_id IS NOT NULL THEN
        SELECT AVG(te.embedding) INTO v_centroid
        FROM track_embedding te
        JOIN track t ON t.track_id = te.track_id
        WHERE t.genre_id = NEW.genre_id;

        IF v_centroid IS NOT NULL THEN
            INSERT INTO track_embedding (track_id, embedding, model_version)
            VALUES (NEW.track_id, v_centroid, 'genre-centroid-v1')
            ON CONFLICT (track_id) DO NOTHING;
        END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_track_default_embedding ON track;
CREATE TRIGGER trg_track_default_embedding
AFTER INSERT ON track
FOR EACH ROW EXECUTE FUNCTION fn_track_default_embedding();

-- ---------------------------------------------------------------------
-- FUNCTION: nearest tracks to an arbitrary vector (cosine distance).
-- Backbone for similar_tracks(), mood sliders and get_recommendations().
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION tracks_near_vector(p_vec vector, p_limit INT DEFAULT 10, p_exclude INT[] DEFAULT '{}')
RETURNS TABLE (track_id INT, title VARCHAR, artist VARCHAR, genre VARCHAR, distance DOUBLE PRECISION)
LANGUAGE sql STABLE AS $$
    SELECT t.track_id, t.title, a.name, g.name,
           (te.embedding <=> p_vec)::double precision AS distance
    FROM track_embedding te
    JOIN track t   ON t.track_id  = te.track_id
    JOIN album al  ON al.album_id = t.album_id
    JOIN artist a  ON a.artist_id = al.artist_id
    LEFT JOIN genre g ON g.genre_id = t.genre_id
    WHERE NOT (t.track_id = ANY (p_exclude))
    ORDER BY te.embedding <=> p_vec
    LIMIT p_limit;
$$;

-- ---------------------------------------------------------------------
-- FUNCTION: "tracks that feel like this one"
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION similar_tracks(p_track_id INT, p_limit INT DEFAULT 10)
RETURNS TABLE (track_id INT, title VARCHAR, artist VARCHAR, genre VARCHAR, distance DOUBLE PRECISION)
LANGUAGE sql STABLE AS $$
    SELECT n.*
    FROM track_embedding ref
    CROSS JOIN LATERAL tracks_near_vector(ref.embedding, p_limit, ARRAY[p_track_id]) n
    WHERE ref.track_id = p_track_id;
$$;

-- ---------------------------------------------------------------------
-- FUNCTION: personalised recommendations.
-- Taste vector = centroid of the embeddings of tracks the user rated >= 4
-- or has listened to. Returns the nearest tracks they have not heard yet.
-- Cold start (no signal): fall back to globally most-played tracks.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_recommendations(p_user_id INT, p_limit INT DEFAULT 10)
RETURNS TABLE (track_id INT, title VARCHAR, artist VARCHAR, genre VARCHAR, distance DOUBLE PRECISION)
LANGUAGE plpgsql STABLE AS $$
#variable_conflict use_column
DECLARE
    v_taste vector(128);
    v_seen  INT[];
BEGIN
    SELECT COALESCE(ARRAY_AGG(DISTINCT s.track_id), '{}') INTO v_seen
    FROM (
        SELECT lh.track_id FROM listen_history lh WHERE lh.user_id = p_user_id
        UNION
        SELECT r.track_id  FROM rating r WHERE r.user_id = p_user_id
    ) s;

    SELECT AVG(te.embedding) INTO v_taste
    FROM track_embedding te
    WHERE te.track_id IN (
        SELECT r.track_id  FROM rating r WHERE r.user_id = p_user_id AND r.rating >= 4
        UNION
        SELECT lh.track_id FROM listen_history lh WHERE lh.user_id = p_user_id
    );

    IF v_taste IS NULL THEN
        RETURN QUERY
        SELECT t.track_id, t.title, a.name, g.name, NULL::double precision
        FROM track t
        JOIN album al ON al.album_id = t.album_id
        JOIN artist a ON a.artist_id = al.artist_id
        LEFT JOIN genre g ON g.genre_id = t.genre_id
        ORDER BY t.play_count DESC, t.track_id
        LIMIT p_limit;
    ELSE
        RETURN QUERY SELECT * FROM tracks_near_vector(v_taste, p_limit, v_seen);
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- FUNCTION: full-text search over track title and artist name (tsvector).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_tracks(p_query TEXT, p_limit INT DEFAULT 25)
RETURNS TABLE (track_id INT, title VARCHAR, artist VARCHAR, genre VARCHAR, rank REAL)
LANGUAGE sql STABLE AS $$
    -- OR semantics across terms (title and artist are matched independently);
    -- ts_rank then floats rows matching more terms to the top.
    WITH q AS (SELECT replace(plainto_tsquery('english', p_query)::text, '&', '|')::tsquery AS tsq)
    SELECT t.track_id, t.title, a.name, g.name,
           (2 * ts_rank(to_tsvector('english', t.title), q.tsq)
              + ts_rank(to_tsvector('english', a.name),  q.tsq))::real AS rank
    FROM q, track t
    JOIN album al ON al.album_id = t.album_id
    JOIN artist a ON a.artist_id = al.artist_id
    LEFT JOIN genre g ON g.genre_id = t.genre_id
    WHERE to_tsvector('english', t.title) @@ q.tsq
       OR to_tsvector('english', a.name)  @@ q.tsq
    ORDER BY rank DESC, t.play_count DESC
    LIMIT p_limit;
$$;

-- ---------------------------------------------------------------------
-- FUNCTION: transactional playlist append with ownership check.
-- Locks the playlist row so concurrent adds cannot pick the same position.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_track_to_playlist(p_playlist_id INT, p_track_id INT, p_user_id INT)
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
    v_owner INT;
    v_pos   INT;
BEGIN
    SELECT user_id INTO v_owner FROM playlist WHERE playlist_id = p_playlist_id FOR UPDATE;
    IF v_owner IS NULL THEN
        RAISE EXCEPTION 'playlist % not found', p_playlist_id USING ERRCODE = 'P0002';
    END IF;
    IF v_owner <> p_user_id THEN
        RAISE EXCEPTION 'user % does not own playlist %', p_user_id, p_playlist_id USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(MAX(position), 0) + 1 INTO v_pos FROM playlist_track WHERE playlist_id = p_playlist_id;
    INSERT INTO playlist_track (playlist_id, track_id, position) VALUES (p_playlist_id, p_track_id, v_pos);
    RETURN v_pos;
END $$;

-- ---------------------------------------------------------------------
-- PROCEDURE: maintenance - recompute denormalised counters from history.
-- Use: CALL recalc_play_counts();
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE recalc_play_counts()
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE track t
    SET play_count = (SELECT COUNT(*) FROM listen_history lh WHERE lh.track_id = t.track_id);
END $$;
