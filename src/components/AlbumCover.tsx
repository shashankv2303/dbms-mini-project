'use client';
import { useId } from 'react';

// Deterministic generated cover art: no image column needed, so the schema stays unchanged.
// The same album always gets the same colours.
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function initials(title: string): string {
  const words = title.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : title.slice(0, 2)).toUpperCase();
}

export default function AlbumCover({ albumId, title, size = 96 }: { albumId: number; title: string; size?: number }) {
  const uid = useId().replace(/:/g, '');
  const h = hash(`${albumId}:${title}`);
  const hue1 = h % 360;
  const hue2 = (hue1 + 40 + ((h >> 9) % 120)) % 360;
  const angle = (h >> 4) % 360;
  const shape = (h >> 12) % 3;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Album cover for ${title}`}
      style={{ borderRadius: 10, flexShrink: 0, boxShadow: '0 4px 14px rgba(0,0,0,.45)' }}
    >
      <defs>
        <linearGradient id={`g${uid}`} gradientTransform={`rotate(${angle} .5 .5)`}>
          <stop offset="0" stopColor={`hsl(${hue1} 70% 48%)`} />
          <stop offset="1" stopColor={`hsl(${hue2} 75% 30%)`} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#g${uid})`} />
      {shape === 0 && <circle cx="72" cy="28" r="34" fill="rgba(255,255,255,.12)" />}
      {shape === 1 && <rect x="-10" y="55" width="130" height="30" fill="rgba(255,255,255,.12)" transform="rotate(-18 50 70)" />}
      {shape === 2 && <path d="M0 100 L100 30 L100 100 Z" fill="rgba(255,255,255,.12)" />}
      {/* vinyl record peeking out */}
      <circle cx="50" cy="50" r="30" fill="rgba(0,0,0,.55)" />
      <circle cx="50" cy="50" r="22" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="1" />
      <circle cx="50" cy="50" r="14" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="1" />
      <circle cx="50" cy="50" r="9" fill={`hsl(${hue1} 70% 55%)`} />
      <text x="50" y="53.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">
        {initials(title)}
      </text>
    </svg>
  );
}
