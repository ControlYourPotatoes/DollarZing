import { useMemo } from "react";

import { useActiveTimelineDay, useActiveTimelineScenario } from "@/features/timeline";
import { useScenarioComparisons } from "@/shared/hooks/useScenarioComparisons";

export type LevelScenarioKey = "base" | "mid" | "high";

export interface LevelBarometerStep {
  level: number;
  gamesPlayed: number;
  wins: number;
  cashouts: number;
  progressions: number;
  winnings: number;
  losses: number;
  survivalRate: number;
  retentionRate: number;
}

export interface LevelBarometerSeries {
  key: LevelScenarioKey;
  label: string;
  steps: LevelBarometerStep[];
}

export interface LevelBarometerResult {
  activeDayIndex: number;
  series: LevelBarometerSeries[];
}

function extractSeries(
  key: LevelScenarioKey,
  label: string,
  steps?: LevelBarometerStep[]
): LevelBarometerSeries | null {
  if (!steps || steps.length === 0) {
    return null;
  }
  return {
    key,
    label,
    steps,
  };
}

export function useLevelBarometer(): LevelBarometerResult {
  const baseScenario = useActiveTimelineScenario();
  const activeDay = useActiveTimelineDay();
  const { mid: midScenario, high: highScenario } = useScenarioComparisons();

  return useMemo(() => {
    const activeDayIndex = activeDay?.dayIndex ?? 0;

    const series: LevelBarometerSeries[] = [];

    if (baseScenario?.analytics?.levels?.[activeDayIndex]) {
      const base = extractSeries(
        "base",
        baseScenario.analytics.levels[activeDayIndex].label,
        baseScenario.analytics.levels[activeDayIndex].steps
      );
      if (base) series.push(base);
    }

    if (midScenario?.analytics?.levels?.[activeDayIndex]) {
      const mid = extractSeries(
        "mid",
        midScenario.analytics.levels[activeDayIndex].label,
        midScenario.analytics.levels[activeDayIndex].steps
      );
      if (mid) series.push(mid);
    }

    if (highScenario?.analytics?.levels?.[activeDayIndex]) {
      const high = extractSeries(
        "high",
        highScenario.analytics.levels[activeDayIndex].label,
        highScenario.analytics.levels[activeDayIndex].steps
      );
      if (high) series.push(high);
    }

    return {
      activeDayIndex,
      series,
    };
  }, [
    activeDay?.dayIndex,
    baseScenario?.analytics?.levels,
    midScenario?.analytics?.levels,
    highScenario?.analytics?.levels,
  ]);
}

