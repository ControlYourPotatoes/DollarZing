import { useEffect, useMemo } from "react";

import {
  NormalizedPresentationScenario,
  PresentationManifestEntry,
} from "@/shared/presentation";
import { usePresentationTimelineStore } from "./presentationTimelineStore";
import { loadPresentationSnapshot } from "@/shared/presentation";
import { resolveSnapshotUrl } from "@/shared/presentation/url-resolver";
import { getCoordinateKey } from "@/shared/presentation/scenario-index";

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
  const manifest = usePresentationTimelineStore((s) => s.manifest);
  const scenarios = usePresentationTimelineStore((s) => s.scenarios);
  const activeScenarioId = usePresentationTimelineStore((s) => s.activeScenarioId);
  const upsertScenario = usePresentationTimelineStore((s) => s.upsertScenario);

  const base = activeScenarioId ? scenarios[activeScenarioId] : undefined;

  useEffect(() => {
    let cancelled = false;
    async function ensureLoaded() {
      if (!manifest || !base) return;
      const charity = base.coordinates.charityShare;
      const mk = (a: number, c: number) => getCoordinateKey({
        adoptionRate: a,
        cashOutStrategy: c,
        charityShare: charity,
      });
      const candidates: PresentationManifestEntry[] = [];
      const midEntry = manifest.byCoordinateKey.get(mk(0.5, 0.5));
      const highEntry = manifest.byCoordinateKey.get(mk(1, 1));
      if (midEntry) candidates.push(midEntry);
      if (highEntry) candidates.push(highEntry);

      for (const entry of candidates) {
        if (cancelled) return;
        if (scenarios[entry.scenarioId]) continue;
        try {
          const snapshot = await loadPresentationSnapshot(resolveSnapshotUrl(entry));
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
  }, [manifest, base, upsertScenario, scenarios]);

  return useMemo(() => {
    if (!manifest || !base) return { base };
    const charity = base.coordinates.charityShare;
    const mk = (a: number, c: number) => getCoordinateKey({
      adoptionRate: a,
      cashOutStrategy: c,
      charityShare: charity,
    });
    const midId = manifest.byCoordinateKey.get(mk(0.5, 0.5))?.scenarioId;
    const highId = manifest.byCoordinateKey.get(mk(1, 1))?.scenarioId;
    return {
      base,
      mid: midId ? scenarios[midId] : undefined,
      high: highId ? scenarios[highId] : undefined,
    };
  }, [manifest, base, scenarios]);
}

