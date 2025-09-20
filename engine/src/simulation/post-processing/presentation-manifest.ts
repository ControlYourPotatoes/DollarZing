import { promises as fs } from "fs";
import { dirname } from "path";
import { PresentationSnapshotFile, PresentationScenarioParameters, PresentationScenarioCoordinates } from "./presentation-aggregator";

export interface PresentationManifestEntry {
  scenarioId: string;
  path: string;
  parameters: PresentationScenarioParameters;
  coordinates: PresentationScenarioCoordinates;
  days: number;
  generatedAt: string;
}

export type PresentationManifest = PresentationManifestEntry[];

export async function upsertPresentationManifest(
  manifestPath: string,
  entry: PresentationManifestEntry
): Promise<void> {
  await fs.mkdir(dirname(manifestPath), { recursive: true });

  let manifest: PresentationManifest = [];
  try {
    const existing = await fs.readFile(manifestPath, "utf8");
    manifest = JSON.parse(existing) as PresentationManifest;
  } catch (error) {
    // Ignore missing file or JSON parse errors and start fresh
  }

  const existingIndex = manifest.findIndex(
    (current) => current.scenarioId === entry.scenarioId
  );

  if (existingIndex >= 0) {
    manifest[existingIndex] = entry;
  } else {
    manifest.push(entry);
  }

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
}

export function createManifestEntry(
  scenarioId: string,
  snapshotFile: PresentationSnapshotFile,
  relativePath: string
): PresentationManifestEntry {
  return {
    scenarioId,
    path: relativePath,
    parameters: snapshotFile.parameters,
    coordinates: snapshotFile.coordinates,
    days: snapshotFile.days.length,
    generatedAt: snapshotFile.generatedAt,
  };
}
