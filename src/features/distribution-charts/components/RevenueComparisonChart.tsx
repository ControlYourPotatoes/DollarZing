import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  useActiveTimelineDay,
  useActiveTimelineScenario,
} from "@/features/timeline";
import { useScenarioComparisons } from "@/shared/hooks/useScenarioComparisons";

interface ScenarioComparisonData {
  scenario: string;
  label: string;
  revenue: number;
  fees: number;
  charity: number;
  payouts: number;
}

const COLORS = {
  base: "#0ea5e9", // sky-500
  mid: "#10b981", // emerald-500
  high: "#f59e0b", // amber-500
};

export function RevenueComparisonChart() {
  const activeDay = useActiveTimelineDay();
  const baseScenario = useActiveTimelineScenario();
  const { mid: midScenario, high: highScenario } = useScenarioComparisons();

  const chartData = useMemo(() => {
    if (!activeDay) return null;

    const data: ScenarioComparisonData[] = [];

    // Base scenario
    if (
      baseScenario &&
      activeDay.dayIndex < baseScenario.analytics.flow.length
    ) {
      const baseFlow = baseScenario.analytics.flow[activeDay.dayIndex];
      data.push({
        scenario: "base",
        label: baseFlow?.label || "Base",
        revenue: baseFlow?.cumulativeRevenue || 0,
        fees: baseFlow?.cumulativePlatformFees || 0,
        charity: baseFlow?.cumulativeCharity || 0,
        payouts: baseFlow?.cumulativePayouts || 0,
      });
    }

    // Mid scenario
    if (midScenario && activeDay.dayIndex < midScenario.analytics.flow.length) {
      const midFlow = midScenario.analytics.flow[activeDay.dayIndex];
      data.push({
        scenario: "mid",
        label: midFlow?.label || "Mid",
        revenue: midFlow?.cumulativeRevenue || 0,
        fees: midFlow?.cumulativePlatformFees || 0,
        charity: midFlow?.cumulativeCharity || 0,
        payouts: midFlow?.cumulativePayouts || 0,
      });
    }

    // High scenario
    if (
      highScenario &&
      activeDay.dayIndex < highScenario.analytics.flow.length
    ) {
      const highFlow = highScenario.analytics.flow[activeDay.dayIndex];
      data.push({
        scenario: "high",
        label: highFlow?.label || "High",
        revenue: highFlow?.cumulativeRevenue || 0,
        fees: highFlow?.cumulativePlatformFees || 0,
        charity: highFlow?.cumulativeCharity || 0,
        payouts: highFlow?.cumulativePayouts || 0,
      });
    }

    return data;
  }, [activeDay, baseScenario, midScenario, highScenario]);

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
    payload?: Array<{ payload: ScenarioComparisonData }>;
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-slate-100 mb-2">{data.label}</p>
          <div className="space-y-1 text-sm">
            <p className="text-sky-400">
              Total Revenue: {formatCurrency(data.revenue)}
            </p>
            <p className="text-amber-400">
              Platform Fees: {formatCurrency(data.fees)}
            </p>
            <p className="text-emerald-400">
              Charity: {formatCurrency(data.charity)}
            </p>
            <p className="text-violet-400">
              Player Payouts: {formatCurrency(data.payouts)}
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
        <p>No revenue data available for comparison</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">
          Scenario Revenue Comparison
        </h3>
        <span className="text-sm text-slate-400">
          Day {activeDay?.dayIndex ? activeDay.dayIndex + 1 : 1}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="label" stroke="#9ca3af" fontSize={12} />
          <YAxis
            stroke="#9ca3af"
            fontSize={12}
            tickFormatter={formatCurrency}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar
            dataKey="revenue"
            name="Total Revenue"
            fill="#0ea5e9"
            radius={[4, 4, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[entry.scenario as keyof typeof COLORS]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Detailed breakdown below the chart */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {chartData.map((scenario) => (
          <div
            key={scenario.scenario}
            className="bg-slate-800/50 rounded-lg p-3"
          >
            <h4 className="text-sm font-semibold text-slate-200 mb-2">
              {scenario.label} Breakdown
            </h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Platform Fees:</span>
                <span className="text-amber-400 font-medium">
                  {formatCurrency(scenario.fees)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Charity:</span>
                <span className="text-emerald-400 font-medium">
                  {formatCurrency(scenario.charity)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Player Payouts:</span>
                <span className="text-violet-400 font-medium">
                  {formatCurrency(scenario.payouts)}
                </span>
              </div>
              <hr className="border-slate-600 my-2" />
              <div className="flex justify-between">
                <span className="text-slate-300 font-semibold">Total:</span>
                <span className="text-sky-400 font-semibold">
                  {formatCurrency(scenario.revenue)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
