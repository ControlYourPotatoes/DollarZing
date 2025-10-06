import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  useActiveTimelineDay,
  useActiveTimelineScenario,
} from "@/features/timeline";
import { useScenarioComparisons } from "@/shared/hooks/useScenarioComparisons";

interface EngagementDataPoint {
  label: string;
  baseActive: number;
  midActive: number;
  highActive: number;
  baseGrowth: number;
  midGrowth: number;
  highGrowth: number;
}

const COLORS = {
  base: "#0ea5e9", // sky-500
  mid: "#10b981", // emerald-500
  high: "#f59e0b", // amber-500
};

export function PlayerEngagementChart() {
  const activeDay = useActiveTimelineDay();
  const baseScenario = useActiveTimelineScenario();
  const { mid: midScenario, high: highScenario } = useScenarioComparisons();

  const engagementData = useMemo(() => {
    if (!baseScenario?.analytics?.cohort || !activeDay) return null;

    const availableDays = activeDay.dayIndex + 1;
    const isDaily = availableDays <= 30;
    const maxPoints = isDaily ? 30 : 17; // Show last 30 days or ~17 weeks
    const aggregationSize = isDaily ? 1 : 7;
    const startDayIndex = Math.max(
      0,
      activeDay.dayIndex - maxPoints * aggregationSize + 1
    );
    const data: EngagementDataPoint[] = [];

    for (let period = 0; period < maxPoints; period++) {
      const periodStart = startDayIndex + period * aggregationSize;
      const periodEnd = Math.min(
        periodStart + aggregationSize - 1,
        activeDay.dayIndex
      );
      if (periodStart > activeDay.dayIndex) break;

      let baseActiveSum = 0,
        midActiveSum = 0,
        highActiveSum = 0;
      let baseGrowthSum = 0,
        midGrowthSum = 0,
        highGrowthSum = 0;
      let count = 0;

      for (let i = periodStart; i <= periodEnd; i++) {
        const baseData = baseScenario.analytics.cohort[i];
        const midData = midScenario?.analytics?.cohort?.[i];
        const highData = highScenario?.analytics?.cohort?.[i];
        if (!baseData) continue;

        baseActiveSum += baseData.activePlayers || 0;
        midActiveSum += midData?.activePlayers || 0;
        highActiveSum += highData?.activePlayers || 0;

        // Calculate growth rate as newPlayers / targetPlayers * 10
        // targetPlayers = baseMarket * adoptionRate * adoptionProgress
        const baseMarket = 1000000;
        const midpointDay = 90;
        const steepnessFactor = 20;
        const dayNumber = i + 1; // dayIndex 0 corresponds to day 1
        const x = (dayNumber - midpointDay) / steepnessFactor;
        const adoptionProgress = 1 / (1 + Math.exp(-x));

        const getAdoptionRate = (scenario?: {
          coordinates?: { adoptionRate: number };
        }) => {
          const coord = scenario?.coordinates?.adoptionRate ?? 0;
          return coord === 0 ? 0.15 : coord === 1 ? 0.35 : 0.6;
        };

        const baseAdoptionRate = getAdoptionRate(baseScenario);
        const midAdoptionRate = getAdoptionRate(midScenario);
        const highAdoptionRate = getAdoptionRate(highScenario);

        const baseTarget = baseMarket * baseAdoptionRate * adoptionProgress;
        const midTarget = baseMarket * midAdoptionRate * adoptionProgress;
        const highTarget = baseMarket * highAdoptionRate * adoptionProgress;

        baseGrowthSum += baseTarget
          ? ((baseData.newPlayers || 0) / baseTarget) * 10
          : 0;
        midGrowthSum += midTarget
          ? ((midData?.newPlayers || 0) / midTarget) * 10
          : 0;
        highGrowthSum += highTarget
          ? ((highData?.newPlayers || 0) / highTarget) * 10
          : 0;

        count++;
      }

      if (count > 0) {
        const label = isDaily
          ? `Day ${periodStart + 1}`
          : `Week ${Math.floor(periodStart / 7) + 1}`;
        data.push({
          label,
          baseActive: baseActiveSum / count,
          midActive: midActiveSum / count,
          highActive: highActiveSum / count,
          baseGrowth: baseGrowthSum / count,
          midGrowth: midGrowthSum / count,
          highGrowth: highGrowthSum / count,
        });
      }
    }

    return data;
  }, [
    activeDay,
    baseScenario?.analytics?.cohort,
    midScenario?.analytics?.cohort,
    highScenario?.analytics?.cohort,
  ]);

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
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
            Active Players (Avg)
          </p>
          <div className="space-y-1 text-sm">
            <p className="text-sky-400">
              Base: {formatNumber(payload[0]?.value || 0)}
            </p>
            <p className="text-emerald-400">
              Mid: {formatNumber(payload[1]?.value || 0)}
            </p>
            <p className="text-amber-400">
              High: {formatNumber(payload[2]?.value || 0)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (!engagementData || engagementData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <p>No engagement data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">
          Player Growth Trends
        </h3>
        <span className="text-sm text-slate-400">
          Last {engagementData.length}{" "}
          {engagementData.length === 30 ? "days" : "weeks"}
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

      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={engagementData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="label" stroke="#9ca3af" fontSize={12} />
          <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={formatNumber} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="baseActive"
            stroke={COLORS.base}
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Base Active Players (Avg)"
          />
          <Line
            type="monotone"
            dataKey="midActive"
            stroke={COLORS.mid}
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Mid Active Players (Avg)"
          />
          <Line
            type="monotone"
            dataKey="highActive"
            stroke={COLORS.high}
            strokeWidth={2}
            dot={{ r: 4 }}
            name="High Active Players (Avg)"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-400">Base Growth Rate</div>
          <div className="text-lg font-semibold text-sky-400">
            {formatPercent(
              engagementData[engagementData.length - 1]?.baseGrowth || 0
            )}
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-400">Mid Growth Rate</div>
          <div className="text-lg font-semibold text-emerald-400">
            {formatPercent(
              engagementData[engagementData.length - 1]?.midGrowth || 0
            )}
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-400">High Growth Rate</div>
          <div className="text-lg font-semibold text-amber-400">
            {formatPercent(
              engagementData[engagementData.length - 1]?.highGrowth || 0
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
