import { useEffect } from "react";

import { usePresentationTimelineStore } from "@/shared/hooks/presentationTimelineStore";
import {
  getStepForScale,
  getTimeScaleForIndex,
} from "@/shared/time-scales/config";

export function useTimelineKeyboardShortcuts(enabled = true): void {
  const stepDay = usePresentationTimelineStore((state) => state.stepDay);
  const getActiveScenario = usePresentationTimelineStore(
    (state) => state.getActiveScenario
  );
  const activeIndex = usePresentationTimelineStore(
    (state) => state.activeDayIndex
  );
  const setPlaybackState = usePresentationTimelineStore(
    (state) => state.setPlaybackState
  );
  const isPlaying = usePresentationTimelineStore((state) => state.isPlaying);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key) {
        case " ":
        case "Spacebar": {
          event.preventDefault();
          setPlaybackState(!isPlaying);
          break;
        }
        case "ArrowRight": {
          event.preventDefault();
          {
            const scenario = getActiveScenario?.();
            const scale = scenario
              ? getTimeScaleForIndex(scenario.duration, activeIndex)
              : "daily";
            const step = getStepForScale(scale);
            // Right should move backward per user feedback (reverse)
            stepDay(-step);
          }
          break;
        }
        case "ArrowLeft": {
          event.preventDefault();
          {
            const scenario = getActiveScenario?.();
            const scale = scenario
              ? getTimeScaleForIndex(scenario.duration, activeIndex)
              : "daily";
            const step = getStepForScale(scale);
            // Left should move forward per user feedback
            stepDay(step);
          }
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, isPlaying, setPlaybackState, stepDay]);
}
