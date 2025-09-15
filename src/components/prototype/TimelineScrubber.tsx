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

const TimelineScrubber = ({ data, activeIndex, onChange }: TimelineScrubberProps) => (
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

    <input
      className="mt-4 w-full appearance-none rounded-full bg-slate-800 accent-sky-400"
      type="range"
      min={0}
      max={data.length - 1}
      step={1}
      value={activeIndex}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  </div>
);

export default TimelineScrubber;
