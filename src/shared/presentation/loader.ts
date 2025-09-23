// Patched loader.ts — adds cacheable fetchJson, thin orchestration, and convenience helpers.
// Drop-in replacement for your existing loader.ts. Keeps your validation + normalizer canonical.
import {
  PresentationSnapshotFile,
  PresentationManifest,
  NormalizedPresentationScenario,
} from "./types";
import {
  validatePresentationSnapshotFile,
  validatePresentationManifest,
  toValidationError,
  createValidationErrorWithContext,
} from "./validation";
import { normalizePresentationSnapshot } from "./normalizer";
import { buildScenarioIndex } from "./scenario-index";

// ---- Types ----
export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

// ---- Simple in-memory JSON cache (per session) ----
const __jsonCache = new Map<string, unknown>();

/**
 * Fetch JSON with optional custom fetch impl and opt-in cache.
 * - Pass a custom fetch for SSR/tests.
 * - Set useCache=false to bypass cache (e.g., dev reloads).
 */
export async function fetchJson<T = unknown>(
  url: string,
  fetchImpl?: FetchLike,
  useCache: boolean = true
): Promise<T> {
  if (useCache && __jsonCache.has(url)) {
    return __jsonCache.get(url) as T;
  }
  const fetcher = fetchImpl ?? fetch;
  const res = await fetcher(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as T;
  if (useCache) __jsonCache.set(url, json);
  return json;
}

/**
 * Load and validate a Presentation Snapshot file (raw shape).
 */
export async function loadPresentationSnapshot(
  url: string,
  fetchImpl?: FetchLike,
  useCache: boolean = true
): Promise<PresentationSnapshotFile> {
  try {
    const raw = await fetchJson<unknown>(url, fetchImpl, useCache);
    return validatePresentationSnapshotFile(raw);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Failed to fetch")) {
      throw error;
    }
    throw createValidationErrorWithContext(
      `Failed to load presentation snapshot from ${url}`,
      {
        url,
        error: toValidationError(error).message,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
      }
    );
  }
}

/**
 * Load and validate the Presentation Manifest.
 */
export async function loadPresentationManifest(
  url: string,
  fetchImpl?: FetchLike,
  useCache: boolean = true
): Promise<PresentationManifest> {
  try {
    const raw = await fetchJson<unknown>(url, fetchImpl, useCache);
    return validatePresentationManifest(raw);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Failed to fetch")) {
      throw error;
    }
    throw createValidationErrorWithContext(
      `Failed to load presentation manifest from ${url}`,
      {
        url,
        error: toValidationError(error).message,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
      }
    );
  }
}

/**
 * Normalize a validated (or unknown) snapshot into UI-ready series/shapes.
 * Accepts unknown to be flexible at call sites; validates internally.
 */
export function normalizeSnapshot(
  snapshot: PresentationSnapshotFile | unknown
): NormalizedPresentationScenario {
  return normalizePresentationSnapshot(snapshot);
}

/**
 * Convenience: load → validate → normalize in one call.
 */
export async function loadAndNormalizeSnapshot(
  url: string,
  fetchImpl?: FetchLike,
  useCache: boolean = true
): Promise<NormalizedPresentationScenario> {
  try {
    const snapshot = await loadPresentationSnapshot(url, fetchImpl, useCache);
    return normalizePresentationSnapshot(snapshot);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Failed to load presentation snapshot")
    ) {
      throw error;
    }
    throw createValidationErrorWithContext(
      `Failed to load and normalize snapshot from ${url}`,
      {
        url,
        error: toValidationError(error).message,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
      }
    );
  }
}

/**
 * Build a scenario index for fast lookup / gallery usage.
 * (Delegates to your scenario-index module.)
 */
export const createScenarioIndex = buildScenarioIndex;

// ---- Optional convenience for your current folder layout ----
const BASE = "/engine/generated-datasets/anchor-datasets";

/**
 * Load the standard manifest from your datasets base.
 */
export async function loadManifestFromBase(
  fetchImpl?: FetchLike,
  useCache: boolean = true
): Promise<PresentationManifest> {
  return loadPresentationManifest(
    `${BASE}/presentation-manifest.json`,
    fetchImpl,
    useCache
  );
}

/**
 * Load+normalize a scenario by id using the standard layout.
 */
export async function loadNormalizedScenarioFromBase(
  scenarioId: string,
  fetchImpl?: FetchLike,
  useCache: boolean = true
): Promise<NormalizedPresentationScenario> {
  return loadAndNormalizeSnapshot(
    `${BASE}/${scenarioId}/presentation-snapshots.json`,
    fetchImpl,
    useCache
  );
}

// ---- Cache management utilities ----
/**
 * Clear the in-memory cache.
 */
export function clearCache(): void {
  __jsonCache.clear();
}

/**
 * Get the current cache size.
 */
export function getCacheSize(): number {
  return __jsonCache.size;
}

/**
 * Check if a URL is cached.
 */
export function hasCached(url: string): boolean {
  return __jsonCache.has(url);
}
