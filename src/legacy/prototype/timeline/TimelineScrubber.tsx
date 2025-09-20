// TimelineScrubber.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SvgTimeline from './SvgTimeline'; // Assuming SvgTimeline.tsx is in the same directory

interface TimelinePoint {
  id: string;
  label: string;
  netPayouts: number;
  totalCharity: number;
  totalFees: number;
}

interface TimelineScrubberProps {
  data: TimelinePoint[];
  activeIndex: number;
  onChange: (index: number) => void;
  isPlaying: boolean;
  onPlayToggle: () => void;
}

const TimelineScrubber = ({ data, activeIndex, onChange, isPlaying, onPlayToggle }: TimelineScrubberProps) => {
  // Removed `progress` as it's not used in the UI now
  const current = data[activeIndex];
  const next = data[(activeIndex + 1) % data.length];
  const controlRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Removed tickPulse, tickShift, tickOffset as SvgTimeline handles the animation
  const directionTimeoutRef = useRef<number>();
  const previousIndexRef = useRef(activeIndex);

  const gestureStartRef = useRef<number | null>(null);
  const initialDragStartXRef = useRef<number | null>(null);
  const hasSkippedRef = useRef(false);

  // --- NEW STATE FOR SCRUB SHIFT (to pass to SvgTimeline) ---
  const [scrubOffset, setScrubOffset] = useState(0); // This will control the SVG's internal translateX
  // -----------------------------------------------------------

  const stepTo = useCallback(
    (delta: number) => {
      if (hasSkippedRef.current) return;
      if (delta === 0) return;
      const target = Math.min(Math.max(activeIndex + delta, 0), data.length - 1);
      if (target === activeIndex) return;
      onChange(target);
      // No need to set tickPulse/tickOffset here, SvgTimeline responds to activeIndex directly
    },
    [activeIndex, data.length, onChange],
  );

  const handleDragStart = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest('button')) {
        return;
      }
      event.preventDefault();
      setIsDragging(true);
      gestureStartRef.current = event.clientX;
      initialDragStartXRef.current = event.clientX;
      hasSkippedRef.current = false;

      const controlWidth = controlRef.current?.offsetWidth ?? 0;
      // You'll need to tune these thresholds based on the `indentSpacing` in SvgTimeline
      // For instance, stepThreshold could be related to (indentSpacing / someFactor)
      const stepThreshold = Math.max(controlWidth, 360) / 20;
      const skipThreshold = Math.max(controlWidth, 360) / 3;

      const handleMove = (moveEvent: PointerEvent) => {
        if (gestureStartRef.current === null || initialDragStartXRef.current === null) return;

        const currentClientX = moveEvent.clientX;
        const totalDelta = currentClientX - initialDragStartXRef.current;
        const stepDelta = currentClientX - gestureStartRef.current;

        // --- Update scrubOffset for immediate visual feedback ---
        if (!hasSkippedRef.current) {
          // This creates the continuous "scrolling ruler" effect
          setScrubOffset(totalDelta); // Use totalDelta for direct mapping to visual scrub
        }
        // -------------------------------------------------------

        // Skip Logic
        if (!hasSkippedRef.current) {
          if (totalDelta > skipThreshold) {
            hasSkippedRef.current = true;
            onChange(data.length - 1);
            gestureStartRef.current = currentClientX; // Reset gestureStartRef for next drag
            setScrubOffset(0); // Snap visual scrubber back after a skip
            return;
          } else if (totalDelta < -skipThreshold) {
            hasSkippedRef.current = true;
            onChange(0);
            gestureStartRef.current = currentClientX;
            setScrubOffset(0); // Snap visual scrubber back after a skip
            return;
          }
        }

        // Stepping Logic (only if not skipped)
        if (!hasSkippedRef.current) {
          if (stepDelta > stepThreshold) {
            gestureStartRef.current = currentClientX;
            stepTo(1);
            // Optionally, adjust scrubOffset slightly to reset after a step
            setScrubOffset((prev) => prev - (stepThreshold)); // This might need fine-tuning
          } else if (stepDelta < -stepThreshold) {
            gestureStartRef.current = currentClientX;
            stepTo(-1);
            // Optionally, adjust scrubOffset slightly to reset after a step
            setScrubOffset((prev) => prev + (stepThreshold)); // This might need fine-tuning
          }
        }
      };

      const handleUp = () => {
        setIsDragging(false);
        gestureStartRef.current = null;
        initialDragStartXRef.current = null;
        hasSkippedRef.current = false;
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleUp);
        setScrubOffset(0); // Snap the visual scrubber back to center/aligned position
      };

      document.addEventListener('pointermove', handleMove);
      document.addEventListener('pointerup', handleUp, { once: true });
    },
    [stepTo, data.length, onChange], // Removed scrubOffset from deps, as it's updated inside handleMove
  );

  // The `direction` state and its `useEffect` (`directionTimeoutRef`)
  // and the `tickShift` / `tickPulse` `useEffect` are now essentially deprecated
  // because the `SvgTimeline` handles direct `translateX` via `scrubOffset`
  // and the color/height transitions are internal to SvgTimeline based on `activeIndex`.
  // You might remove these if no other UI element depends on them.
  // For now, let's keep the useEffect for directionTimeoutRef cleanup just in case.
  useEffect(
    () => () => {
      if (directionTimeoutRef.current) {
        window.clearTimeout(directionTimeoutRef.current);
      }
    },
    [],
  );


  // The `containerStyle` (linear-gradient background) is for the entire component.
  // You might still want this for the accent background on the whole scrubber.
  const containerStyle = useMemo(() => {
    const accent = 'rgba(14,165,233,0.18)';
    const base = 'rgba(15,23,42,0.92)';
    // You could make this gradient's position follow activeIndex if desired,
    // but without an explicit track, it might be less relevant for the timeline itself.
    // It's fine to keep it as a general highlight for the component.
    return {
      background: `linear-gradient(90deg, ${accent} ${0}%, ${base} ${0}%)`, // No explicit progress fill
    };
  }, []); // It doesn't need to change if not tied to progress visually

  const svgWidth = controlRef.current?.offsetWidth || 768; // Fallback width for SVG

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 w-full max-w-3xl -translate-x-1/2 px-4">
      <div
        ref={controlRef}
        className={`pointer-events-auto flex cursor-grab flex-col gap-3 rounded-2xl border border-slate-800 p-4 shadow-2xl shadow-sky-900/20 backdrop-blur ${
          isDragging ? 'cursor-grabbing ring-1 ring-sky-400/60' : ''
        }`}
        style={containerStyle}
        onPointerDown={handleDragStart}
      >
        {/* Top section with Play/Pause button and text (HTML elements, as intended) */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onPlayToggle}
              className={`flex size-10 items-center justify-center rounded-full border border-slate-700 text-sm font-semibold transition ${
                isPlaying ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {isPlaying ? '❚❚' : '▶'}
            </button>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest text-slate-500">Current Snapshot</p>
              <p className="text-lg font-semibold text-slate-100">{current?.label ?? '—'}</p>
            </div>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-xs uppercase tracking-widest text-slate-500">Next</p>
            <p className="text-sm font-semibold text-slate-300">{next?.label ?? '—'}</p>
          </div>
        </div>

        {/* This is where your SvgTimeline component is rendered */}
        <div className="relative">
          <SvgTimeline
            data={data}
            activeIndex={activeIndex}
            width={svgWidth} // Pass calculated width
            height={60} // Fixed height for the SVG ruler area
            scrubShift={scrubOffset} // Pass the dynamic scrubOffset
          />
        </div>
      </div>
    </div>
  );
};

export default TimelineScrubber;
