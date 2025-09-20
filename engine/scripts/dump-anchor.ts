import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  createProductionSimulator,
  generateDailyAggregates,
  buildPresentationSnapshotFile,
  mapParametersToScenario,
} from '../src/index';
import {
  serializeSimulationResults,
  serializeDailySnapshots,
  serializePresentationSnapshots,
  formatEventTracesAsNdjson,
  writeDatasetArtifacts,
} from '../cli/src/orchestrator/execution/dataset-writer';
import type { DatasetArtifactContent } from '../cli/src/orchestrator/execution/dataset-writer';
import type { DatasetArtifactPaths } from '../cli/src/orchestrator/core/types';

const assembly = createProductionSimulator({
  profileOverrides: {
    name: 'anchor-001',
    config: {
      durationDays: 7,
      initialPlayerCount: 80,
      dailySeed: 'anchor-001',
      maxSimulationTimeMs: 180000,
      enableProgressReporting: false,
    },
    runtime: {
      collectDailySnapshots: true,
    },
  },
  debug: {
    enableEventTracing: true,
  },
});

const debugSessionName = 'dump-anchor-run';
assembly.debugInterface?.startSession(debugSessionName);

const results = await assembly.simulator.executeSimulation(assembly.profile.config);
const debugSession = assembly.debugInterface?.endSession() ?? null;
assembly.debugInterface?.detach();

const eventTraces = debugSession?.traces ?? [];
const dailySnapshots =
  results.dailyAggregates ?? generateDailyAggregates(results);
const presentationSnapshot = buildPresentationSnapshotFile({
  scenarioId: 'anchor-001',
  dailySnapshots,
  ...mapParametersToScenario({
    growthRate: 15,
    riskLevel: 'low',
    charityPercentage: 10,
  }),
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputDir = resolve(__dirname, '../generated-datasets/anchor-001');

const datasetJson = serializeSimulationResults(results);
const snapshotsJson =
  dailySnapshots.length > 0
    ? serializeDailySnapshots(dailySnapshots)
    : undefined;
const eventsNdjson =
  eventTraces.length > 0 ? formatEventTracesAsNdjson(eventTraces) : undefined;

const artifactPaths: DatasetArtifactPaths = {
  directory: outputDir,
  datasetFile: join(outputDir, 'dataset.json'),
  metadataFile: join(outputDir, 'metadata.json'),
  snapshotsFile: join(outputDir, 'daily-snapshots.json'),
  eventsFile: join(outputDir, 'events.ndjson'),
  presentationFile: join(outputDir, 'presentation-snapshots.json'),
};

const artifactContent: DatasetArtifactContent = {
  datasetJson,
};

if (snapshotsJson) {
  artifactContent.snapshotsJson = snapshotsJson;
}

if (eventsNdjson) {
  artifactContent.eventsNdjson = eventsNdjson;
}

artifactContent.presentationJson = serializePresentationSnapshots(
  presentationSnapshot
);

await writeDatasetArtifacts(artifactPaths, artifactContent);

console.log(`Dataset saved to ${artifactPaths.datasetFile}`);
console.log(`Daily aggregates saved to ${artifactPaths.snapshotsFile}`);
console.log('Metadata file skipped (not generated in this sample).');
if (eventsNdjson) {
  console.log(`Event trace log saved to ${artifactPaths.eventsFile}`);
} else {
  console.log('Event trace log skipped (no events recorded).');
}
console.log(`Presentation snapshots saved to ${artifactPaths.presentationFile}`);
