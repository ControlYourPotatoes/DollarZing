import { useMemo } from "react";

import { usePresentationTimelineStore } from "@/shared/hooks/presentationTimelineStore";
import { NormalizedPresentationDay, NormalizedPresentationScenario } from "@/shared/presentation";

export function useActiveTimelineScenario(): NormalizedPresentationScenario | undefined {
  return usePresentationTimelineStore((state) =>
    state.activeScenarioId ? state.scenarios[state.activeScenarioId] : undefined
  );
}

export function useActiveTimelineDay(): NormalizedPresentationDay | undefined {
  const scenario = useActiveTimelineScenario();
  const activeIndex = usePresentationTimelineStore((state) => state.activeDayIndex);
  return useMemo(() => {
    if (!scenario) return undefined;
    return scenario.dayLookup[activeIndex];
  }, [scenario, activeIndex]);
}

export function useTimelineSeries() {
  const scenario = useActiveTimelineScenario();
  return scenario?.timelineSeries;
}

