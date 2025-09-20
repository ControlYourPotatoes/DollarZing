import { promises as fs } from "fs";
import type { DatasetMetadata, DatasetArtifactPaths } from "../core/types";
import type { SimulationResults } from "@/index";
import type { DailyAggregateSnapshot } from "@/index";
import type { PresentationSnapshotFile } from "@/index";
import type { EventTrace } from "../../../../src/events/debug/event-debugger";

export interface DatasetArtifactContent {
  datasetJson: string;
  metadataJson?: string;
  snapshotsJson?: string;
  eventsNdjson?: string;
  presentationJson?: string;
}

export function serializeSimulationResults(
  results: SimulationResults
): string {
  return serializeForJson(results);
}

export function serializeDatasetMetadata(metadata: DatasetMetadata): string {
  return serializeForJson(metadata);
}

export function serializeDailySnapshots(
  snapshots: DailyAggregateSnapshot[]
): string {
  return serializeForJson(snapshots);
}

export function serializePresentationSnapshots(
  snapshots: PresentationSnapshotFile
): string {
  return serializeForJson(snapshots);
}

export function formatEventTracesAsNdjson(traces: EventTrace[]): string {
  if (traces.length === 0) {
    return "";
  }

  return traces
    .map((trace) => {
      const sanitized = sanitizeRoot({
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
      });
      return JSON.stringify(sanitized);
    })
    .join("\n");
}

export async function writeDatasetArtifacts(
  paths: DatasetArtifactPaths,
  content: DatasetArtifactContent,
  options: { dryRun?: boolean } = {}
): Promise<void> {
  if (options.dryRun) {
    return;
  }

  await fs.mkdir(paths.directory, { recursive: true });

  const writes: Promise<void>[] = [];

  if (content.datasetJson !== undefined) {
    writes.push(fs.writeFile(paths.datasetFile, content.datasetJson, "utf8"));
  }

  if (content.metadataJson !== undefined) {
    writes.push(fs.writeFile(paths.metadataFile, content.metadataJson, "utf8"));
  }

  if (content.snapshotsJson !== undefined) {
    writes.push(fs.writeFile(paths.snapshotsFile, content.snapshotsJson, "utf8"));
  }

  if (content.eventsNdjson !== undefined && content.eventsNdjson.length > 0) {
    writes.push(fs.writeFile(paths.eventsFile, content.eventsNdjson, "utf8"));
  }

  if (content.presentationJson !== undefined) {
    writes.push(fs.writeFile(paths.presentationFile, content.presentationJson, "utf8"));
  }

  await Promise.all(writes);
}

function serializeForJson(value: unknown): string {
  return JSON.stringify(sanitizeRoot(value), null, 2);
}

function sanitizeRoot(value: unknown): unknown {
  const seen = new WeakSet<object>();
  return sanitizeValue(value, seen);
}

function sanitizeValue(
  value: unknown,
  seen: WeakSet<object>
): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    return 0;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return undefined;
    }
    seen.add(value as object);
    const result = value.map((entry) => sanitizeValue(entry, seen));
    seen.delete(value as object);
    return result;
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) {
      return undefined;
    }
    seen.add(value);
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === "function" || entry === undefined) {
        continue;
      }
      result[key] = sanitizeValue(entry, seen);
    }
    seen.delete(value);
    return result;
  }

  return value;
}
