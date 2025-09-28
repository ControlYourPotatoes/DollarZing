import { useMemo } from "react";
import { useActiveTimelineDay } from "@/features/timeline";

interface BreakdownNode {
  id: string;
  label: string;
  value: number;
  color: string;
}

export function FlowBreakdownChart() {
  const activeDay = useActiveTimelineDay();

  const flowData = useMemo(() => {
    if (!activeDay) return null;

    const total =
      activeDay.summary.dailyFees +
      activeDay.summary.dailyCharity +
      activeDay.summary.dailyPayouts;

    const nodes: BreakdownNode[] = [
      {
        id: "fees",
        label: "Platform Fees",
        value: activeDay.summary.dailyFees,
        color: "#f59e0b", // amber-500
      },
      {
        id: "charity",
        label: "Charity",
        value: activeDay.summary.dailyCharity,
        color: "#10b981", // emerald-500
      },
      {
        id: "payouts",
        label: "Player Payouts",
        value: activeDay.summary.dailyPayouts,
        color: "#8b5cf6", // violet-500
      },
    ];

    return { total, nodes };
  }, [activeDay]);

  if (!flowData) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <p>No flow data available</p>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="relative flex flex-col items-center gap-6 lg:flex-row lg:items-stretch">
      {/* Central Gross Flow Circle */}
      <div className="relative flex h-44 w-44 flex-col items-center justify-center rounded-full border-2 border-sky-400/60 bg-sky-900/20 text-center shadow-[0_0_45px_-15px_rgba(14,165,233,0.45)]">
        <span className="text-xs uppercase tracking-widest text-sky-300">
          Daily Flow
        </span>
        <p className="mt-2 text-3xl font-semibold text-slate-100">
          {formatCurrency(flowData.total)}
        </p>
        <span className="mt-2 text-xs text-slate-400">Total distribution</span>
        <div className="absolute -right-6 top-1/2 hidden h-[2px] w-12 -translate-y-1/2 bg-slate-700/80 lg:block" />
      </div>

      {/* Breakdown Nodes */}
      <div className="flex w-full flex-wrap items-center justify-center gap-6">
        {flowData.nodes.map((node) => (
          <div key={node.id} className="relative flex flex-col items-center">
            <div
              className="flex h-32 w-32 flex-col items-center justify-center rounded-full border-2 bg-slate-900/70 text-center"
              style={{
                borderColor: node.color,
                boxShadow: `0 0 35px -15px ${node.color}`,
              }}
            >
              <span className="text-xs uppercase tracking-widest text-slate-400">
                {node.label}
              </span>
              <p className="mt-2 text-xl font-semibold text-slate-100">
                {formatCurrency(node.value)}
              </p>
              <span className="mt-1 text-xs text-slate-500">
                {Math.round((node.value / flowData.total) * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
