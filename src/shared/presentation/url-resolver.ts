// Utilities to resolve dataset URLs based on manifest entries and Vite env

import { PresentationManifestEntry } from "./types";

// Respect Vite base (e.g., "/DollarZing/") so public assets resolve correctly in dev/prod
const DEFAULT_PUBLIC_BASE =
  (((import.meta as any).env ?? {}) as Record<string, string | undefined>)[
    "BASE_URL"
  ] || "/";

const {
  VITE_PRESENTATION_BASE_URL,
  VITE_PRESENTATION_OVERRIDES,
} = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;

export function joinUrl(base: string, path: string): string {
  const left = base.endsWith("/") ? base.slice(0, -1) : base;
  const right = path.startsWith("/") ? path.slice(1) : path;
  return `${left}/${right}`;
}

export function resolvePublicPath(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return joinUrl(DEFAULT_PUBLIC_BASE, url);
}

export function defaultDatasetsBase(): string {
  const base = VITE_PRESENTATION_BASE_URL
    ? resolvePublicPath(VITE_PRESENTATION_BASE_URL)
    : joinUrl(DEFAULT_PUBLIC_BASE, "engine/generated-datasets/");
  return base;
}

/**
 * Resolve a snapshot URL for a manifest entry, considering optional env overrides.
 */
export function resolveSnapshotUrl(entry: PresentationManifestEntry): string {
  // Highest priority: explicit per-scenario override map (JSON string mapping scenarioId -> URL)
  if (VITE_PRESENTATION_OVERRIDES) {
    try {
      const map = JSON.parse(VITE_PRESENTATION_OVERRIDES) as Record<string, string>;
      const override = map[entry.scenarioId];
      if (override) return resolvePublicPath(override);
    } catch {
      // Ignore malformed override map
    }
  }

  const base = defaultDatasetsBase();
  // 1) Use manifest-provided path under base
  const viaPath = joinUrl(base, entry.path);
  // 2) Fallback: derive from scenarioId
  const viaId = joinUrl(
    base,
    `anchor-datasets/${entry.scenarioId}/presentation-snapshots.json`
  );
  return viaPath || viaId;
}

