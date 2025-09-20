import { Fragment } from 'react';
import { levelLabels } from '@/mock/prototypeData';

interface HeatmapGridProps {
  labels: string[];
  values: number[][]; // rows => levels, cols => timeline points
  activeIndex: number;
}

const colorStops = [
  { threshold: 0, background: 'rgba(15,23,42,0.55)', color: '#94a3b8' },
  { threshold: 20, background: 'rgba(14,165,233,0.18)', color: '#0ea5e9' },
  { threshold: 40, background: 'rgba(14,165,233,0.28)', color: '#0ea5e9' },
  { threshold: 60, background: 'rgba(45,212,191,0.28)', color: '#14b8a6' },
  { threshold: 80, background: 'rgba(34,197,94,0.32)', color: '#22c55e' },
];

const getCellStyle = (value: number) => {
  const match = [...colorStops].reverse().find((stop) => value >= stop.threshold);
  return match ?? colorStops[0];
};

const HeatmapGrid = ({ labels, values, activeIndex }: HeatmapGridProps) => {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-sky-900/10">
      <div
        className="grid"
        style={{ gridTemplateColumns: `140px repeat(${labels.length}, minmax(0, 1fr))` }}
      >
        <div className="sticky left-0 z-10 border-b border-slate-800 bg-slate-900/95 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Levels
        </div>
        {labels.map((label, columnIndex) => (
          <div
            key={label}
            className={`border-b border-slate-800 px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest transition ${
              columnIndex === activeIndex ? 'bg-slate-800 text-sky-300' : 'bg-slate-900 text-slate-500'
            }`}
          >
            {label}
          </div>
        ))}
        {values.map((row, rowIndex) => (
          <Fragment key={`row-${rowIndex}`}>
            <div
              key={`label-${levelLabels[rowIndex]}`}
              className="sticky left-0 z-10 border-b border-slate-800 px-4 py-3 text-sm font-medium text-slate-100"
            >
              {levelLabels[rowIndex]}
            </div>
            {row.map((value, columnIndex) => {
              const styles = getCellStyle(value);
              const isActive = columnIndex === activeIndex;
              return (
                <div
                  key={`${rowIndex}-${columnIndex}`}
                  className={`flex items-center justify-center border-b border-slate-800 px-3 py-3 text-sm font-semibold tabular-nums transition ${
                    isActive ? 'ring-2 ring-sky-400/60 ring-offset-0' : ''
                  }`}
                  style={{ background: styles.background, color: styles.color }}
                >
                  {value.toFixed(0)}%
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
};

export default HeatmapGrid;
