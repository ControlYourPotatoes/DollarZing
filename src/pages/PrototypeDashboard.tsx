import { useCallback, useEffect, useMemo, useState } from "react";

import { loadPresentationManifest, loadPresentationSnapshot } from "@/shared/presentation";
import type { PresentationManifestEntry } from "@/shared/presentation";
import { resolveSnapshotUrl, resolvePublicPath, joinUrl, defaultDatasetsBase } from "@/shared/presentation/url-resolver";
import { usePresentationTimelineStore } from "@/shared/hooks/presentationTimelineStore";
import { TimelineScrubber, useActiveTimelineDay } from "@/features/timeline";
import { FinancialWorkflowDiagram } from "@/features/financial-flow";
// import { useActiveTimelineScenario } from "@/features/timeline";
import { useComparisonSelectionStore } from "@/shared/hooks/comparisonSelectionStore";

// Optional runtime overrides to fetch manifest/snapshots from an external base or per-scenario URLs
const { VITE_PRESENTATION_MANIFEST_URL } = (
  (import.meta as any).env ?? {}
) as Record<string, string | undefined>;

const MANIFEST_CANDIDATES: string[] = [
  VITE_PRESENTATION_MANIFEST_URL ? resolvePublicPath(VITE_PRESENTATION_MANIFEST_URL) : "",
  joinUrl(defaultDatasetsBase(), "anchor-datasets/presentation-manifest.json"),
  joinUrl(defaultDatasetsBase(), "presentation-manifest.json"),
].filter(Boolean);

