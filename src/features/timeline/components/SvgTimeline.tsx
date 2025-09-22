import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTimeScaleForIndex } from "@/shared/time-scales/config";

export interface TimelineDatum {
  id: string;
  label: string;
  dayIndex: number;
  cumulativeRevenue: number;
  date?: string;
}

export interface TimelineInteractionHandlers {
  onSelectIndex?: (index: number) => void;
  onHoverIndex?: (index: number | null) => void;
  onStep?: (delta: number) => void; // signed step count: +forward, -backward
}

interface SvgTimelineProps extends TimelineInteractionHandlers {
  data: TimelineDatum[];
  activeIndex: number;
  width?: number;
  height?: number;
  spacing?: number;
  ariaLabel?: string;
  isPlaying?: boolean;
  onStep?: (delta: number) => void;
}

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 72;
const DEFAULT_SPACING = 112;

/**
 * Presentation timeline rendered with SVG ruler marks.
 * Keeps the active tick centered while scrubbing and supports pointer/keyboard interaction.
 */
export function SvgTimeline({
  data,
  activeIndex,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  spacing = DEFAULT_SPACING,
  ariaLabel = "Presentation timeline scrubber",
  isPlaying = false,
  onSelectIndex,
  onHoverIndex,
  onStep,
}: SvgTimelineProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef<number | null>(null);
  const hasSteppedRef = useRef<boolean>(false);

  const clampedActiveIndex = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.max(0, Math.min(activeIndex, data.length - 1));
  }, [activeIndex, data.length]);

  // Absolute ruler positions; we pan the ruler underneath a fixed viewport
  const xPositions = useMemo(
    () => data.map((_, i) => i * spacing),
    [data, spacing]
  );
  const totalRulerWidth = useMemo(
    () => (data.length > 0 ? (data.length - 1) * spacing : 0),
    [data.length, spacing]
  );
  const viewMinX = useMemo(() => {
    const centerX = clampedActiveIndex * spacing;
    let min = Math.max(0, centerX - width / 2);
    const maxMin = Math.max(0, totalRulerWidth - width);
    if (min > maxMin) min = maxMin;
    return min;
  }, [clampedActiveIndex, spacing, width, totalRulerWidth]);

  // Smoothly animate ruler pan between steps for a subtle ease
  const [animatedMinX, setAnimatedMinX] = useState<number>(viewMinX);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const startXRef = useRef<number>(viewMinX);

  useEffect(() => {
    // Cancel any in-flight animation
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const durationMs = 180;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    startTimeRef.current = performance.now();
    startXRef.current = animatedMinX;
    const targetX = viewMinX;

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(t);
      const next = startXRef.current + (targetX - startXRef.current) * eased;
      setAnimatedMinX(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        setAnimatedMinX(targetX);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMinX]);

  const findNearestIndex = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg || data.length === 0) return 0;
      const rect = svg.getBoundingClientRect();
      const localX = clientX - rect.left;
      let nearestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let i = 0; i < xPositions.length; i += 1) {
        const distance = Math.abs(xPositions[i] - localX);
        if (distance < bestDistance) {
          bestDistance = distance;
          nearestIndex = i;
        }
      }
      return nearestIndex;
    },
    [data.length, xPositions]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!isDragging) return;
      // Hover preview (non-committal)
      const hoverIndex = findNearestIndex(event.clientX);
      onHoverIndex?.(hoverIndex);

      // Stepped gesture: trigger at threshold once per drag
      if (dragStartXRef.current == null || hasSteppedRef.current) return;
      const dx = event.clientX - dragStartXRef.current;
      const base = Math.max(24, Math.min(40, spacing * 0.35));
      const absDx = Math.abs(dx);
      if (absDx >= base) {
        // Layered thresholds: 1x, 2x, 4x steps for larger drags
        let steps = 1;
        if (absDx >= base * 3) steps = 4;
        else if (absDx >= base * 2) steps = 2;
        const sign = dx < 0 ? 1 : -1; // left drag => forward (+), right => backward (-)
        onStep?.(sign * steps);
        hasSteppedRef.current = true;
      }
    },
    [findNearestIndex, isDragging, onHoverIndex, onStep, spacing]
  );

  useEffect(() => {
    if (!isDragging) return;
    const handlePointerUp = (event: PointerEvent) => {
      // If no step was triggered, treat as click-select
      if (!hasSteppedRef.current) {
        const index = findNearestIndex(event.clientX);
        onSelectIndex?.(index);
      }
      setIsDragging(false);
      dragStartXRef.current = null;
      hasSteppedRef.current = false;
      onHoverIndex?.(null);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    handlePointerMove,
    isDragging,
    findNearestIndex,
    onSelectIndex,
    onHoverIndex,
  ]);

  const marks = useMemo(() => {
    const indentWidth = 1.5;
    const labelYOffset = height - 16;
    const scale = getTimeScaleForIndex(data.length, clampedActiveIndex);

    const isMonthBoundary = (idx: number): boolean => {
      const d = data[idx]?.date;
      const p = idx > 0 ? data[idx - 1]?.date : undefined;
      if (!d || !p) return false;
      const cd = new Date(d);
      const pd = new Date(p);
      return cd.getMonth() !== pd.getMonth();
    };

    return data.map((point, index) => {
      const x = xPositions[index];
      const isActive = index === clampedActiveIndex;
      const isPast = index < clampedActiveIndex;

      // Tick tiering
      const month = isMonthBoundary(index);
      const week = !month && (index + 1) % 7 === 0;

      // Heights by tier and scale
      const monthH = 16;
      const weekH = scale === "daily" ? 12 : 10;
      const dayH = scale === "daily" ? 8 : scale === "weekly" ? 6 : 5;
      const heightDelta = isActive
        ? monthH
        : month
        ? monthH
        : week
        ? weekH
        : dayH;
      const y = height - heightDelta;

      // Labels: show month boundaries and active label; suppress clutter on monthly
      const showLabel = month || isActive;
      const fill = isActive
        ? "var(--timeline-active)"
        : isPast
        ? "var(--timeline-past)"
        : "var(--timeline-future)";

      return (
        <g
          key={point.id}
          className={isActive ? "timeline-point active" : "timeline-point"}
          data-index={index}
          transform={`translate(${x}, 0)`}
        >
          <rect
            x={-indentWidth / 2}
            y={y}
            width={indentWidth}
            height={heightDelta}
            rx={1}
            ry={1}
            fill={fill}
            style={{ transition: "height 140ms ease, fill 140ms ease" }}
          />
          {showLabel && (
            <text
              x={0}
              y={labelYOffset}
              textAnchor="middle"
              fontSize={9}
              fill={isActive ? "#e2e8f0" : "rgba(226,232,240,0.6)"}
            >
              {point.label}
            </text>
          )}
        </g>
      );
    });
  }, [data, clampedActiveIndex, xPositions, height]);

  return (
    <svg
      ref={svgRef}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={1}
      aria-valuemax={data.length}
      aria-valuenow={clampedActiveIndex + 1}
      aria-valuetext={data[clampedActiveIndex]?.label ?? ""}
      tabIndex={0}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onPointerDown={(event) => {
        event.preventDefault();
        dragStartXRef.current = event.clientX;
        hasSteppedRef.current = false;
        const hoverIndex = findNearestIndex(event.clientX);
        onHoverIndex?.(hoverIndex);
        setIsDragging(true);
      }}
      onPointerLeave={() => {
        if (!isDragging) {
          onHoverIndex?.(null);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          onSelectIndex?.(Math.max(0, clampedActiveIndex - 1));
        }
        if (event.key === "ArrowRight") {
          onSelectIndex?.(Math.min(data.length - 1, clampedActiveIndex + 1));
        }
      }}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
    >
      {/* Sliding ruler group */}
      <g transform={`translate(${-animatedMinX}, 0)`}>
        <rect
          x={animatedMinX}
          y={height - 2}
          width={width}
          height={1.5}
          fill="var(--timeline-base)"
        />
        {marks}
      </g>
      {/* Center indicator and pulsing play head */}
      {isPlaying && (
        <rect
          x={width / 2 - 0.75}
          y={height - 22}
          width={1.5}
          height={10}
          fill="var(--timeline-active)"
          opacity={0.65}
        >
          <animate
            attributeName="opacity"
            values="0.25;0.65;0.25"
            dur="1.4s"
            repeatCount="indefinite"
          />
        </rect>
      )}
    </svg>
  );
}

export default SvgTimeline;
