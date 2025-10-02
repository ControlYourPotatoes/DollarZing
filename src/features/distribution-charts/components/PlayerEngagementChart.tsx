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
  day: number;
  dayLabel: string;
  baseActive: number;
  midActive: number;
  highActive: number;
  baseNew: number;
  midNew: number;
  highNew: number;
  baseRetention: number;
  midRetention: number;
  highRetention: number;
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

    const maxDays = Math.min(
      14, // Show last 14 days for engagement trends
      baseScenario.analytics.cohort.length,
      midScenario?.analytics?.cohort?.length || 0,
      highScenario?.analytics?.cohort?.length || 0
    );

    const data: EngagementDataPoint[] = [];

    for (
      let i = Math.max(0, activeDay.dayIndex - maxDays + 1);
      i <= activeDay.dayIndex;
      i++
    ) {
      const baseData = baseScenario.analytics.cohort[i];
      const midData = midScenario?.analytics?.cohort?.[i];
      const highData = highScenario?.analytics?.cohort?.[i];

      if (!baseData) break;

      data.push({
        day: i + 1,
        dayLabel: `Day ${i + 1}`,
        baseActive: baseData.activePlayers || 0,
        midActive: midData?.activePlayers || 0,
        highActive: highData?.activePlayers || 0,
        baseNew:
          baseData.totalPlayers -
          (baseScenario.analytics.cohort[i - 1]?.totalPlayers || 0),
        midNew: midData
          ? midData.totalPlayers -
            (midScenario.analytics.cohort[i - 1]?.totalPlayers || 0)
          : 0,
        highNew: highData
          ? highData.totalPlayers -
            (highScenario.analytics.cohort[i - 1]?.totalPlayers || 0)
          : 0,
        baseRetention: baseData.survivalRate || 0,
        midRetention: midData?.survivalRate || 0,
        highRetention: highData?.survivalRate || 0,
      });
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
          <p className="font-semibold text-slate-100 mb-2">Active Players</p>
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
          Player Engagement Trends
        </h3>
        <span className="text-sm text-slate-400">
          Last {engagementData.length} days
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
          <XAxis dataKey="dayLabel" stroke="#9ca3af" fontSize={12} />
          <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={formatNumber} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="baseActive"
            stroke={COLORS.base}
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Base Active Players"
          />
          <Line
            type="monotone"
            dataKey="midActive"
            stroke={COLORS.mid}
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Mid Active Players"
          />
          <Line
            type="monotone"
            dataKey="highActive"
            stroke={COLORS.high}
            strokeWidth={2}
            dot={{ r: 4 }}
            name="High Active Players"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-400">Base Retention</div>
          <div className="text-lg font-semibold text-sky-400">
            {formatPercent(
              engagementData[engagementData.length - 1]?.baseRetention || 0
            )}
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-400">Mid Retention</div>
          <div className="text-lg font-semibold text-emerald-400">
            {formatPercent(
              engagementData[engagementData.length - 1]?.midRetention || 0
            )}
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-400">High Retention</div>
          <div className="text-lg font-semibold text-amber-400">
            {formatPercent(
              engagementData[engagementData.length - 1]?.highRetention || 0
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
