import {
  PresentationSnapshotFile,
  PresentationManifest,
  NormalizedPresentationScenario,
} from "./types";
import {
  validatePresentationSnapshotFile,
  validatePresentationManifest,
} from "./validation";
import { normalizePresentationSnapshot } from "./normalizer";
import { buildScenarioIndex } from "./scenario-index";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function fetchJson(
  url: string,
  fetchImpl: FetchLike = fetch
): Promise<unknown> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function loadPresentationSnapshot(
  url: string,
  fetchImpl?: FetchLike
): Promise<PresentationSnapshotFile> {
  const json = await fetchJson(url, fetchImpl);
  return validatePresentationSnapshotFile(json);
}

export async function loadPresentationManifest(
  url: string,
  fetchImpl?: FetchLike
): Promise<PresentationManifest> {
  const json = await fetchJson(url, fetchImpl);
  return validatePresentationManifest(json);
}

export function normalizeSnapshot(
  snapshot: PresentationSnapshotFile | unknown
): NormalizedPresentationScenario {
  return normalizePresentationSnapshot(snapshot);
}

export async function loadAndNormalizeSnapshot(
  url: string,
  fetchImpl?: FetchLike
): Promise<NormalizedPresentationScenario> {
  const snapshot = await loadPresentationSnapshot(url, fetchImpl);
  return normalizePresentationSnapshot(snapshot);
}

export const createScenarioIndex = buildScenarioIndex;

