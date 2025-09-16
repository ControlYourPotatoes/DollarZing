import { useEffect, useMemo, useState } from 'react';
import CohortProgressChart from '@/components/prototype/CohortProgressChart';
import DistributionFlowChart from '@/components/prototype/DistributionFlowChart';
import FlowBreakdownChart from '@/components/prototype/FlowBreakdownChart';
import HeatmapGrid from '@/components/prototype/HeatmapGrid';
import TimelineScrubber from '@/components/prototype/TimelineScrubber';
import { flowScenarios, levelLabels } from '@/mock/prototypeData';

const PrototypeDashboard = () => {
  const [scenarioId, setScenarioId] = useState(flowScenarios[0].id);
  const scenario = useMemo(
    () => flowScenarios.find((item) => item.id === scenarioId) ?? flowScenarios[0],
    [scenarioId],
  );

  const [snapshotIndex, setSnapshotIndex] = useState(scenario.timeSeries.length - 1);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setSnapshotIndex(scenario.timeSeries.length - 1);
    setIsPlaying(false);
  }, [scenario]);

  useEffect(() => {
    if (!isPlaying || scenario.timeSeries.length <= 1) {
      return;
    }
    const id = window.setInterval(() => {
      setSnapshotIndex((prev) => (prev + 1) % scenario.timeSeries.length);
    }, 2000);
    return () => window.clearInterval(id);
  }, [isPlaying, scenario.timeSeries.length]);

  const snapshot = scenario.timeSeries[snapshotIndex];
  const timelineData = scenario.timeSeries.map((point) => ({
    id: point.id,
    label: point.label,
    netPayouts: point.summary.netPayouts,
    totalCharity: point.summary.totalCharity,
    totalFees: point.summary.totalFees,
  }));

  const heatmapValues = levelLabels.map((_, levelIndex) =>
    scenario.timeSeries.map((point) => point.survivalHeatmap[levelIndex] ?? 0),
  );

  const handleSnapshotChange = (index: number) => {
    setSnapshotIndex(index);
    setIsPlaying(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 pb-32 text-slate-100">
      <TimelineScrubber
        data={timelineData}
        activeIndex={snapshotIndex}
        onChange={handleSnapshotChange}
        isPlaying={isPlaying}
        onPlayToggle={() => setIsPlaying((prev) => !prev)}
      />
      <div className="mx-auto max-w-6xl space-y-9">
        <header className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-widest text-slate-400">DollarZing Prototype</p>
              <h1 className="text-3xl font-semibold tracking-tight">Scenario Flow & Cohort Preview</h1>
              <p className="text-slate-400">
                Mocked anchor snapshots wired into the planned interpolation surfaces for today&apos;s walkthrough.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
              <label htmlFor="scenario" className="block text-xs uppercase tracking-widest text-slate-400">
                Scenario
              </label>
              <select
                id="scenario"
                className="mt-1 w-72 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                value={scenarioId}
                onChange={(event) => setScenarioId(event.target.value)}
              >
                {flowScenarios.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 text-sm text-slate-300 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <span className="text-xs uppercase tracking-widest text-slate-500">Active Players</span>
              <p className="mt-2 text-2xl font-semibold">{snapshot.summary.activePlayers.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <span className="text-xs uppercase tracking-widest text-slate-500">Daily Dollars Initiated</span>
              <p className="mt-2 text-2xl font-semibold">{snapshot.summary.dollarsInitiated.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <span className="text-xs uppercase tracking-widest text-slate-500">Cash-Out Rate</span>
              <p className="mt-2 text-2xl font-semibold">{(snapshot.summary.cashOutRate * 100).toFixed(0)}%</p>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-6">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-sky-900/10">
            <header className="mb-6 space-y-1">
              <p className="text-xs uppercase tracking-widest text-slate-500">Aggregate Flow</p>
              <h2 className="text-xl font-semibold">Where Today&apos;s Dollars Finish</h2>
              <p className="text-sm text-slate-400">Tensor-inspired workflow view of the latest interpolated totals.</p>
            </header>
            <FlowBreakdownChart total={snapshot.breakdown.total} nodes={snapshot.breakdown.nodes} />
          </article>

          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-sky-900/10">
              <header className="mb-6 space-y-1">
                <p className="text-xs uppercase tracking-widest text-slate-500">Revenue Distribution</p>
                <h2 className="text-xl font-semibold">Flow of Daily Volume</h2>
                <p className="text-sm text-slate-400">Fees, charity contributions, and player payouts for the selected snapshot.</p>
              </header>
              <DistributionFlowChart links={snapshot.flowLinks} />
            </article>

            <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-sky-900/10">
              <header className="mb-6 space-y-1">
                <p className="text-xs uppercase tracking-widest text-slate-500">Dollar Survival Cohort</p>
                <h2 className="text-xl font-semibold">Retention Across Betting Levels</h2>
                <p className="text-sm text-slate-400">Net value and survival rate after platform fees and charity deductions.</p>
              </header>
              <CohortProgressChart cohort={snapshot.cohort} />
            </article>
          </div>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-sky-900/10">
            <header className="mb-6 space-y-1">
              <p className="text-xs uppercase tracking-widest text-slate-500">Survival Heatmap</p>
              <h2 className="text-xl font-semibold">Progression Sensitivity</h2>
              <p className="text-sm text-slate-400">Snapshot grid showing percentage of surviving dollars at each level across the timeline points.</p>
            </header>
            <HeatmapGrid labels={timelineData.map((point) => point.label)} values={heatmapValues} activeIndex={snapshotIndex} />
          </article>
        </section>
      </div>
    </div>
  );
};

export default PrototypeDashboard;
