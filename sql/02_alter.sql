-- =====================================================================
-- SoundTrail  |  02_alter.sql  |  ALTER TABLE / DROP demonstrations
-- Idempotent. Run after 01_schema.sql.
-- =====================================================================

-- 1. Schema evolution: add the denormalised play counter to TRACK.
--    (maintained by trigger trg_listen_increment_play_count in 04_procedures.sql)
ALTER TABLE track
    ADD COLUMN IF NOT EXISTS play_count INTEGER NOT NULL DEFAULT 0;

-- 2. Add a CHECK constraint after table creation (guarded for re-runs).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_track_play_count') THEN
        ALTER TABLE track
            ADD CONSTRAINT chk_track_play_count CHECK (play_count >= 0);
    END IF;
END $$;

-- 3. Index supporting the "top tracks" ordering.
CREATE INDEX IF NOT EXISTS idx_track_play_count ON track(play_count DESC);

-- 4. ALTER ... ADD / RENAME / DROP COLUMN round trip on a scratch column.
ALTER TABLE playlist ADD COLUMN IF NOT EXISTS cover_url VARCHAR(255);
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'playlist' AND column_name = 'cover_url') THEN
        ALTER TABLE playlist RENAME COLUMN cover_url TO cover_image_url;
    END IF;
END $$;
ALTER TABLE playlist DROP COLUMN IF EXISTS cover_image_url;

-- 5. DROP demonstration: create and drop a throw-away table and index.
CREATE TABLE IF NOT EXISTS scratch_migration_demo (
    id   SERIAL PRIMARY KEY,
    note TEXT
);
CREATE INDEX IF NOT EXISTS idx_scratch_note ON scratch_migration_demo(note);
DROP INDEX IF EXISTS idx_scratch_note;
DROP TABLE IF EXISTS scratch_migration_demo;
