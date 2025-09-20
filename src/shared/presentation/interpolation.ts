import {
  InterpolationAnchor,
  InterpolationResult,
  PresentationScenarioCoordinates,
  ScenarioIndex,
  PresentationManifestEntry,
} from "./types";
import {
  findNearestCoordinate,
  computeCoordinateKey,
  findScenarioByCoordinates,
} from "./scenario-index";

interface AxisLookupResult {
  lower: number;
  upper: number;
  ratio: number;
}

function combinations<T>(values: T[][]): T[][] {
  return values.reduce<T[][]>((acc, current) => {
    if (acc.length === 0) {
      return current.map((value) => [value]);
    }
    const next: T[][] = [];
    for (const prefix of acc) {
      for (const value of current) {
        next.push([...prefix, value]);
      }
    }
    return next;
  }, []);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeWeights(anchors: InterpolationAnchor[]): InterpolationAnchor[] {
  const totalWeight = anchors.reduce((sum, anchor) => sum + anchor.weight, 0);
  if (totalWeight === 0) {
    return anchors.map((anchor) => ({ ...anchor, weight: 0 }));
  }
  return anchors.map((anchor) => ({
    ...anchor,
    weight: anchor.weight / totalWeight,
  }));
}

function fallbackToNearest(
  index: ScenarioIndex,
  requested: PresentationScenarioCoordinates
): InterpolationResult {
  let nearest: PresentationManifestEntry | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const entry of index.byId.values()) {
    const distance = Math.sqrt(
      (entry.coordinates.adoptionRate - requested.adoptionRate) ** 2 +
        (entry.coordinates.cashOutStrategy - requested.cashOutStrategy) ** 2 +
        (entry.coordinates.charityShare - requested.charityShare) ** 2
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = entry;
    }
  }

  if (!nearest) {
    throw new Error("Scenario manifest is empty; cannot determine nearest anchor");
  }

  return {
    anchors: [
      {
        scenarioId: nearest.scenarioId,
        weight: 1,
        entry: nearest,
      },
    ],
    requested,
    exactMatch:
      nearest.coordinates.adoptionRate === requested.adoptionRate &&
      nearest.coordinates.cashOutStrategy === requested.cashOutStrategy &&
      nearest.coordinates.charityShare === requested.charityShare,
  };
}

export function computeInterpolationAnchors(
  index: ScenarioIndex,
  requested: PresentationScenarioCoordinates
): InterpolationResult {
  const adoptionLookup: AxisLookupResult = findNearestCoordinate(
    index.axes.adoptionRate,
    clamp(requested.adoptionRate, 0, 1)
  );
  const riskLookup: AxisLookupResult = findNearestCoordinate(
    index.axes.cashOutStrategy,
    clamp(requested.cashOutStrategy, 0, 1)
  );
  const charityLookup: AxisLookupResult = findNearestCoordinate(
    index.axes.charityShare,
    clamp(requested.charityShare, 0, 1)
  );

  const adoptionCandidates = [adoptionLookup.lower];
  if (adoptionLookup.upper !== adoptionLookup.lower) {
    adoptionCandidates.push(adoptionLookup.upper);
  }

  const riskCandidates = [riskLookup.lower];
  if (riskLookup.upper !== riskLookup.lower) {
    riskCandidates.push(riskLookup.upper);
  }

  const charityCandidates = [charityLookup.lower];
  if (charityLookup.upper !== charityLookup.lower) {
    charityCandidates.push(charityLookup.upper);
  }

  const coordinateTriples = combinations<number>([
    adoptionCandidates,
    riskCandidates,
    charityCandidates,
  ]);

  const anchors: InterpolationAnchor[] = [];

  for (const triple of coordinateTriples) {
    const [adoption, risk, charity] = triple;
    const entry = findScenarioByCoordinates(index, {
      adoptionRate: adoption,
      cashOutStrategy: risk,
      charityShare: charity,
    });

    if (!entry) {
      continue;
    }

    const adoptionWeight =
      adoptionLookup.upper === adoptionLookup.lower
        ? 1
        : adoption === adoptionLookup.lower
        ? 1 - adoptionLookup.ratio
        : adoptionLookup.ratio;
    const riskWeight =
      riskLookup.upper === riskLookup.lower
        ? 1
        : risk === riskLookup.lower
        ? 1 - riskLookup.ratio
        : riskLookup.ratio;
    const charityWeight =
      charityLookup.upper === charityLookup.lower
        ? 1
        : charity === charityLookup.lower
        ? 1 - charityLookup.ratio
        : charityLookup.ratio;

    const weight = adoptionWeight * riskWeight * charityWeight;

    anchors.push({
      scenarioId: entry.scenarioId,
      weight,
      entry,
    });
  }

  if (anchors.length === 0) {
    return fallbackToNearest(index, requested);
  }

  const normalizedAnchors = normalizeWeights(anchors);

  const exactMatch = normalizedAnchors.length === 1 && normalizedAnchors[0].weight === 1;

  return {
    anchors: normalizedAnchors,
    requested,
    exactMatch,
  };
}

export function pickBestAnchor(
  result: InterpolationResult
): PresentationManifestEntry {
  if (result.anchors.length === 0) {
    throw new Error("Interpolation result contains no anchors");
  }

  const [best] = result.anchors;
  return best.entry;
}

export function describeInterpolation(result: InterpolationResult): string {
  const { anchors, requested } = result;
  if (result.exactMatch) {
    return `Exact anchor match for (${requested.adoptionRate}, ${requested.cashOutStrategy}, ${requested.charityShare}) → ${anchors[0].scenarioId}`;
  }

  const parts = anchors
    .map(
      (anchor) => `${anchor.scenarioId} (${anchor.weight.toFixed(3)})`
    )
    .join(", ");
  return `Interpolated anchors for (${requested.adoptionRate}, ${requested.cashOutStrategy}, ${requested.charityShare}): ${parts}`;
}

