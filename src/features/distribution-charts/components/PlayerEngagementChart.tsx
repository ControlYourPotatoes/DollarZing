import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import {
  useActiveTimelineDay,
  useActiveTimelineScenario,
} from "@/features/timeline";
import { useScenarioComparisons } from "@/shared/hooks/useScenarioComparisons";

type PlayerGrowthScenarioKey = "base" | "mid" | "high";

interface GrowthChartPoint {
  label: string;
  dayIndex: number;
  cumulativeInitial: number;
  cumulativeGrowth: number;
  cumulativeDauNew: number;
  totalPlayers: number;
  activePlayers: number;
  dailyInitial: number;
  dailyGrowth: number;
  dailyDauNew: number;
  dailyNewPlayers: number;
  dailyReactivated: number;
}

const STACK_COLORS = {
  initial: "#38bdf8",
  growth: "#34d399",
  dau: "#f97316",
} as const;

export function PlayerEngagementChart() {
  const activeDay = useActiveTimelineDay();
  const baseScenario = useActiveTimelineScenario();
  const { mid: midScenario, high: highScenario } = useScenarioComparisons();

  const [selectedScenario, setSelectedScenario] =
    useState<PlayerGrowthScenarioKey>("base");

  const scenarioSeries = useMemo(() => {
    const buildSeries = (
      scenario: typeof baseScenario | undefined
    ): GrowthChartPoint[] => {
      if (!scenario?.analytics?.playerGrowth || !activeDay) {
        return [];
      }

      const growthSeries = scenario.analytics.playerGrowth;
      const lastAvailableIndex = Math.min(
        activeDay.dayIndex,
        growthSeries.length - 1
      );

      if (lastAvailableIndex < 0) {
        return [];
      }

      const availablePoints = lastAvailableIndex + 1;
      const useDailyGranularity = availablePoints <= 30;
      const targetPointCount = useDailyGranularity ? 30 : 17;
      const aggregationSize = useDailyGranularity
        ? 1
        : Math.max(1, Math.floor(availablePoints / targetPointCount));
      const startIndex = Math.max(
        0,
        availablePoints - aggregationSize * targetPointCount
      );

      const data: GrowthChartPoint[] = [];

      for (
        let cursor = startIndex;
        cursor <= lastAvailableIndex;
        cursor += aggregationSize
      ) {
        const periodEnd = Math.min(cursor + aggregationSize - 1, lastAvailableIndex);
        const point = growthSeries[periodEnd];
        if (!point) continue;

        const label = useDailyGranularity
          ? `Day ${periodEnd + 1}`
          : `Week ${Math.floor(periodEnd / 7) + 1}`;

        data.push({
          label,
          dayIndex: periodEnd,
          cumulativeInitial: point.cumulativeInitialPlayers,
          cumulativeGrowth: point.cumulativeGrowthPlayers,
          cumulativeDauNew: point.cumulativeDauNewPlayers,
          totalPlayers: point.totalPlayers,
          activePlayers: point.activePlayers,
          dailyInitial: point.dailyInitialPlayers,
          dailyGrowth: point.dailyGrowthPlayers,
          dailyDauNew: point.dailyDauNewPlayers,
          dailyNewPlayers: point.dailyNewPlayers,
          dailyReactivated: point.dailyReactivatedPlayers,
        });
      }

      return data;
    };

    return {
      base: buildSeries(baseScenario),
      mid: buildSeries(midScenario),
      high: buildSeries(highScenario),
    } satisfies Record<PlayerGrowthScenarioKey, GrowthChartPoint[]>;
  }, [activeDay, baseScenario, midScenario, highScenario]);

  const availableScenarioKeys = useMemo(() => {
    return (Object.keys(scenarioSeries) as PlayerGrowthScenarioKey[]).filter(
      (key) => scenarioSeries[key].length > 0
    );
  }, [scenarioSeries]);

  useEffect(() => {
    if (availableScenarioKeys.length === 0) {
      return;
    }
    if (!availableScenarioKeys.includes(selectedScenario)) {
      setSelectedScenario(availableScenarioKeys[0]);
    }
  }, [availableScenarioKeys, selectedScenario]);

  const selectedSeries = scenarioSeries[selectedScenario] ?? [];

  const timeframeLabel = selectedSeries.length
    ? `Last ${selectedSeries.length} ${
        selectedSeries.length === 30 ? "days" : "weeks"
      }`
    : null;

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const formatCompact = (value: number) =>
    new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; dataKey: string; payload: GrowthChartPoint }>;
    label?: string;
  }) => {
    if (!active || !payload || payload.length === 0) {
      return null;
    }

    const point = payload[0]?.payload;
    if (!point) {
      return null;
    }

    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/90 p-3 text-sm shadow-lg">
        <div className="mb-2 font-semibold text-slate-100">{label}</div>
        <div className="space-y-1 text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-400">Total Players</span>
            <span className="font-semibold text-slate-100">
              {formatNumber(point.totalPlayers)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Active Players</span>
            <span className="font-semibold text-sky-300">
              {formatNumber(point.activePlayers)}
            </span>
          </div>
        </div>
        <div className="mt-3 border-t border-slate-800 pt-2 text-xs text-slate-400">
          <div className="mb-1 font-semibold text-slate-200">
            Prior Day Additions
          </div>
          <div className="flex justify-between">
            <span className="text-sky-300">Initial Seeding</span>
            <span>{formatNumber(point.dailyInitial)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-emerald-300">Organic Growth</span>
            <span>{formatNumber(point.dailyGrowth)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-amber-300">DAU Boost</span>
            <span>{formatNumber(point.dailyDauNew)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-fuchsia-300">Reactivated</span>
            <span>{formatNumber(point.dailyReactivated)}</span>
          </div>
        </div>
      </div>
    );
  };

  if (selectedSeries.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <p>No player growth data available yet.</p>
      </div>
    );
  }

  const finalPoint = selectedSeries[selectedSeries.length - 1];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">
            Player Growth Trends
          </h3>
          {timeframeLabel && (
            <span className="text-sm text-slate-400">{timeframeLabel}</span>
          )}
        </div>
        <div className="flex gap-2 text-xs">
          {availableScenarioKeys.map((scenarioKey) => {
            const label =
              scenarioKey === "base"
                ? "Base"
                : scenarioKey === "mid"
                ? "Mid"
                : "High";
            return (
              <button
                key={scenarioKey}
                onClick={() => setSelectedScenario(scenarioKey)}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  selectedScenario === scenarioKey
                    ? "bg-slate-700 text-slate-100"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-100"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={selectedSeries} margin={{ top: 20, right: 24, left: 4, bottom: 8 }}>
          <defs>
            <linearGradient id="initialFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={STACK_COLORS.initial} stopOpacity={0.7} />
              <stop offset="95%" stopColor={STACK_COLORS.initial} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={STACK_COLORS.growth} stopOpacity={0.65} />
              <stop offset="95%" stopColor={STACK_COLORS.growth} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="dauFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={STACK_COLORS.dau} stopOpacity={0.55} />
              <stop offset="95%" stopColor={STACK_COLORS.dau} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="label" stroke="#9ca3af" fontSize={12} />
          <YAxis
            stroke="#9ca3af"
            fontSize={12}
            tickFormatter={(value) => formatCompact(value)}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="cumulativeInitial"
            stackId="players"
            stroke={STACK_COLORS.initial}
            fill="url(#initialFill)"
            name="Initial Seeding"
          />
          <Area
            type="monotone"
            dataKey="cumulativeGrowth"
            stackId="players"
            stroke={STACK_COLORS.growth}
            fill="url(#growthFill)"
            name="Organic Growth"
          />
          <Area
            type="monotone"
            dataKey="cumulativeDauNew"
            stackId="players"
            stroke={STACK_COLORS.dau}
            fill="url(#dauFill)"
            name="DAU Boost"
          />
          <Line
            type="monotone"
            dataKey="activePlayers"
            stroke="#facc15"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={{ r: 3 }}
            name="Active Players"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-1 gap-4 text-center md:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Total Players
          </div>
          <div className="mt-1 text-xl font-semibold text-slate-100">
            {formatNumber(finalPoint.totalPlayers)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Active Players
          </div>
          <div className="mt-1 text-xl font-semibold text-sky-300">
            {formatNumber(finalPoint.activePlayers)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Prior Day Additions
          </div>
          <div className="mt-1 text-xs text-slate-400">
            <div className="flex justify-between">
              <span className="text-sky-300">Initial</span>
              <span className="text-slate-200">
                {formatNumber(finalPoint.dailyInitial)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-300">Organic</span>
              <span className="text-slate-200">
                {formatNumber(finalPoint.dailyGrowth)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-300">DAU Boost</span>
              <span className="text-slate-200">
                {formatNumber(finalPoint.dailyDauNew)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-fuchsia-300">Reactivated</span>
              <span className="text-slate-200">
                {formatNumber(finalPoint.dailyReactivated)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