const PrototypeDashboard = () => {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

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
  const midSelection = useComparisonSelectionStore((s) => s.midScenarioId);
  const highSelection = useComparisonSelectionStore((s) => s.highScenarioId);
  const setMidSelection = useComparisonSelectionStore((s) => s.setMidScenarioId);
  const setHighSelection = useComparisonSelectionStore((s) => s.setHighScenarioId);

  const manifestEntries = useMemo(
    () => manifestIndex?.manifest ?? [],
    [manifestIndex]
  );

  const sortOrder = { low: 0, mid: 1, high: 2 } as const;
  const sortedManifestEntries = useMemo(() => {
    const list = [...manifestEntries];
    list.sort((a, b) => {
      const ag = sortOrder[(a.parameters.adoptionRate as "low" | "mid" | "high") ?? "low"] ?? 0;
      const bg = sortOrder[(b.parameters.adoptionRate as "low" | "mid" | "high") ?? "low"] ?? 0;
      if (ag !== bg) return ag - bg; // growth: low → mid → high

      const ar = sortOrder[(a.parameters.cashOutStrategy as "low" | "mid" | "high") ?? "low"] ?? 0;
      const br = sortOrder[(b.parameters.cashOutStrategy as "low" | "mid" | "high") ?? "low"] ?? 0;
      if (ar !== br) return ar - br; // risk: low → mid → high

      const ac = parseInt(String(a.parameters.charityShare ?? "0"), 10);
      const bc = parseInt(String(b.parameters.charityShare ?? "0"), 10);
      return ac - bc; // charity: 10 → 20 → 30
    });
    return list;
  }, [manifestEntries]);
  const selectedScenarioId =
    activeScenarioId ?? sortedManifestEntries[0]?.scenarioId ?? "";

  const formatScenarioLabel = useCallback((entry: PresentationManifestEntry) => {
    const growth = String(entry.parameters.adoptionRate || "").toUpperCase();
    const risk = String(entry.parameters.cashOutStrategy || "");
    const charity = String(entry.parameters.charityShare || "");
    return `${growth} growth · ${risk} risk · ${charity}% charity`;
  }, []);

  const comparisonOptions = useMemo(
    () => sortedManifestEntries.filter((e) => e.scenarioId !== selectedScenarioId),
    [sortedManifestEntries, selectedScenarioId]
  );

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
      setError(null);
      try {
        let manifest: any = null;
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
        const index = loadManifest(manifest);
        const firstEntry = index.manifest[0];
        if (firstEntry) {
          await ensureScenarioLoaded(firstEntry);
          if (cancelled) return;
          setActiveScenario(firstEntry.scenarioId);
          setActiveDay(0);
        }
        setStatus("idle");
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load presentation data"
        );
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
      const entry = manifestIndex.byId.get(scenarioId);
      if (!entry) return;
      await ensureScenarioLoaded(entry);
      setActiveScenario(scenarioId);
      setActiveDay(0);
    },
    [ensureScenarioLoaded, manifestIndex, setActiveDay, setActiveScenario]
  );

  // Ensure currently selected comparison scenarios are loaded if chosen
  useEffect(() => {
    if (!manifestIndex) return;
    (async () => {
      if (midSelection) {
        const entry = manifestIndex.byId.get(midSelection);
        if (entry) await ensureScenarioLoaded(entry);
      }
      if (highSelection) {
        const entry = manifestIndex.byId.get(highSelection);
        if (entry) await ensureScenarioLoaded(entry);
      }
    })();
  }, [ensureScenarioLoaded, highSelection, manifestIndex, midSelection]);

  const stats = useMemo(() => {
    if (!activeDay) {
      return null;
    }
    return [
      {
        label: "Active Players",
        value: activeDay.timelineTick.cumulativePlayers.toLocaleString(),
      },
      {
        label: "Cumulative Revenue",
        value: `$${activeDay.timelineTick.cumulativeRevenue.toLocaleString(
          undefined,
          {
            maximumFractionDigits: 0,
          }
        )}`,
      },
      {
        label: "Cumulative Charity",
        value: `$${activeDay.timelineTick.cumulativeCharity.toLocaleString(
          undefined,
          {
            maximumFractionDigits: 0,
          }
        )}`,
      },
    ];
  }, [activeDay]);

  // Keep selections valid if baseline changes to one of the selected comparisons
  useEffect(() => {
    if (midSelection === selectedScenarioId) setMidSelection(null);
    if (highSelection === selectedScenarioId) setHighSelection(null);
  }, [highSelection, midSelection, selectedScenarioId, setHighSelection, setMidSelection]);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 pb-28 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-slate-500">
                DollarZing Presentation
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">
                Snapshot Playback Sandbox
              </h1>
              <p className="text-slate-400">
                Timeline scrubber and financial workflow powered by pregenerated
                presentation snapshots.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
              <label
                htmlFor="scenario"
                className="block text-xs uppercase tracking-widest text-slate-400"
              >
                Scenario
              </label>
              <select
                id="scenario"
                className="mt-1 w-72 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                value={selectedScenarioId}
                onChange={(event) => handleScenarioChange(event.target.value)}
                disabled={status === "loading" || manifestEntries.length === 0}
              >
                {sortedManifestEntries.map((entry) => (
                  <option key={entry.scenarioId} value={entry.scenarioId}>
                    {entry.parameters.adoptionRate.toUpperCase()} growth ·{" "}
                    {entry.parameters.cashOutStrategy} risk ·{" "}
                    {entry.parameters.charityShare}% charity
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
              <span className="block text-sm font-bold uppercase tracking-widest text-slate-400">Comparisons</span>
              <div className="mt-2 flex gap-3 items-center">
                <label className="text-sm text-slate-400">Mid</label>
                <select
                  className="w-64 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={midSelection ?? ""}
                  onChange={(e) => setMidSelection(e.target.value || null)}
                >
                  <option value="">Default (mid/mid)</option>
                  {comparisonOptions.map((entry) => (
                    <option key={entry.scenarioId} value={entry.scenarioId}>
                      {formatScenarioLabel(entry)}
                    </option>
                  ))}
                </select>

                <label className="ml-4 text-sm text-slate-400">High</label>
                <select
                  className="w-64 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={highSelection ?? ""}
                  onChange={(e) => setHighSelection(e.target.value || null)}
                >
                  <option value="">Default (high/high)</option>
                  {comparisonOptions.map((entry) => (
                    <option key={entry.scenarioId} value={entry.scenarioId}>
                      {formatScenarioLabel(entry)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {status === "error" ? (
            <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {error ?? "Unable to load presentation data."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 text-sm text-slate-300 sm:grid-cols-3">
              {stats?.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                >
                  <span className="text-xs uppercase tracking-widest text-slate-500">
                    {stat.label}
                  </span>
                  <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
                </div>
              )) ?? (
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-slate-500">
                  Loading snapshot metrics…
                </div>
              )}
            </div>
          )}
        </header>

        {/* Floating TimelineScrubber is rendered globally; remove embedded card */}

        {/* Financial Workflow - Full Width */}
        <section className="mb-6 ">
          <FinancialWorkflowDiagram />
        </section>

        {/* Daily Increments Card - Separate */}
        <section className="mb-6 w-72">
          <aside className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
            {activeDay ? (
              <div className="space-y-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">
                    Day {activeDay.dayIndex + 1}
                  </h2>
                  <p className="text-xs uppercase tracking-widest text-slate-500">
                    {activeDay.label}
                  </p>
                </div>
                <div className="space-y-2">
                  <p>
                    <span className="text-slate-400">Daily Revenue:</span> $
                    {activeDay.summary.dailyRevenue.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                  <p>
                    <span className="text-slate-400">Daily Charity:</span> $
                    {activeDay.summary.dailyCharity.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                  <p>
                    <span className="text-slate-400">Daily Fees:</span> $
                    {activeDay.summary.dailyFees.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                  <p>
                    <span className="text-slate-400">Player Payouts:</span> $
                    {activeDay.summary.dailyPayouts.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500">
                Select a scenario to view per-day details.
              </p>
            )}
          </aside>
        </section>
      </div>
      {/* Floating timeline scrubber */}
      <TimelineScrubber />
    </div>
  );
};

export default PrototypeDashboard;
