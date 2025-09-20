import {
  PresentationManifest,
  PresentationManifestEntry,
  PresentationScenarioCoordinates,
  ScenarioIndex,
} from "./types";
import {
  validatePresentationManifest,
  assertCoordinatesInRange,
  toValidationError,
} from "./validation";

const COORDINATE_PRECISION = 3;

function toCoordinateKey(coordinates: PresentationScenarioCoordinates): string {
  return [
    coordinates.adoptionRate,
    coordinates.cashOutStrategy,
    coordinates.charityShare,
  ]
    .map((value) => value.toFixed(COORDINATE_PRECISION))
    .join("|");
}

function dedupeAndSort(values: number[]): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

export function buildScenarioIndex(input: unknown): ScenarioIndex {
  try {
    const manifest: PresentationManifest = validatePresentationManifest(input);

    const byId = new Map<string, PresentationManifestEntry>();
    const byCoordinateKey = new Map<string, PresentationManifestEntry>();

    for (const entry of manifest) {
      if (byId.has(entry.scenarioId)) {
        throw new Error(`Duplicate scenarioId detected: ${entry.scenarioId}`);
      }
      assertCoordinatesInRange(entry.coordinates, `manifest(${entry.scenarioId})`);

      const key = toCoordinateKey(entry.coordinates);
      byId.set(entry.scenarioId, entry);

      if (byCoordinateKey.has(key)) {
        const existing = byCoordinateKey.get(key)!;
        throw new Error(
          `Duplicate coordinate mapping detected for ${key} (${existing.scenarioId} vs ${entry.scenarioId})`
        );
      }
      byCoordinateKey.set(key, entry);
    }

    const axes = {
      adoptionRate: dedupeAndSort(manifest.map((entry) => entry.coordinates.adoptionRate)),
      cashOutStrategy: dedupeAndSort(
        manifest.map((entry) => entry.coordinates.cashOutStrategy)
      ),
      charityShare: dedupeAndSort(manifest.map((entry) => entry.coordinates.charityShare)),
    };

    if (axes.adoptionRate.length === 0) {
      throw new Error("Manifest does not contain any adoptionRate coordinate values");
    }

    return {
      manifest,
      axes,
      byId,
      byCoordinateKey,
    };
  } catch (error) {
    throw toValidationError(error);
  }
}

export function findScenarioById(
  index: ScenarioIndex,
  scenarioId: string
): PresentationManifestEntry | undefined {
  return index.byId.get(scenarioId);
}

export function findScenarioByCoordinates(
  index: ScenarioIndex,
  coordinates: PresentationScenarioCoordinates
): PresentationManifestEntry | undefined {
  const key = toCoordinateKey(coordinates);
  return index.byCoordinateKey.get(key);
}

export function getCoordinateKey(
  coordinates: PresentationScenarioCoordinates
): string {
  return toCoordinateKey(coordinates);
}

export function listScenarioIds(index: ScenarioIndex): string[] {
  return Array.from(index.byId.keys()).sort();
}

export function findNearestCoordinate(
  axisValues: number[],
  target: number
): { lower: number; upper: number; ratio: number } {
  if (axisValues.length === 0) {
    throw new Error("Axis configuration is empty");
  }

  if (axisValues.length === 1) {
    return { lower: axisValues[0], upper: axisValues[0], ratio: 0 };
  }

  let lower = axisValues[0];
  let upper = axisValues[axisValues.length - 1];

  for (let i = 0; i < axisValues.length - 1; i += 1) {
    const start = axisValues[i];
    const end = axisValues[i + 1];

    if (target <= start) {
      lower = start;
      upper = start;
      break;
    }

    if (target >= end) {
      lower = end;
      upper = end;
      continue;
    }

    if (target >= start && target <= end) {
      lower = start;
      upper = end;
      break;
    }
  }

  const delta = upper - lower;
  const ratio = delta === 0 ? 0 : (target - lower) / delta;
  return { lower, upper, ratio: Math.min(Math.max(ratio, 0), 1) };
}

export function computeCoordinateKey(
  adoptionRate: number,
  cashOutStrategy: number,
  charityShare: number
): string {
  return toCoordinateKey({
    adoptionRate,
    cashOutStrategy,
    charityShare,
  });
}
