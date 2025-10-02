import { useEffect, useRef } from "react";

import { usePresentationTimelineStore } from "@/shared/hooks/presentationTimelineStore";

const STEP_INTERVAL_MS = 750;

/**
 * Drives autoplay behaviour for the presentation timeline store.
 */
export function useTimelinePlayback(): void {
  const isPlaying = usePresentationTimelineStore((state) => state.isPlaying);
  const playbackSpeed = usePresentationTimelineStore((state) => state.playbackSpeed);
  const stepDay = usePresentationTimelineStore((state) => state.stepDay);
  const activeDayIndex = usePresentationTimelineStore((state) => state.activeDayIndex);
  const activeScenario = usePresentationTimelineStore((state) =>
    state.activeScenarioId ? state.scenarios[state.activeScenarioId] : undefined
  );
  const setPlaybackState = usePresentationTimelineStore((state) => state.setPlaybackState);

  const rafRef = useRef<number | null>(null);
  const accumulatorRef = useRef(0);

  useEffect(() => {
    if (!isPlaying || !activeScenario) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const stepDuration = STEP_INTERVAL_MS / playbackSpeed;

    const tick = (now: number) => {
      if (!activeScenario) {
        return;
      }
      if (accumulatorRef.current === 0) {
        accumulatorRef.current = now;
      }
      const elapsed = now - accumulatorRef.current;
      if (elapsed >= stepDuration) {
        accumulatorRef.current = now;
        const nextIndex = Math.min(activeScenario.duration - 1, activeDayIndex + 1);
        if (nextIndex === activeDayIndex) {
          setPlaybackState(false);
          return;
        }
        stepDay(1);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      accumulatorRef.current = 0;
    };
  }, [
    isPlaying,
    playbackSpeed,
    stepDay,
    activeScenario,
    activeDayIndex,
    setPlaybackState,
  ]);
}

