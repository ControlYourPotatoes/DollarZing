import { formatCurrency } from '@/mock/prototypeData';

interface BreakdownNode {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface FlowBreakdownChartProps {
  total: number;
  nodes: BreakdownNode[];
}

const FlowBreakdownChart = ({ total, nodes }: FlowBreakdownChartProps) => (
  <div className="relative flex flex-col items-center gap-6 lg:flex-row lg:items-stretch">
    <div className="relative flex h-44 w-44 flex-col items-center justify-center rounded-full border-2 border-sky-400/60 bg-sky-900/20 text-center shadow-[0_0_45px_-15px_rgba(14,165,233,0.45)]">
      <span className="text-xs uppercase tracking-widest text-sky-300">Gross Flow</span>
      <p className="mt-2 text-3xl font-semibold text-slate-100">{formatCurrency(total)}</p>
      <span className="mt-2 text-xs text-slate-400">Daily distribution snapshot</span>
      <div className="absolute -right-6 top-1/2 hidden h-[2px] w-12 -translate-y-1/2 bg-slate-700/80 lg:block" />
    </div>

    <div className="flex w-full flex-wrap items-center justify-center gap-6">
      {nodes.map((node) => (
        <div key={node.id} className="relative flex flex-col items-center">
          <div
            className="flex h-32 w-32 flex-col items-center justify-center rounded-full border-2 bg-slate-900/70 text-center"
            style={{ borderColor: node.color, boxShadow: `0 0 35px -15px ${node.color}` }}
          >
            <span className="text-xs uppercase tracking-widest text-slate-400">{node.label}</span>
            <p className="mt-2 text-xl font-semibold text-slate-100">{formatCurrency(node.value)}</p>
            <span className="mt-1 text-xs text-slate-500">{Math.round((node.value / total) * 100)}%</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default FlowBreakdownChart;
