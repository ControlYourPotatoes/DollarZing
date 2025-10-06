import { useMemo } from "react";

import {
  useActiveTimelineDay,
  useActiveTimelineScenario,
} from "@/features/timeline";
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

    // Helper to aggregate steps across days
    const aggregateSteps = (
      levels: any[]
    ): LevelBarometerStep[] | undefined => {
      if (!levels || levels.length === 0) return undefined;

      const maxLevels = Math.max(
        ...levels.slice(0, activeDayIndex + 1).map((l) => l.steps?.length || 0)
      );
      const aggregated: LevelBarometerStep[] = [];

      for (let level = 1; level <= maxLevels; level++) {
        let totalGamesPlayed = 0;
        let totalWins = 0;
        let totalCashouts = 0;
        let totalProgressions = 0;
        let totalWinnings = 0;
        let totalLosses = 0;
        let lastSurvivalRate = 0;
        let lastRetentionRate = 0;

        for (let day = 0; day <= activeDayIndex; day++) {
          const dayData = levels[day];
          if (dayData?.steps) {
            const step = dayData.steps.find((s: any) => s.level === level);
            if (step) {
              totalGamesPlayed += step.gamesPlayed || 0;
              totalWins += step.wins || 0;
              totalCashouts += step.cashouts || 0;
              totalProgressions += step.progressions || 0;
              totalWinnings += step.winnings || 0;
              totalLosses += step.losses || 0;
              lastSurvivalRate = step.survivalRate || 0;
              lastRetentionRate = step.retentionRate || 0;
            }
          }
        }

        if (totalGamesPlayed > 0) {
          aggregated.push({
            level,
            gamesPlayed: totalGamesPlayed,
            wins: totalWins,
            cashouts: totalCashouts,
            progressions: totalProgressions,
            winnings: totalWinnings,
            losses: totalLosses,
            survivalRate: lastSurvivalRate,
            retentionRate: lastRetentionRate,
          });
        }
      }

      return aggregated.length > 0 ? aggregated : undefined;
    };

    if (baseScenario?.analytics?.levels) {
      const aggregatedSteps = aggregateSteps(baseScenario.analytics.levels);
      const base = extractSeries("base", "Base Scenario", aggregatedSteps);
      if (base) series.push(base);
    }

    if (midScenario?.analytics?.levels) {
      const aggregatedSteps = aggregateSteps(midScenario.analytics.levels);
      const mid = extractSeries("mid", "Mid Scenario", aggregatedSteps);
      if (mid) series.push(mid);
    }

    if (highScenario?.analytics?.levels) {
      const aggregatedSteps = aggregateSteps(highScenario.analytics.levels);
      const high = extractSeries("high", "High Scenario", aggregatedSteps);
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
