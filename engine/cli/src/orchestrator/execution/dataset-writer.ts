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

type SanitizerFrame =
  | {
      phase: "enter";
      parent: Record<string, unknown> | unknown[] | { result: unknown };
      key: string | number;
      value: unknown;
    }
  | { phase: "exit"; value: object };

function sanitizeRoot(value: unknown): unknown {
  const seen = new WeakSet<object>();
  const rootHolder: { result: unknown } = { result: undefined };
  const stack: SanitizerFrame[] = [
    { phase: "enter", parent: rootHolder, key: "result", value },
  ];

  while (stack.length > 0) {
    const frame = stack.pop()!;

    if (frame.phase === "exit") {
      seen.delete(frame.value);
      continue;
    }

    const { parent, key, value: current } = frame;

    if (current instanceof Date) {
      (parent as any)[key] = current.toISOString();
      continue;
    }

    if (typeof current === "bigint") {
      (parent as any)[key] = Number(current);
      continue;
    }

    if (typeof current === "number" && !Number.isFinite(current)) {
      (parent as any)[key] = 0;
      continue;
    }

    if (Array.isArray(current)) {
      if (seen.has(current)) {
        (parent as any)[key] = undefined;
        continue;
      }

      const clone: unknown[] = new Array(current.length);
      (parent as any)[key] = clone;
      seen.add(current);
      stack.push({ phase: "exit", value: current });

      for (let i = current.length - 1; i >= 0; i -= 1) {
        stack.push({ phase: "enter", parent: clone, key: i, value: current[i] });
      }
      continue;
    }

    if (current && typeof current === "object") {
      if (seen.has(current)) {
        (parent as any)[key] = undefined;
        continue;
      }

      const clone: Record<string, unknown> = {};
      (parent as any)[key] = clone;
      seen.add(current);
      stack.push({ phase: "exit", value: current });

      const entries = Object.entries(current as Record<string, unknown>);
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        const [childKey, childValue] = entries[i];
        if (typeof childValue === "function" || childValue === undefined) {
          continue;
        }
        stack.push({
          phase: "enter",
          parent: clone,
          key: childKey,
          value: childValue,
        });
      }
      continue;
    }

    (parent as any)[key] = current;
  }

  return rootHolder.result;
}
