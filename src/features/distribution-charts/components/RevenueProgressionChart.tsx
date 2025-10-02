import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useActiveTimelineScenario } from "@/features/timeline";
import { useScenarioComparisons } from "@/shared/hooks/useScenarioComparisons";

interface ProgressionDataPoint {
  day: number;
  dayLabel: string;
  baseRevenue: number;
  midRevenue: number;
  highRevenue: number;
  baseFees: number;
  midFees: number;
  highFees: number;
  baseCharity: number;
  midCharity: number;
  highCharity: number;
  basePayouts: number;
  midPayouts: number;
  highPayouts: number;
}

const COLORS = {
  base: "#0ea5e9", // sky-500
  mid: "#10b981", // emerald-500
  high: "#f59e0b", // amber-500
};

export function RevenueProgressionChart() {
  const baseScenario = useActiveTimelineScenario();
  const { mid: midScenario, high: highScenario } = useScenarioComparisons();

  const chartData = useMemo(() => {
    if (!baseScenario?.analytics?.flow) return null;

    const maxDays = Math.min(
      7, // Start with 7 days
      baseScenario.analytics.flow.length,
      midScenario?.analytics?.flow?.length || 0,
      highScenario?.analytics?.flow?.length || 0
    );

    const data: ProgressionDataPoint[] = [];

    for (let i = 0; i < maxDays; i++) {
      const baseData = baseScenario.analytics.flow[i];
      const midData = midScenario?.analytics?.flow?.[i];
      const highData = highScenario?.analytics?.flow?.[i];

      if (!baseData) break;

      data.push({
        day: i + 1,
        dayLabel: `Day ${i + 1}`,
        baseRevenue: baseData.cumulativeRevenue || 0,
        midRevenue: midData?.cumulativeRevenue || 0,
        highRevenue: highData?.cumulativeRevenue || 0,
        baseFees: baseData.cumulativePlatformFees || 0,
        midFees: midData?.cumulativePlatformFees || 0,
        highFees: highData?.cumulativePlatformFees || 0,
        baseCharity: baseData.cumulativeCharity || 0,
        midCharity: midData?.cumulativeCharity || 0,
        highCharity: highData?.cumulativeCharity || 0,
        basePayouts: baseData.cumulativePayouts || 0,
        midPayouts: midData?.cumulativePayouts || 0,
        highPayouts: highData?.cumulativePayouts || 0,
      });
    }

    return data;
  }, [
    baseScenario?.analytics?.flow,
    midScenario?.analytics?.flow,
    highScenario?.analytics?.flow,
  ]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; name: string }>;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-slate-100 mb-2">
            Revenue Comparison
          </p>
          <div className="space-y-1 text-sm">
            <p className="text-sky-400">
              Base: {formatCurrency(payload[0]?.value || 0)}
            </p>
            <p className="text-emerald-400">
              Mid: {formatCurrency(payload[1]?.value || 0)}
            </p>
            <p className="text-amber-400">
              High: {formatCurrency(payload[2]?.value || 0)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <p>No progression data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">
          Revenue Progression
        </h3>
        <span className="text-sm text-slate-400">
          Days 1-{chartData.length} of{" "}
          {baseScenario?.analytics?.flow?.length || 0}
        </span>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-sky-400"></div>
          <span className="text-slate-300">Base Scenario</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-emerald-400"></div>
          <span className="text-slate-300">Mid Scenario</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-amber-400"></div>
          <span className="text-slate-300">High Scenario</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <AreaChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <defs>
            <linearGradient id="baseGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.base} stopOpacity={0.8} />
              <stop offset="95%" stopColor={COLORS.base} stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="midGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.mid} stopOpacity={0.8} />
              <stop offset="95%" stopColor={COLORS.mid} stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="highGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.high} stopOpacity={0.8} />
              <stop offset="95%" stopColor={COLORS.high} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="dayLabel" stroke="#9ca3af" fontSize={12} />
          <YAxis
            stroke="#9ca3af"
            fontSize={12}
            tickFormatter={formatCurrency}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Area
            type="monotone"
            dataKey="baseRevenue"
            stackId="revenue"
            stroke={COLORS.base}
            fill={COLORS.base}
            fillOpacity={0.8}
            name="Base Revenue"
          />
          <Area
            type="monotone"
            dataKey="midRevenue"
            stackId="revenue"
            stroke={COLORS.mid}
            fill={COLORS.mid}
            fillOpacity={0.8}
            name="Mid Revenue"
          />
          <Area
            type="monotone"
            dataKey="highRevenue"
            stackId="revenue"
            stroke={COLORS.high}
            fill={COLORS.high}
            fillOpacity={0.8}
            name="High Revenue"
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-400">Base Total</div>
          <div className="text-lg font-semibold text-sky-400">
            {formatCurrency(chartData[chartData.length - 1]?.baseRevenue || 0)}
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-400">Mid Total</div>
          <div className="text-lg font-semibold text-emerald-400">
            {formatCurrency(chartData[chartData.length - 1]?.midRevenue || 0)}
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-400">High Total</div>
          <div className="text-lg font-semibold text-amber-400">
            {formatCurrency(chartData[chartData.length - 1]?.highRevenue || 0)}
          </div>
        </div>
      </div>
    </div>
  );
}
