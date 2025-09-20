import { promises as fs } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  createProductionSimulator,
  generateDailyAggregates,
} from '../src/index';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputDir = resolve(__dirname, '../generated-datasets/anchor-001');

await fs.mkdir(outputDir, { recursive: true });

const datasetPath = join(outputDir, 'dataset.json');
const snapshotsPath = join(outputDir, 'daily-snapshots.json');
const eventsPath = join(outputDir, 'events.ndjson');

await Promise.all([
  fs.writeFile(datasetPath, JSON.stringify(results, null, 2), 'utf8'),
  fs.writeFile(snapshotsPath, JSON.stringify(dailySnapshots, null, 2), 'utf8'),
  fs.writeFile(eventsPath, formatEventTracesAsNdjson(eventTraces), 'utf8'),
]);

console.log(`Dataset saved to ${datasetPath}`);
console.log(`Daily aggregates saved to ${snapshotsPath}`);
console.log(`Event trace log saved to ${eventsPath}`);

function formatEventTracesAsNdjson(traces: any[]): string {
  if (!traces.length) {
    return '';
  }

  return traces
    .map((trace) =>
      JSON.stringify({
        id: trace.id,
        type: trace.eventType,
        timestamp: new Date(trace.timestamp ?? Date.now()).toISOString(),
        durationMs: trace.duration ?? null,
        status: trace.status ?? null,
        source: trace.source ?? null,
        correlationId: trace.correlationId ?? null,
        parentEventId: trace.parentEventId ?? null,
        children: trace.children ?? [],
        data: trace.data ?? null,
      })
    )
    .join('\n');
}
