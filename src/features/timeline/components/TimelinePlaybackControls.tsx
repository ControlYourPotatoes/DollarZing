import { useMemo } from "react";

import { Pause, Play, RotateCcw } from "lucide-react";

import { usePresentationTimelineStore } from "@/shared/hooks/presentationTimelineStore";

const SPEED_OPTIONS = [0.5, 1, 1.5, 2];

export function TimelinePlaybackControls() {
  const isPlaying = usePresentationTimelineStore((state) => state.isPlaying);
  const playbackSpeed = usePresentationTimelineStore((state) => state.playbackSpeed);
  const setPlaybackState = usePresentationTimelineStore((state) => state.setPlaybackState);
  const setPlaybackSpeed = usePresentationTimelineStore((state) => state.setPlaybackSpeed);
  const setActiveDay = usePresentationTimelineStore((state) => state.setActiveDay);
  const activeScenario = usePresentationTimelineStore((state) =>
    state.activeScenarioId ? state.scenarios[state.activeScenarioId] : undefined
  );

  const speedLabel = useMemo(() => `${playbackSpeed.toFixed(1)}x`, [playbackSpeed]);

  return (
    <div className="flex items-center gap-3" role="group" aria-label="Timeline playback controls">
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-md border border-slate-500/60 bg-slate-800 px-3 py-2 text-sm text-white shadow-sm transition hover:bg-slate-700"
        onClick={() => setPlaybackState(!isPlaying)}
      >
        {isPlaying ? (
          <>
            <Pause className="mr-1 h-4 w-4" />
            Pause
          </>
        ) : (
          <>
            <Play className="mr-1 h-4 w-4" />
            Play
          </>
        )}
      </button>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-md border border-slate-500/40 bg-slate-800 px-2 py-2 text-xs text-slate-200 transition hover:bg-slate-700"
        onClick={() => {
          setPlaybackState(false);
          setActiveDay(0);
        }}
        disabled={!activeScenario}
      >
        <RotateCcw className="h-4 w-4" />
        <span className="sr-only">Reset timeline</span>
      </button>
      <label className="flex items-center gap-1 text-xs text-slate-300">
        Speed
        <select
          className="rounded border border-slate-500 bg-slate-900 px-2 py-1 text-xs text-white"
          value={playbackSpeed}
          onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
        >
          {SPEED_OPTIONS.map((speed) => (
            <option key={speed} value={speed}>
              {speed.toFixed(1)}x
            </option>
          ))}
        </select>
      </label>
      <span className="text-xs text-slate-400" aria-live="polite">
        {speedLabel}
      </span>
    </div>
  );
}

export default TimelinePlaybackControls;
