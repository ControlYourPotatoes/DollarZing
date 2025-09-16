import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { formatCurrency } from '@/mock/prototypeData';

interface TimelinePoint {
  id: string;
  label: string;
  netPayouts: number;
  totalCharity: number;
  totalFees: number;
}

interface TimelineScrubberProps {
  data: TimelinePoint[];
  activeIndex: number;
  onChange: (index: number) => void;
}

const TimelineScrubber = ({ data, activeIndex, onChange }: TimelineScrubberProps) => {
  const progress = data.length > 1 ? (activeIndex / (data.length - 1)) * 100 : 0;
  const sliderBackground = `linear-gradient(90deg, rgba(14,165,233,0.7) 0%, rgba(14,165,233,0.7) ${progress}%, rgba(71,85,105,0.45) ${progress}%, rgba(51,65,85,0.45) 100%)`;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-sky-900/10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Timeline</p>
          <h2 className="text-xl font-semibold text-slate-100">Parameter Interpolation Preview</h2>
          <p className="text-sm text-slate-400">Scrub through the mocked anchor snapshots to see how distribution metrics morph.</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
          {data[activeIndex]?.label}
        </div>
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" stroke="#64748b" tickLine={false} />
            <YAxis stroke="#64748b" tickLine={false} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: 'rgba(15,23,42,0.92)', borderRadius: '0.75rem', border: '1px solid rgba(148,163,184,0.4)', color: '#e2e8f0' }}
              formatter={(value: number, key: string) => {
                if (key === 'netPayouts') return [formatCurrency(value), 'Player Payouts'];
                if (key === 'totalCharity') return [formatCurrency(value), 'Charity'];
                if (key === 'totalFees') return [formatCurrency(value), 'Fees'];
                return [value, key];
              }}
            />
            <ReferenceLine x={data[activeIndex]?.label} stroke="#f97316" strokeDasharray="6 6" />
            <Area type="monotone" dataKey="netPayouts" stroke="#34d399" fillOpacity={0.3} fill="#34d399" />
            <Area type="monotone" dataKey="totalCharity" stroke="#a855f7" fillOpacity={0.15} fill="#a855f7" />
            <Area type="monotone" dataKey="totalFees" stroke="#38bdf8" fillOpacity={0.2} fill="#38bdf8" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {data.map((point, index) => (
            <button
              key={point.id}
              type="button"
              onClick={() => onChange(index)}
              className={`rounded-full px-3 py-1 text-xs font-semibold tracking-widest transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                index === activeIndex
                  ? 'bg-sky-500 text-slate-950 focus-visible:outline-sky-300'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 focus-visible:outline-slate-600'
              }`}
            >
              {point.label}
            </button>
          ))}
        </div>
        <span className="text-xs uppercase tracking-widest text-slate-500">
          {activeIndex + 1} / {data.length}
        </span>
      </div>

      <div className="mt-4">
        <input
          className="h-2 w-full cursor-pointer appearance-none rounded-full border border-slate-800 accent-sky-400"
          type="range"
          min={0}
          max={data.length - 1}
          step={1}
          value={activeIndex}
          onChange={(event) => onChange(Number(event.target.value))}
          style={{ background: sliderBackground }}
        />
        <div className="mt-3 flex items-start justify-between gap-2 text-[10px] uppercase tracking-widest text-slate-500">
          {data.map((point, index) => (
            <div key={`tick-${point.id}`} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={`h-3 w-[2px] rounded-full ${
                  index <= activeIndex ? 'bg-sky-400' : 'bg-slate-700'
                }`}
              />
              <span className={`${index === activeIndex ? 'text-sky-300' : ''}`}>{point.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TimelineScrubber;
