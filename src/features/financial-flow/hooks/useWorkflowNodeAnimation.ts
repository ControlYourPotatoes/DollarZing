import { useEffect, useMemo } from "react";
import { AnimationControls, useAnimation } from "framer-motion";

import { usePresentationTimelineStore } from "@/shared/hooks/presentationTimelineStore";
import { getTimeScaleForIndex, TimeScale } from "@/shared/time-scales/config";

import {
  SimulationPhase,
  WorkflowNodeViewState,
  WorkflowRingKey,
  WorkflowRingMetrics,
} from "../types";

const RING_KEYS: WorkflowRingKey[] = ["base", "mid", "high"];

const VIEW_STATE_DURATIONS: Record<WorkflowNodeViewState, number> = {
  compact: 0.18,
  standard: 0.22,
  expanded: 0.32,
};

const SCALE_SPEED_FACTORS: Record<TimeScale, number> = {
  daily: 1,
  weekly: 1.2,
  monthly: 1.6,
};

interface UseWorkflowNodeAnimationArgs {
  nodeId: string;
  viewState: WorkflowNodeViewState;
  isActive: boolean;
  rings: WorkflowRingMetrics[];
  ringHoverKey?: WorkflowRingKey | null;
  phase?: SimulationPhase;
}

interface WorkflowNodeAnimationResult {
  nodeControls: AnimationControls;
  ringControls: Record<WorkflowRingKey, AnimationControls>;
  orderedRings: WorkflowRingMetrics[];
  duration: number;
}

export function useWorkflowNodeAnimation({
  nodeId,
  viewState,
  isActive,
  rings,
  ringHoverKey,
  phase = "idle",
}: UseWorkflowNodeAnimationArgs): WorkflowNodeAnimationResult {
  void nodeId;

  const nodeControls = useAnimation();
  const baseControls = useAnimation();
  const midControls = useAnimation();
  const highControls = useAnimation();

  const ringControls: Record<WorkflowRingKey, AnimationControls> = useMemo(
    () => ({ base: baseControls, mid: midControls, high: highControls }),
    [baseControls, midControls, highControls]
  );

  const activeDayIndex = usePresentationTimelineStore(
    (state) => state.activeDayIndex
  );
  const activeScenario = usePresentationTimelineStore(
    (state) =>
      state.activeScenarioId ? state.scenarios[state.activeScenarioId] : undefined
  );

  const activeScale: TimeScale = useMemo(() => {
    if (!activeScenario) return "daily";
    return getTimeScaleForIndex(activeScenario.duration, activeDayIndex);
  }, [activeDayIndex, activeScenario]);

  const baseDuration = VIEW_STATE_DURATIONS[viewState];
  const duration = baseDuration * (SCALE_SPEED_FACTORS[activeScale] ?? 1);

  useEffect(() => {
    const ringTransition = {
      type: "tween" as const,
      duration,
      ease: "easeOut",
    };
    const nodeTransition = {
      type: "tween" as const,
      duration,
      ease: "easeOut",
    };
    const baseOpacity = isActive ? 1 : 0.6;

    RING_KEYS.forEach((key) => {
      const controls = ringControls[key];
      const isHovered = ringHoverKey === key;
      void controls.start({
        opacity: baseOpacity,
        scale: isHovered ? 1.05 : 1,
        transition: ringTransition,
      });
    });

    void nodeControls.start({
      scale: isActive ? 1.05 : 1,
      opacity: phase === "running" ? 1 : 0.95,
      transition: nodeTransition,
    });
  }, [duration, isActive, nodeControls, phase, ringControls, ringHoverKey]);

  const orderedRings = useMemo(() => {
    if (!isActive) {
      return rings;
    }
    return [...rings].sort((a, b) => a.value - b.value);
  }, [isActive, rings]);

  return {
    nodeControls,
    ringControls,
    orderedRings,
    duration,
  };
}
