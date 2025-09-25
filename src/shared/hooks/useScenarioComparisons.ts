import { useEffect, useMemo } from "react";

import {
  NormalizedPresentationScenario,
  PresentationManifestEntry,
} from "@/shared/presentation";
import { usePresentationTimelineStore } from "./presentationTimelineStore";
import { loadPresentationSnapshot } from "@/shared/presentation";
import { resolveSnapshotUrl } from "@/shared/presentation/url-resolver";
// Remove getCoordinateKey import, add anchor imports
import {
  coordinatesToAnchorParams,
  getRelativeAnchor,
  getAnchorKey,
  AnchorParameters,
} from "@/shared/presentation/anchor-config";
import { findScenarioByAnchorKey } from "@/shared/presentation/scenario-index";

export interface ComparisonScenarios {
  base?: NormalizedPresentationScenario;
  mid?: NormalizedPresentationScenario;
  high?: NormalizedPresentationScenario;
}

/**
 * Ensure the Mid/High comparison scenarios (same charityShare, mid/mid and high/high)
 * are loaded alongside the active scenario. Returns references if present.
 */
export function useScenarioComparisons(): ComparisonScenarios {
  const manifestIndex = usePresentationTimelineStore((s) => s.index); // Assuming store has updated index with byAnchorKey
  const scenarios = usePresentationTimelineStore((s) => s.scenarios);
  const activeScenarioId = usePresentationTimelineStore(
    (s) => s.activeScenarioId
  );
  const upsertScenario = usePresentationTimelineStore((s) => s.upsertScenario);

  const base = activeScenarioId ? scenarios[activeScenarioId] : undefined;

  useEffect(() => {
    let cancelled = false;
    async function ensureLoaded() {
      if (!manifestIndex || !base) return;

      // Parse base coordinates to anchor params
      const baseParams = coordinatesToAnchorParams(base.coordinates);

      // Compute relative anchor params (keep base charity)
      const midParams = getRelativeAnchor(baseParams, "mid");
      const highParams = getRelativeAnchor(baseParams, "high");

      // Generate anchor keys
      const midKey = getAnchorKey(midParams);
      const highKey = getAnchorKey(highParams);

      const candidates: PresentationManifestEntry[] = [];
      const midEntry = findScenarioByAnchorKey(manifestIndex, midKey);
      const highEntry = findScenarioByAnchorKey(manifestIndex, highKey);

      if (midEntry) candidates.push(midEntry);
      if (highEntry) candidates.push(highEntry);

      for (const entry of candidates) {
        if (cancelled) return;
        if (scenarios[entry.scenarioId]) continue;
        try {
          const snapshot = await loadPresentationSnapshot(
            resolveSnapshotUrl(entry)
          );
          if (cancelled) return;
          upsertScenario(snapshot);
        } catch (err) {
          // Non-fatal: skip missing comparison datasets
          // console.warn("Failed to load comparison scenario", entry.scenarioId, err);
        }
      }
    }
    ensureLoaded();
    return () => {
      cancelled = true;
    };
  }, [manifestIndex, base, upsertScenario, scenarios]);

  return useMemo(() => {
    if (!manifestIndex || !base) return { base };

    // Parse base params
    const baseParams = coordinatesToAnchorParams(base.coordinates);

    // Compute relative anchors
    const midParams = getRelativeAnchor(baseParams, "mid");
    const highParams = getRelativeAnchor(baseParams, "high");

    // Generate keys and lookup
    const midKey = getAnchorKey(midParams);
    const highKey = getAnchorKey(highParams);

    const midEntry = findScenarioByAnchorKey(manifestIndex, midKey);
    const highEntry = findScenarioByAnchorKey(manifestIndex, highKey);

    const midId = midEntry?.scenarioId;
    const highId = highEntry?.scenarioId;

    return {
      base,
      mid: midId ? scenarios[midId] : undefined,
      high: highId ? scenarios[highId] : undefined,
    };
  }, [manifestIndex, base, scenarios]);
}
