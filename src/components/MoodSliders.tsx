'use client';
import { MOOD_AXES, MOOD_PRESETS } from '@/lib/mood';

export default function MoodSliders({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="stack">
      <div className="row">
        <span className="muted small">Presets:</span>
        {Object.entries(MOOD_PRESETS).map(([name, v]) => (
          <button key={name} type="button" className="small" onClick={() => onChange(v)}>{name}</button>
        ))}
      </div>
      <div className="mood-grid">
        {MOOD_AXES.map((axis, i) => (
          <div key={axis.key} className="mood-axis">
            <label className="small" htmlFor={`mood-${axis.key}`}>{axis.label}</label>
            <input id={`mood-${axis.key}`} type="range" min={-1} max={1} step={0.1} value={value[i]}
              onChange={(e) => onChange(value.map((x, j) => (j === i ? Number(e.target.value) : x)))} />
            <div className="ends"><span>{axis.low}</span><span>{axis.high}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
