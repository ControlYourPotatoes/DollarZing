import { describe, expect, it } from "vitest";

import { buildScenarioIndex, findScenarioByCoordinates } from "../scenario-index";
import { computeInterpolationAnchors } from "../interpolation";
import type { PresentationManifest } from "../types";

const mockManifest: PresentationManifest = [
  {
    scenarioId: "low-low-10",
    path: "anchor-datasets/low-low-10.json",
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
  {
    scenarioId: "low-low-20",
    path: "anchor-datasets/low-low-20.json",
    parameters: {
      adoptionRate: "low",
      cashOutStrategy: "low",
      charityShare: "20",
    },
    coordinates: {
      adoptionRate: 0,
      cashOutStrategy: 0,
      charityShare: 0.5,
    },
    days: 90,
    generatedAt: new Date().toISOString(),
  },
  {
    scenarioId: "mid-mid-20",
    path: "anchor-datasets/mid-mid-20.json",
    parameters: {
      adoptionRate: "mid",
      cashOutStrategy: "mid",
      charityShare: "20",
    },
    coordinates: {
      adoptionRate: 0.5,
      cashOutStrategy: 0.5,
      charityShare: 0.5,
    },
    days: 90,
    generatedAt: new Date().toISOString(),
  },
  {
    scenarioId: "high-high-30",
    path: "anchor-datasets/high-high-30.json",
    parameters: {
      adoptionRate: "high",
      cashOutStrategy: "high",
      charityShare: "30",
    },
    coordinates: {
      adoptionRate: 1,
      cashOutStrategy: 1,
      charityShare: 1,
    },
    days: 90,
    generatedAt: new Date().toISOString(),
  },
];

describe("scenario index", () => {
  const index = buildScenarioIndex(mockManifest);

  it("builds lookup maps", () => {
    expect(index.byId.size).toBe(mockManifest.length);
    expect(findScenarioByCoordinates(index, {
      adoptionRate: 0.5,
      cashOutStrategy: 0.5,
      charityShare: 0.5,
    })?.scenarioId).toBe("mid-mid-20");
  });

  it("computes interpolation anchors with weights", () => {
    const result = computeInterpolationAnchors(index, {
      adoptionRate: 0.25,
      cashOutStrategy: 0.25,
      charityShare: 0.25,
    });

    expect(result.anchors.length).toBeGreaterThan(0);

    const totalWeight = result.anchors.reduce((sum, anchor) => sum + anchor.weight, 0);
    expect(Number(totalWeight.toFixed(6))).toBeCloseTo(1, 6);
  });
});

