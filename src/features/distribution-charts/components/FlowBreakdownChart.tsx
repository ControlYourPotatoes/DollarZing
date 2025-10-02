import { useMemo } from "react";
import { useActiveTimelineDay } from "@/features/timeline";

interface BreakdownItem {
  id: string;
  label: string;
  value: number;
  color: string;
}

export function DailyFlow() {
  const activeDay = useActiveTimelineDay();

  const flowData = useMemo(() => {
    if (!activeDay) return null;

    const total =
      activeDay.summary.dailyFees +
      activeDay.summary.dailyCharity +
      activeDay.summary.dailyPayouts;

    const items: BreakdownItem[] = [
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

    return { total, items };
  }, [activeDay]);

  if (!flowData) {
    return (
      <div className="flex h-32 items-center justify-center text-slate-500">
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
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <span className="text-sm uppercase tracking-widest text-sky-300">
          Daily Flow
        </span>
        <p className="mt-1 text-2xl font-semibold text-slate-100">
          {formatCurrency(flowData.total)}
        </p>
        <span className="text-xs text-slate-400">Total distribution</span>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {flowData.items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col items-center rounded-lg border border-slate-700 bg-slate-900/70 p-4 text-center shadow-sm"
            style={{ borderColor: item.color }}
          >
            <span className="text-xs uppercase tracking-widest text-slate-400">
              {item.label}
            </span>
            <p className="mt-2 text-lg font-semibold text-slate-100">
              {formatCurrency(item.value)}
            </p>
            <span className="mt-1 text-xs text-slate-500">
              {Math.round((item.value / flowData.total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
