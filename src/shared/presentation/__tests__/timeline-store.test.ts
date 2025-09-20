import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { usePresentationTimelineStore } from "../../hooks/presentationTimelineStore";
import { validatePresentationSnapshotFile } from "../validation";

const SAMPLE_SNAPSHOT_PATH = join(
  process.cwd(),
  "engine",
  "generated-datasets",
  "anchor-datasets",
  "growth-15_risk-low_charity-10",
  "presentation-snapshots.json"
);

const SAMPLE_MANIFEST = [
  {
    scenarioId: "growth-15_risk-low_charity-10",
    path: "anchor-datasets/growth-15_risk-low_charity-10/presentation-snapshots.json",
    parameters: {
      adoptionRate: "low",
      cashOutStrategy: "low",
      charityShare: "10",
    },
    coordinates: {
      adoptionRate: 0,
      cashOutStrategy: 0,
      charityShare: 0,
    },
    days: 90,
    generatedAt: new Date().toISOString(),
  },
];

const resetStore = () =>
  usePresentationTimelineStore.setState({
    scenarios: {},
    manifest: undefined,
    activeScenarioId: undefined,
    activeDayIndex: 0,
    isPlaying: false,
    playbackSpeed: 1,
    lastUpdatedAt: undefined,
  });

beforeEach(() => {
  resetStore();
});

describe("presentation timeline store", () => {
  it("loads manifest and scenario, exposing active day data", () => {
    usePresentationTimelineStore.getState().loadManifest(SAMPLE_MANIFEST);

    const snapshot = validatePresentationSnapshotFile(
      JSON.parse(readFileSync(SAMPLE_SNAPSHOT_PATH, "utf8"))
    );

    usePresentationTimelineStore.getState().upsertScenario(snapshot);

    const activeScenario = usePresentationTimelineStore
      .getState()
      .getActiveScenario();

    expect(activeScenario?.scenarioId).toBe(
      "growth-15_risk-low_charity-10"
    );

    const activeDay = usePresentationTimelineStore.getState().getActiveDay();
    expect(activeDay).toBeDefined();
    expect(activeDay?.dayIndex).toBe(0);
  });

  it("supports timeline stepping with clamping", () => {
    const snapshot = validatePresentationSnapshotFile(
      JSON.parse(readFileSync(SAMPLE_SNAPSHOT_PATH, "utf8"))
    );

    usePresentationTimelineStore.getState().loadManifest(SAMPLE_MANIFEST);
    usePresentationTimelineStore.getState().upsertScenario(snapshot);

    const store = usePresentationTimelineStore.getState();
    store.setActiveDay(10);
    store.stepDay(5);
    expect(usePresentationTimelineStore.getState().getActiveDay()?.dayIndex).toBe(15);

    // Clamp to max duration
    store.stepDay(10_000);
    const scenario = store.getActiveScenario();
    expect(store.getActiveDay()?.dayIndex).toBe((scenario?.duration ?? 1) - 1);
  });
});
