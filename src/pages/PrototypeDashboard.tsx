import { useCallback, useEffect, useMemo, useState } from "react";

import {
  loadPresentationManifest,
  loadPresentationSnapshot,
} from "@/shared/presentation";
import type { PresentationManifestEntry } from "@/shared/presentation";
import {
  resolveSnapshotUrl,
  resolvePublicPath,
  joinUrl,
  defaultDatasetsBase,
} from "@/shared/presentation/url-resolver";
import { usePresentationTimelineStore } from "@/shared/hooks/presentationTimelineStore";
import { TimelineScrubber, useActiveTimelineDay } from "@/features/timeline";
import { FinancialWorkflowDiagram } from "@/features/financial-flow";
import {
  LevelBarometer,
  DailyFlow,
  RevenueProgressionChart,
  PlayerEngagementChart,
} from "@/features/distribution-charts";
import { ImpactDisplay } from "@/features/impact";
// import { useActiveTimelineScenario } from "@/features/timeline";
import ScenarioSelector from "@/components/ScenarioSelector";

// Optional runtime overrides to fetch manifest/snapshots from an external base or per-scenario URLs
const { VITE_PRESENTATION_MANIFEST_URL } = ((
  import.meta as unknown as {
    env?: Record<string, string | undefined>;
  }
).env ?? {}) as Record<string, string | undefined>;

const MANIFEST_CANDIDATES: string[] = [
  VITE_PRESENTATION_MANIFEST_URL
    ? resolvePublicPath(VITE_PRESENTATION_MANIFEST_URL)
    : "",
  joinUrl(defaultDatasetsBase(), "anchor-datasets/presentation-manifest.json"),
  joinUrl(defaultDatasetsBase(), "presentation-manifest.json"),
].filter(Boolean);

const PrototypeDashboard = () => {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  // Fixed scenarios - base is always 15%, mid is 35%, high is 60%
  // All have mid risk and 30% charity
  const availableScenarios = [
    { 
      id: "growth-15", 
      growth: 15, 
      risk: "mid", 
      charity: 30, 
      role: "base" as const,
      label: "Base"
    },
    { 
      id: "growth-35", 
      growth: 35, 
      risk: "mid", 
      charity: 30, 
      role: "mid" as const,
      label: "Mid"
    },
    { 
      id: "growth-60", 
      growth: 60, 
      risk: "mid", 
      charity: 30, 
      role: "high" as const,
      label: "High"
    },
  ];

  const loadManifest = usePresentationTimelineStore(
    (state) => state.loadManifest
  );
  const upsertScenario = usePresentationTimelineStore(
    (state) => state.upsertScenario
  );
  const setActiveScenario = usePresentationTimelineStore(
    (state) => state.setActiveScenario
  );
  const setActiveDay = usePresentationTimelineStore(
    (state) => state.setActiveDay
  );
  const manifestIndex = usePresentationTimelineStore((state) => state.index);
  const scenarios = usePresentationTimelineStore((state) => state.scenarios);
  const activeScenarioId = usePresentationTimelineStore(
    (state) => state.activeScenarioId
  );

  const activeDay = useActiveTimelineDay();
  // const activeScenario = useActiveTimelineScenario();

  const manifestEntries = useMemo(
    () => manifestIndex?.manifest ?? [],
    [manifestIndex]
  );

  const selectedScenarioId =
    activeScenarioId ?? availableScenarios[0]?.id ?? "";

  const ensureScenarioLoaded = useCallback(
    async (entry: PresentationManifestEntry) => {
      if (scenarios[entry.scenarioId]) {
        return;
      }
      const snapshot = await loadPresentationSnapshot(
        resolveSnapshotUrl(entry)
      );
      upsertScenario(snapshot);
    },
    [scenarios, upsertScenario]
  );

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      setStatus("loading");
      try {
        let manifest: PresentationManifestEntry[] | null = null;
        let lastErr: unknown = null;
        for (const url of MANIFEST_CANDIDATES) {
          try {
            manifest = await loadPresentationManifest(url);
            break;
          } catch (e) {
            lastErr = e;
          }
        }
        if (!manifest) {
          throw lastErr || new Error("Unable to load presentation manifest");
        }
        if (cancelled) return;
        loadManifest(manifest);
        const firstScenario = availableScenarios[0];
        if (firstScenario) {
          // Use the direct mapping to get the correct scenario ID
          const scenarioIdMap: Record<string, string> = {
            "growth-15": "growth-15_risk-mid_charity-30",
            "growth-35": "growth-35_risk-mid_charity-30",
            "growth-60": "growth-60_risk-mid_charity-30",
          };

          const targetScenarioId = scenarioIdMap[firstScenario.id];
          if (targetScenarioId) {
            const targetEntry = manifest.find(entry => entry.scenarioId === targetScenarioId);
            if (targetEntry) {
              await ensureScenarioLoaded(targetEntry);
              if (cancelled) return;
              setActiveScenario(targetScenarioId);
              setActiveDay(0);
            }
          }
        }
        setStatus("idle");
      } catch (err) {
        if (cancelled) return;
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [ensureScenarioLoaded, loadManifest, setActiveDay, setActiveScenario]);

  const handleScenarioChange = useCallback(
    async (scenarioId: string) => {
      if (!manifestIndex) return;

      // Direct mapping to the specific scenario IDs we want
      const scenarioIdMap: Record<string, string> = {
        "growth-15": "growth-15_risk-mid_charity-30",
        "growth-35": "growth-35_risk-mid_charity-30",
        "growth-60": "growth-60_risk-mid_charity-30",
      };

      const targetScenarioId = scenarioIdMap[scenarioId];
      if (!targetScenarioId) return;

      const targetEntry = manifestIndex.byId.get(targetScenarioId);
      if (!targetEntry) return;

      await ensureScenarioLoaded(targetEntry);
      setActiveScenario(targetScenarioId);
      setActiveDay(0);
    },
    [ensureScenarioLoaded, manifestIndex, setActiveDay, setActiveScenario]
  );

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 pb-28 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500">
            DollarZing Presentation
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-3xl font-semibold tracking-tight">
              Snapshot Playback Sandbox
            </h1>
            <ScenarioSelector
              scenarios={availableScenarios}
              selectedScenarioId={selectedScenarioId}
              onScenarioChange={handleScenarioChange}
              disabled={status === "loading" || manifestEntries.length === 0}
              variant="inline"
            />
          </div>
          <p className="text-slate-400">
            Timeline scrubber and financial workflow powered by pregenerated
            presentation snapshots.
          </p>
        </header>

        {/* Impact Display */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <ImpactDisplay
            cumulativeCharity={
              activeDay?.timelineTick.cumulativeCharity ?? null
            }
          />
        </div>

        {/* Floating TimelineScrubber is rendered globally; remove embedded card */}

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <FinancialWorkflowDiagram />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <PlayerEngagementChart />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <RevenueProgressionChart />
            </div>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">
                Daily Flow
              </h2>
              <DailyFlow />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <LevelBarometer />
            </div>
          </aside>
        </section>
      </div>
      {/* Floating timeline scrubber */}
      <TimelineScrubber />
    </div>
  );
};

export default PrototypeDashboard;
