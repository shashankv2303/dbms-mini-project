'use client';

export function Stars({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="muted">—</span>;
  const full = Math.round(value);
  return <span className="stars" title={String(value)}>{'★'.repeat(full)}{'☆'.repeat(5 - full)} <span className="muted small">{Number(value).toFixed(1)}</span></span>;
}

export function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className={`star-btn${n <= value ? ' on' : ''}`} onClick={() => onChange(n)} aria-label={`${n} stars`}>★</button>
      ))}
    </span>
  );
}
