import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  useActiveTimelineScenario,
  useActiveTimelineDay,
} from "@/features/timeline";
import { useScenarioComparisons } from "@/shared/hooks/useScenarioComparisons";
import type { TooltipProps } from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

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
  const activeDay = useActiveTimelineDay();
  const [showDistribution, setShowDistribution] = useState({
    base: true,
    mid: true,
    high: true,
  });

  const chartData = useMemo(() => {
    if (!baseScenario?.analytics?.flow) return null;

    const baseFlow = baseScenario.analytics.flow;
    const midFlow = midScenario?.analytics?.flow;
    const highFlow = highScenario?.analytics?.flow;

    const activeIndex = activeDay?.dayIndex ?? 0;
    const desiredLength = Math.max(
      7,
      Math.min(activeIndex + 1, baseFlow.length)
    );

    const data: ProgressionDataPoint[] = [];

    for (let i = 0; i < desiredLength; i++) {
      const baseData = baseFlow[i];
      const midData = midFlow?.[i];
      const highData = highFlow?.[i];

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
  }, [activeDay?.dayIndex, baseScenario?.analytics?.flow, midScenario?.analytics?.flow, highScenario?.analytics?.flow]);

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
    label,
  }: TooltipProps<ValueType, NameType>) => {
    if (!active) return null;
    const point = payload?.[0]?.payload as ProgressionDataPoint | undefined;
    if (!point) return null;

    return (
      <div className="rounded-lg border border-slate-600 bg-slate-800 p-3 text-sm shadow-lg">
        <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">
          {label}
        </div>
        <div className="space-y-1">
          <p className="text-sky-400">
            Base: {formatCurrency(point.baseRevenue)}
          </p>
          <p className="text-emerald-400">
            Mid: {formatCurrency(point.midRevenue)}
          </p>
          <p className="text-amber-400">
            High: {formatCurrency(point.highRevenue)}
          </p>
        </div>
        <div className="mt-3 border-t border-slate-700 pt-2 text-xs text-slate-400">
          <div className="font-semibold text-slate-300 mb-1">
            Base Distribution
          </div>
          <div className="flex justify-between">
            <span>Charity</span>
            <span>{formatCurrency(point.baseCharity)}</span>
          </div>
          <div className="flex justify-between">
            <span>Player Payouts</span>
            <span>{formatCurrency(point.basePayouts)}</span>
          </div>
        </div>
      </div>
    );
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
          Days 1-{chartData[chartData.length - 1]?.day ?? chartData.length} of{" "}
          {baseScenario?.analytics?.flow?.length || 0}
        </span>
      </div>

      <div className="grid gap-4 text-sm text-slate-300 md:grid-cols-3">
        {(
          [
            { key: "base" as const, label: "Base Scenario", color: COLORS.base },
            { key: "mid" as const, label: "Mid Scenario", color: COLORS.mid },
            { key: "high" as const, label: "High Scenario", color: COLORS.high },
          ] as const
        ).map(({ key, label, color }) => (
          <button
            key={key}
            type="button"
            onClick={() =>
              setShowDistribution((prev) => ({
                ...prev,
                [key]: !prev[key],
              }))
            }
            className={`rounded-lg border p-3 text-left transition-colors ${
              showDistribution[key]
                ? "border-emerald-500/70 bg-slate-900/60"
                : "border-slate-800 bg-slate-900/35 hover:border-slate-700"
            }`}
          >
            <div className="mb-2 flex items-center gap-2 text-slate-100">
              <span
                className="inline-flex h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="font-semibold">{label}</span>
              <span
                className={`ml-auto inline-flex h-3 w-3 items-center justify-center rounded-full border ${
                  showDistribution[key]
                    ? "border-emerald-400 bg-emerald-400"
                    : "border-slate-600 bg-slate-800"
                }`}
              >
                <span
                  className={`block h-1.5 w-1.5 rounded-full transition ${
                    showDistribution[key]
                      ? "bg-emerald-100"
                      : "bg-transparent"
                  }`}
                />
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-400">
              {[
                { label: "Revenue", dash: "", key: "revenue" },
                { label: "Charity", dash: "6 3", key: "charity" },
                { label: "Player Payouts", dash: "3 3", key: "payouts" },
              ].map((line) => (
                <div
                  key={`${key}-${line.key}`}
                  className={`flex items-center gap-2 ${
                    line.key !== "revenue" && !showDistribution[key]
                      ? "opacity-30"
                      : ""
                  }`}
                >
                  <svg width="32" height="6">
                    <line
                      x1="0"
                      y1="3"
                      x2="32"
                      y2="3"
                      stroke={color}
                      strokeWidth={line.dash ? 2 : 3}
                      strokeDasharray={line.dash || undefined}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>{line.label}</span>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="dayLabel" stroke="#9ca3af" fontSize={12} />
          <YAxis
            stroke="#9ca3af"
            fontSize={12}
            tickFormatter={formatCurrency}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="baseRevenue"
            stroke={COLORS.base}
            strokeWidth={2.4}
            dot={false}
            name="Base Revenue"
          />
          <Line
            type="monotone"
            dataKey="midRevenue"
            stroke={COLORS.mid}
            strokeWidth={2}
            dot={false}
            name="Mid Revenue"
          />
          <Line
            type="monotone"
            dataKey="highRevenue"
            stroke={COLORS.high}
            strokeWidth={2}
            dot={false}
            name="High Revenue"
          />
          {showDistribution.base && (
            <>
              <Line
                type="monotone"
                dataKey="baseCharity"
                stroke={COLORS.base}
                strokeDasharray="6 3"
                strokeWidth={1.6}
                dot={false}
                name="Base Charity"
                opacity={0.7}
              />
              <Line
                type="monotone"
                dataKey="basePayouts"
                stroke={COLORS.base}
                strokeDasharray="3 3"
                strokeWidth={1.6}
                dot={false}
                name="Base Player Payouts"
                opacity={0.7}
              />
            </>
          )}
          {showDistribution.mid && (
            <>
              <Line
                type="monotone"
                dataKey="midCharity"
                stroke={COLORS.mid}
                strokeDasharray="6 3"
                strokeWidth={1.4}
                dot={false}
                name="Mid Charity"
                opacity={0.7}
              />
              <Line
                type="monotone"
                dataKey="midPayouts"
                stroke={COLORS.mid}
                strokeDasharray="3 3"
                strokeWidth={1.4}
                dot={false}
                name="Mid Player Payouts"
                opacity={0.7}
              />
            </>
          )}
          {showDistribution.high && (
            <>
              <Line
                type="monotone"
                dataKey="highCharity"
                stroke={COLORS.high}
                strokeDasharray="6 3"
                strokeWidth={1.4}
                dot={false}
                name="High Charity"
                opacity={0.7}
              />
              <Line
                type="monotone"
                dataKey="highPayouts"
                stroke={COLORS.high}
                strokeDasharray="3 3"
                strokeWidth={1.4}
                dot={false}
                name="High Player Payouts"
                opacity={0.7}
              />
            </>
          )}
        </LineChart>
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
        <div className="bg-slate-800/40 rounded-lg p-3 col-span-3 grid grid-cols-2 gap-3 text-left text-sm text-slate-400">
          <span>Base Charity</span>
          <span className="text-slate-200 font-semibold text-right">
            {formatCurrency(chartData[chartData.length - 1]?.baseCharity || 0)}
          </span>
          <span>Base Player Payouts</span>
          <span className="text-slate-200 font-semibold text-right">
            {formatCurrency(chartData[chartData.length - 1]?.basePayouts || 0)}
          </span>
        </div>
      </div>
    </div>
  );
}
