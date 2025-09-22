import { useCallback, useEffect, useMemo, useState } from "react";

import {
  loadPresentationManifest,
  loadPresentationSnapshot,
  PresentationManifestEntry,
} from "@/shared/presentation";
import { usePresentationTimelineStore } from "@/shared/hooks/presentationTimelineStore";
import { TimelineScrubber, useActiveTimelineDay } from "@/features/timeline";
import { FinancialWorkflowDiagram } from "@/features/financial-flow";

// Optional runtime overrides to fetch manifest/snapshots from an external base or per-scenario URLs
const {
  VITE_PRESENTATION_BASE_URL,
  VITE_PRESENTATION_MANIFEST_URL,
  VITE_PRESENTATION_OVERRIDES,
} = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;

// Respect Vite base (e.g., "/DollarZing/") so public assets resolve correctly in dev/prod
const DEFAULT_PUBLIC_BASE =
  (((import.meta as any).env ?? {}) as Record<string, string | undefined>)[
    "BASE_URL"
  ] || "/";
const DEFAULT_DATASETS_BASE = `${DEFAULT_PUBLIC_BASE.replace(
  /\/$/,
  ""
)}/engine/generated-datasets/`;

function joinUrl(base: string, path: string): string {
  const left = base.endsWith("/") ? base.slice(0, -1) : base;
  const right = path.startsWith("/") ? path.slice(1) : path;
  return `${left}/${right}`;
}

function resolvePublicPath(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  // Ensure URLs respect the dev/prod base path
  return joinUrl(DEFAULT_PUBLIC_BASE, url);
}

const MANIFEST_CANDIDATES: string[] = [
  VITE_PRESENTATION_MANIFEST_URL
    ? resolvePublicPath(VITE_PRESENTATION_MANIFEST_URL)
    : "",
  joinUrl(DEFAULT_DATASETS_BASE, "anchor-datasets/presentation-manifest.json"),
  joinUrl(DEFAULT_DATASETS_BASE, "presentation-manifest.json"),
].filter(Boolean);

function resolveSnapshotUrl(entry: PresentationManifestEntry): string {
  // Highest priority: explicit per-scenario override map (JSON string mapping scenarioId -> URL)
  if (VITE_PRESENTATION_OVERRIDES) {
    try {
      const map = JSON.parse(VITE_PRESENTATION_OVERRIDES) as Record<
        string,
        string
      >;
      const override = map[entry.scenarioId];
      if (override) return override;
    } catch {
      // Ignore malformed override map
    }
  }

  const candidates: string[] = [];
  const base = VITE_PRESENTATION_BASE_URL
    ? resolvePublicPath(VITE_PRESENTATION_BASE_URL)
    : DEFAULT_DATASETS_BASE;
  // 1) Use manifest-provided path under base
  candidates.push(joinUrl(base, entry.path));
  // 2) Fallback: derive from scenarioId
  candidates.push(
    joinUrl(
      base,
      `anchor-datasets/${entry.scenarioId}/presentation-snapshots.json`
    )
  );

  // Return first candidate (the loader will actually fetch and handle errors)
  return candidates[0];
}

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
  const manifestIndex = usePresentationTimelineStore((state) => state.manifest);
  const scenarios = usePresentationTimelineStore((state) => state.scenarios);
  const activeScenarioId = usePresentationTimelineStore(
    (state) => state.activeScenarioId
  );

  const activeDay = useActiveTimelineDay();

  const manifestEntries = useMemo(
    () => manifestIndex?.manifest ?? [],
    [manifestIndex]
  );
  const selectedScenarioId =
    activeScenarioId ?? manifestEntries[0]?.scenarioId ?? "";

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
                {manifestEntries.map((entry) => (
                  <option key={entry.scenarioId} value={entry.scenarioId}>
                    {entry.parameters.adoptionRate.toUpperCase()} growth ·{" "}
                    {entry.parameters.cashOutStrategy} risk ·{" "}
                    {entry.parameters.charityShare}% charity
                  </option>
                ))}
              </select>
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

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-sky-900/10">
          <TimelineScrubber />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          <FinancialWorkflowDiagram />
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
    </div>
  );
};

export default PrototypeDashboard;
