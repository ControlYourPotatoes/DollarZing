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
  AnchorParameters,
  coordinatesToAnchorParams,
  getAnchorKey,
} from "@/shared/presentation/anchor-config";
import { findScenarioByAnchorKey } from "@/shared/presentation/scenario-index";
import { useComparisonSelectionStore } from "./comparisonSelectionStore";

export interface ComparisonScenarios {
  base?: NormalizedPresentationScenario;
  mid?: NormalizedPresentationScenario;
  high?: NormalizedPresentationScenario;
  midId?: string;
  highId?: string;
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
  const selectedMidId = useComparisonSelectionStore((s) => s.midScenarioId);
  const selectedHighId = useComparisonSelectionStore((s) => s.highScenarioId);

  const base = activeScenarioId ? scenarios[activeScenarioId] : undefined;

  useEffect(() => {
    let cancelled = false;
    async function ensureLoaded() {
      if (!manifestIndex || !base) return;

      // Parse base coordinates to anchor params
      const baseParams = coordinatesToAnchorParams(base.coordinates);

      // Determine target entries from either explicit selections or relative defaults
      const candidates: PresentationManifestEntry[] = [];
      let midEntry: PresentationManifestEntry | undefined;
      let highEntry: PresentationManifestEntry | undefined;
      const buildTargetEntry = (growth: number) => {
        const targetParams: AnchorParameters = {
          growth,
          risk: baseParams.risk,
          charity: baseParams.charity,
        };
        const key = getAnchorKey(targetParams);
        return findScenarioByAnchorKey(manifestIndex, key);
      };

      if (selectedMidId) {
        midEntry = manifestIndex.byId.get(selectedMidId);
      } else {
        midEntry = buildTargetEntry(35);
      }
      if (selectedHighId) {
        highEntry = manifestIndex.byId.get(selectedHighId);
      } else {
        highEntry = buildTargetEntry(60);
      }

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
  }, [
    manifestIndex,
    base,
    upsertScenario,
    scenarios,
    selectedMidId,
    selectedHighId,
  ]);

  return useMemo(() => {
    if (!manifestIndex || !base) return { base };

    const baseParams = coordinatesToAnchorParams(base.coordinates);

    const buildTargetId = (growth: number) => {
      const params: AnchorParameters = {
        growth,
        risk: baseParams.risk,
        charity: baseParams.charity,
      };
      const key = getAnchorKey(params);
      return findScenarioByAnchorKey(manifestIndex, key)?.scenarioId;
    };

    // Resolve final mid/high ids: explicit overrides first, then default growth targets
    let midId: string | undefined = selectedMidId || undefined;
    let highId: string | undefined = selectedHighId || undefined;
    if (!midId) {
      midId = buildTargetId(35);
    }
    if (!highId) {
      highId = buildTargetId(60);
    }

    return {
      base,
      mid: midId ? scenarios[midId] : undefined,
      high: highId ? scenarios[highId] : undefined,
      midId,
      highId,
    };
  }, [manifestIndex, base, scenarios, selectedMidId, selectedHighId]);
}
