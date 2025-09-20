import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface TimelineDatum {
  id: string;
  label: string;
  dayIndex: number;
  cumulativeRevenue: number;
}

export interface TimelineInteractionHandlers {
  onSelectIndex?: (index: number) => void;
  onHoverIndex?: (index: number | null) => void;
}

interface SvgTimelineProps extends TimelineInteractionHandlers {
  data: TimelineDatum[];
  activeIndex: number;
  width?: number;
  height?: number;
  spacing?: number;
  ariaLabel?: string;
  isPlaying?: boolean;
}

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 80;
const DEFAULT_SPACING = 120;

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
}: SvgTimelineProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const clampedActiveIndex = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.max(0, Math.min(activeIndex, data.length - 1));
  }, [activeIndex, data.length]);

  const getPointX = useCallback(
    (index: number) => {
      if (data.length <= 1) return width / 2;
      const svgCenter = width / 2;
      return svgCenter + (index - clampedActiveIndex) * spacing;
    },
    [data.length, width, clampedActiveIndex, spacing]
  );

  const xPositions = useMemo(
    () => data.map((_, index) => getPointX(index)),
    [data, getPointX]
  );

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
      const nextIndex = findNearestIndex(event.clientX);
      onSelectIndex?.(nextIndex);
      onHoverIndex?.(nextIndex);
    },
    [findNearestIndex, isDragging, onSelectIndex, onHoverIndex]
  );

  useEffect(() => {
    if (!isDragging) return;
    const handlePointerUp = () => setIsDragging(false);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, isDragging]);

  const marks = useMemo(() => {
    const indentHeight = 10;
    const activeIndentHeight = 18;
    const indentWidth = 2;
    const labelYOffset = height - 18;

    return data.map((point, index) => {
      const x = xPositions[index];
      const isActive = index === clampedActiveIndex;
      const isPast = index < clampedActiveIndex;

      const heightDelta = isActive ? activeIndentHeight : indentHeight;
      const y = height - heightDelta;
      const showLabel =
        index === 0 || index === data.length - 1 || data.length <= 6 || isActive;

      const fill = isActive
        ? "var(--timeline-active, #0ea5e9)"
        : isPast
        ? "var(--timeline-past, rgba(14,165,233,0.4))"
        : "var(--timeline-future, rgba(148,163,184,0.35))";

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
            style={{ transition: "height 160ms ease, fill 160ms ease" }}
          />
          {showLabel && (
            <text
              x={0}
              y={labelYOffset}
              textAnchor="middle"
              fontSize={10}
              fill={isActive ? "#ffffff" : "rgba(255,255,255,0.68)"}
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
        const nextIndex = findNearestIndex(event.clientX);
        onSelectIndex?.(nextIndex);
        onHoverIndex?.(nextIndex);
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
      <rect
        x={0}
        y={height - 2}
        width={width}
        height={2}
        fill="rgba(148,163,184,0.4)"
      />
      {marks}
      {isPlaying && (
        <rect
          x={width / 2 - 1}
          y={height - 24}
          width={2}
          height={12}
          fill="#22d3ee"
          opacity={0.8}
        >
          <animate
            attributeName="opacity"
            values="0.2;0.8;0.2"
            dur="1.2s"
            repeatCount="indefinite"
          />
        </rect>
      )}
    </svg>
  );
}

export default SvgTimeline;
