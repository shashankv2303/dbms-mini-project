// Shared (client + server) description of the interpretable mood axes.
// Dimensions 1-8 of every 128-dim track embedding are these axes, each in [-1, 1].

export const MOOD_AXES = [
  { key: 'energy', label: 'Energy', low: 'Calm', high: 'Intense' },
  { key: 'valence', label: 'Valence', low: 'Sad', high: 'Happy' },
  { key: 'danceability', label: 'Danceability', low: 'Still', high: 'Groovy' },
  { key: 'acousticness', label: 'Acousticness', low: 'Electronic', high: 'Acoustic' },
  { key: 'tempo', label: 'Tempo', low: 'Slow', high: 'Fast' },
  { key: 'instrumentalness', label: 'Instrumental', low: 'Vocal', high: 'Instrumental' },
  { key: 'intensity', label: 'Intensity', low: 'Soft', high: 'Heavy' },
  { key: 'warmth', label: 'Warmth', low: 'Cold', high: 'Warm' },
] as const;

export const EMBEDDING_DIM = 128;

export const MOOD_PRESETS: Record<string, number[]> = {
  'Party':       [0.8, 0.8, 0.9, -0.5, 0.7, -0.4, 0.4, 0.2],
  'Focus':       [-0.5, 0.1, -0.3, 0.3, -0.5, 0.8, -0.6, 0.6],
  'Chill':       [-0.6, 0.3, 0.0, 0.3, -0.5, 0.5, -0.7, 0.8],
  'Workout':     [0.9, 0.3, 0.3, -0.7, 0.9, -0.2, 0.9, -0.3],
  'Melancholy':  [-0.3, -0.6, -0.4, 0.7, -0.4, 0.3, -0.2, 0.3],
  'Sunny':       [0.1, 0.9, 0.6, 0.4, -0.1, -0.5, -0.2, 0.8],
};
