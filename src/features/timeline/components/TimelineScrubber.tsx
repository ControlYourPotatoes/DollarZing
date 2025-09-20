import { useMemo, useState } from "react";

import { usePresentationTimelineStore } from "@/shared/hooks/presentationTimelineStore";
import { NormalizedPresentationDay } from "@/shared/presentation";

import { SvgTimeline, TimelineDatum } from "./SvgTimeline";
import { TimelinePlaybackControls } from "./TimelinePlaybackControls";
import { useTimelinePlayback } from "../hooks/useTimelinePlayback";
import { useTimelineKeyboardShortcuts } from "../hooks/useTimelineKeyboardShortcuts";

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
  };
}

export function TimelineScrubber({
  width,
  height,
  spacing,
}: TimelineScrubberProps) {
  useTimelinePlayback();
  useTimelineKeyboardShortcuts();

  const activeScenario = usePresentationTimelineStore((state) =>
    state.activeScenarioId ? state.scenarios[state.activeScenarioId] : undefined
  );
  const activeDayIndex = usePresentationTimelineStore((state) => state.activeDayIndex);
  const setActiveDay = usePresentationTimelineStore((state) => state.setActiveDay);
  const isPlaying = usePresentationTimelineStore((state) => state.isPlaying);

  const [hoveredDay, setHoveredDay] = useState<NormalizedPresentationDay | null>(null);

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
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-200">
          <span className="text-slate-400">Day</span> {(activeDay?.dayIndex ?? 0) + 1}
          <span className="ml-2 text-slate-400">Label:</span> {hoveredDay?.label ?? activeDay?.label}
        </div>
        <TimelinePlaybackControls />
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
        <SvgTimeline
          data={timelineData}
          activeIndex={activeDayIndex}
          width={width}
          height={height}
          spacing={spacing}
          isPlaying={isPlaying}
          onSelectIndex={(index) => setActiveDay(index)}
          onHoverIndex={(index) => {
            if (index == null || index < 0 || index >= timelineData.length) {
              setHoveredDay(null);
              return;
            }
            const nextDay = activeScenario.dayLookup[index];
            setHoveredDay(nextDay ?? null);
          }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Start • {timelineData[0]?.label ?? "—"}</span>
        <span>
          Active revenue: $
          {activeRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        <span>End • {timelineData[timelineData.length - 1]?.label ?? "—"}</span>
      </div>
    </div>
  );
}

export default TimelineScrubber;
