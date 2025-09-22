import { useMemo, useState } from "react";

import { usePresentationTimelineStore } from "@/shared/hooks/presentationTimelineStore";
import { NormalizedPresentationDay } from "@/shared/presentation";

import { SvgTimeline, TimelineDatum } from "./SvgTimeline";
import { TimelinePlaybackControls } from "./TimelinePlaybackControls";
import { useTimelinePlayback } from "../hooks/useTimelinePlayback";
import { useTimelineKeyboardShortcuts } from "../hooks/useTimelineKeyboardShortcuts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getStepForScale,
  getTimeScaleForIndex,
} from "@/shared/time-scales/config";

export interface TimelineScrubberProps {
  width?: number;
  height?: number;
  spacing?: number;
}

function mapDayToDatum(day: NormalizedPresentationDay): TimelineDatum {
  return {
    id: `day-${day.dayIndex}`,
    dayIndex: day.dayIndex,
    label: day.label,
    cumulativeRevenue: day.timelineTick.cumulativeRevenue,
    date: day.date,
  };
}

export function TimelineScrubber({
  width = 520,
  height = 44,
  spacing,
}: TimelineScrubberProps) {
  useTimelinePlayback();
  useTimelineKeyboardShortcuts();

  const activeScenario = usePresentationTimelineStore((state) =>
    state.activeScenarioId ? state.scenarios[state.activeScenarioId] : undefined
  );
  const activeDayIndex = usePresentationTimelineStore(
    (state) => state.activeDayIndex
  );
  const setActiveDay = usePresentationTimelineStore(
    (state) => state.setActiveDay
  );
  const isPlaying = usePresentationTimelineStore((state) => state.isPlaying);

  const [hoveredDay, setHoveredDay] =
    useState<NormalizedPresentationDay | null>(null);

  const timelineData = useMemo(() => {
    if (!activeScenario) {
      return [] as TimelineDatum[];
    }
    return activeScenario.days.map(mapDayToDatum);
  }, [activeScenario]);

  const activeDay = useMemo(() => {
    if (!activeScenario) return undefined;
    return activeScenario.dayLookup[activeDayIndex];
  }, [activeScenario, activeDayIndex]);

  const activeRevenue = activeDay?.timelineTick.cumulativeRevenue ?? 0;

  if (!activeScenario) {
    return (
      <div className="rounded-md border border-slate-700 bg-slate-900/60 p-6 text-center text-slate-400">
        Load a presentation snapshot to enable the timeline scrubber.
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-50 flex justify-center pointer-events-none">
      <div className="group pointer-events-auto relative w-full max-w-xl">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-300">
            <span className="text-slate-500">Day</span>{" "}
            {(activeDay?.dayIndex ?? 0) + 1}
          </div>
          <div className="pointer-events-none opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
            <TimelinePlaybackControls />
          </div>
        </div>
        <div className="relative">
          <SvgTimeline
            data={timelineData}
            activeIndex={activeDayIndex}
            width={width}
            height={height}
            spacing={spacing}
            isPlaying={isPlaying}
            onSelectIndex={(index) => setActiveDay(index)}
            onStep={(delta) => {
              const next = Math.max(
                0,
                Math.min((activeDayIndex ?? 0) + delta, timelineData.length - 1)
              );
              setActiveDay(next);
            }}
            onHoverIndex={(index) => {
              if (index == null || index < 0 || index >= timelineData.length) {
                setHoveredDay(null);
                return;
              }
              const nextDay = activeScenario.dayLookup[index];
              setHoveredDay(nextDay ?? null);
            }}
          />
          {/* Hover time-skip controls */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-between opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
            <button
              type="button"
              aria-label="Skip backward"
              className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800/80 text-slate-200 shadow ring-1 ring-slate-700 hover:bg-slate-700"
              onClick={() => {
                const scenario = activeScenario;
                const idx = activeDayIndex ?? 0;
                const scale = scenario
                  ? getTimeScaleForIndex(scenario.duration, idx)
                  : "daily";
                const step = getStepForScale(scale);
                setActiveDay(Math.max(0, idx - step));
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Skip forward"
              className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800/80 text-slate-200 shadow ring-1 ring-slate-700 hover:bg-slate-700"
              onClick={() => {
                const scenario = activeScenario;
                const idx = activeDayIndex ?? 0;
                const scale = scenario
                  ? getTimeScaleForIndex(scenario.duration, idx)
                  : "daily";
                const step = getStepForScale(scale);
                setActiveDay(Math.min(timelineData.length - 1, idx + step));
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
          <span>{hoveredDay?.label ?? activeDay?.label ?? "—"}</span>
          <span>
            $
            {activeRevenue.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </span>
          <span>{timelineData[timelineData.length - 1]?.label ?? "—"}</span>
        </div>
      </div>
    </div>
  );
}

export default TimelineScrubber;
