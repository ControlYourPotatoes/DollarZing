import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { normalizePresentationSnapshot } from "../normalizer";
import { validatePresentationSnapshotFile } from "../validation";

const SAMPLE_SNAPSHOT_PATH = join(
  process.cwd(),
  "engine",
  "generated-datasets",
  "anchor-datasets",
  "growth-15_risk-low_charity-10",
  "presentation-snapshots.json"
);

describe("normalizePresentationSnapshot", () => {
  const raw = JSON.parse(readFileSync(SAMPLE_SNAPSHOT_PATH, "utf8"));
  const parsed = validatePresentationSnapshotFile(raw);

  it("normalizes distribution percentages", () => {
    const normalized = normalizePresentationSnapshot(parsed);
    const firstDay = normalized.days[0];

    expect(firstDay.charts.distributionSeries).toHaveLength(3);

    const sum = firstDay.charts.distributionSeries.reduce(
      (acc, point) => acc + point.percentage,
      0
    );

    expect(Number(sum.toFixed(6))).toBeCloseTo(1, 3);
  });

  it("builds accumulation map for quick lookups", () => {
    const normalized = normalizePresentationSnapshot(parsed);
    const firstDay = normalized.days[0];

    expect(firstDay.charts.accumulationMap.revenue).toBeDefined();
    expect(firstDay.charts.accumulationMap.charity).toBeDefined();
  });

  it("tracks timeline series per metric", () => {
    const normalized = normalizePresentationSnapshot(parsed);
    expect(normalized.timelineSeries.revenue.length).toBe(normalized.duration);
    expect(normalized.timelineSeries.charity[normalized.timelineSeries.charity.length - 1]).toBe(
      normalized.totals.cumulativeCharity
    );
  });
});
