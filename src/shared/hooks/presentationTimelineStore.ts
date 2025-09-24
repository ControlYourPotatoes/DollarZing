import { create } from "zustand";

import {
  NormalizedPresentationScenario,
  NormalizedPresentationDay,
  ScenarioIndex,
  PresentationSnapshotFile,
} from "../presentation/types";
import { normalizePresentationSnapshot } from "../presentation/normalizer";
import { buildScenarioIndex } from "../presentation/scenario-index";
import { computeInterpolationAnchors } from "../presentation/interpolation";
import {
  SimulationPhase,
  WorkflowNodeViewState,
  WorkflowRingKey,
} from "@/features/financial-flow/types";

interface TimelineState {
  scenarios: Record<string, NormalizedPresentationScenario>;
  manifest?: ScenarioIndex;
  activeScenarioId?: string;
  activeDayIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  lastUpdatedAt?: number;
  hoveredNodeId?: string | null;
  hoveredRingKey?: WorkflowRingKey | null;
  nodeViewStates: Record<string, WorkflowNodeViewState>;
  simulationPhase: SimulationPhase;
  loadManifest: (manifestRaw: unknown) => ScenarioIndex;
  upsertScenario: (
    snapshotRaw: PresentationSnapshotFile | unknown
  ) => NormalizedPresentationScenario;
  setActiveScenario: (scenarioId: string) => void;
  setActiveDay: (dayIndex: number) => void;
  stepDay: (delta: number) => void;
  setPlaybackState: (isPlaying: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setHoveredNode: (nodeId: string | null) => void;
  setHoveredRing: (ringKey: WorkflowRingKey | null) => void;
  setNodeViewState: (nodeId: string, viewState: WorkflowNodeViewState) => void;
  setSimulationPhase: (phase: SimulationPhase) => void;
  getActiveScenario: () => NormalizedPresentationScenario | undefined;
  getActiveDay: () => NormalizedPresentationDay | undefined;
  computeAnchors: (coordinates: {
    adoptionRate: number;
    cashOutStrategy: number;
    charityShare: number;
  }) => ReturnType<typeof computeInterpolationAnchors> | undefined;
  // Derived selectors
  getActivePoolMetrics: () =>
    | {
        depositedToday: number;
        consumedToday: number;
        outstanding: number;
        utilization: number; // consumedToday / (consumedToday + outstanding)
      }
    | undefined;
  getActiveCashoutMetrics: () =>
    | {
        countToday: number;
        amountToday: number;
        cumulativeAmount?: number;
        cumulativeCount?: number;
      }
    | undefined;
}

function clampDayIndex(
  scenario: NormalizedPresentationScenario | undefined,
  index: number
): number {
  if (!scenario) {
    return 0;
  }
  if (scenario.duration === 0) {
    return 0;
  }
  const maxIndex = scenario.duration - 1;
  return Math.max(0, Math.min(index, maxIndex));
}

export const usePresentationTimelineStore = create<TimelineState>()(
  (set, get) => ({
    scenarios: {},
    activeDayIndex: 0,
    isPlaying: false,
    playbackSpeed: 1,
    hoveredNodeId: null,
    hoveredRingKey: null,
    nodeViewStates: {},
    simulationPhase: "idle",
    loadManifest: (manifestRaw: unknown) => {
      const manifest = buildScenarioIndex(manifestRaw);
      set({ manifest });
      return manifest;
    },
    upsertScenario: (snapshotRaw: PresentationSnapshotFile | unknown) => {
      const normalized = normalizePresentationSnapshot(snapshotRaw);
      set((state) => {
        const scenarios = {
          ...state.scenarios,
          [normalized.scenarioId]: normalized,
        };
        const activeScenarioId =
          state.activeScenarioId ?? normalized.scenarioId;
        const activeScenario = scenarios[activeScenarioId];
        return {
          scenarios,
          activeScenarioId,
          activeDayIndex: clampDayIndex(activeScenario, state.activeDayIndex),
          lastUpdatedAt: Date.now(),
        };
      });
      return normalized;
    },
    setActiveScenario: (scenarioId: string) => {
      const state = get();
      const scenario = state.scenarios[scenarioId];
      if (!scenario) {
        throw new Error(`Scenario ${scenarioId} has not been loaded`);
      }
      set({
        activeScenarioId: scenarioId,
        activeDayIndex: clampDayIndex(scenario, get().activeDayIndex),
      });
    },
    setActiveDay: (dayIndex: number) => {
      const scenario = get().getActiveScenario();
      set({
        activeDayIndex: clampDayIndex(scenario, dayIndex),
      });
    },
    stepDay: (delta: number) => {
      const scenario = get().getActiveScenario();
      const currentIndex = get().activeDayIndex;
      const nextIndex = clampDayIndex(scenario, currentIndex + delta);
      set({ activeDayIndex: nextIndex });
    },
    setPlaybackState: (isPlaying: boolean) => set({ isPlaying }),
    setPlaybackSpeed: (speed: number) => {
      if (speed <= 0) {
        throw new Error("Playback speed must be greater than zero");
      }
      set({ playbackSpeed: speed });
    },
    setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),
    setHoveredRing: (ringKey) => set({ hoveredRingKey: ringKey }),
    setNodeViewState: (nodeId, viewState) =>
      set((state) => ({
        nodeViewStates: { ...state.nodeViewStates, [nodeId]: viewState },
      })),
    setSimulationPhase: (phase) => set({ simulationPhase: phase }),
    getActiveScenario: () => {
      const state = get();
      if (!state.activeScenarioId) {
        return undefined;
      }
      return state.scenarios[state.activeScenarioId];
    },
    getActiveDay: () => {
      const scenario = get().getActiveScenario();
      if (!scenario) {
        return undefined;
      }
      return scenario.dayLookup[get().activeDayIndex];
    },
    computeAnchors: (coordinates) => {
      const state = get();
      if (!state.manifest) {
        return undefined;
      }
      return computeInterpolationAnchors(state.manifest, coordinates);
    },
    getActivePoolMetrics: () => {
      const day = get().getActiveDay();
      if (!day || !day.pool) return undefined;
      const { depositedToday, consumedToday, outstanding } = day.pool;
      const denom = consumedToday + outstanding;
      const utilization = denom > 0 ? consumedToday / denom : 0;
      return { depositedToday, consumedToday, outstanding, utilization };
    },
    getActiveCashoutMetrics: () => {
      const day = get().getActiveDay();
      if (!day || !day.cashouts) return undefined;
      return { ...day.cashouts };
    },
  })
);
