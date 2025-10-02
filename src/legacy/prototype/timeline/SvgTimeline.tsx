// SvgTimeline.tsx
import React, { useCallback, useMemo } from 'react';

interface TimelinePoint {
  id: string;
  label: string;
  netPayouts: number;
  totalCharity: number;
  totalFees: number;
}

interface SvgTimelineProps {
  data: TimelinePoint[];
  activeIndex: number;
  width: number;
  height: number;
  scrubShift: number; // This is the translateX value for the ruler group
}

const SvgTimeline = ({ data, activeIndex, width, height, scrubShift }: SvgTimelineProps) => {
  const indentHeight = 10;
  const activeIndentHeight = 15; // Taller for active mark
  const indentWidth = 2;
  const indentSpacing = 150; // Consistent spacing between ruler marks
  const labelYOffset = 58; // Y position for labels, relative to SVG top (near bottom)

  // Calculate the x-position for each point relative to the active index being centered initially
  const getPointX = useCallback(
    (index: number) => {
      // If data.length is 0 or 1, position the single point/mark centrally
      if (data.length <= 1) return width / 2;

      // The "center" of our SVG viewport, where the active mark should ideally align when not scrubbing
      const svgCenter = width / 2;

      // Calculate the X position of this specific mark, relative to the active mark's desired position.
      // We want the active mark to be at `svgCenter` (or slightly offset for aesthetic)
      // So, point `index` will be `svgCenter` + `(index - activeIndex) * indentSpacing`
      // For index 0, this shifts left; for index > activeIndex, shifts right.
      return svgCenter + (index - activeIndex) * indentSpacing;
    },
    [data.length, width, activeIndex, indentSpacing],
  );

  const ticksSVG = useMemo(() => {
    return data.map((point, index) => {
      const xPos = getPointX(index);
      const isActive = index === activeIndex;
      const currentIndentHeight = isActive ? activeIndentHeight : indentHeight;
      const yPos = height - currentIndentHeight; // Indent starts from bottom

      // Determine label visibility (Start, End, or if few points)
      const showLabel = index === 0 || index === data.length - 1 || data.length <= 4;

      // Color logic for progression (before active, active, after active)
      const indentFill =
        index < activeIndex
          ? 'rgba(14,165,233,0.4)' // Before active: subtle blue
          : isActive
          ? 'rgba(14,165,233,1)' // Active: full blue
          : 'rgba(14,165,233,0.2)'; // After active: very faint blue

      const labelFill = isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)';

      return (
        <g key={point.id} className={`timeline-point ${isActive ? 'active' : ''}`}>
          <rect
            x={xPos - indentWidth / 2} // Center the rect on xPos
            y={yPos}
            width={indentWidth}
            height={currentIndentHeight}
            rx="0.5" ry="0.5"
            fill={indentFill}
            stroke="none"
            style={{ transition: 'fill 0.2s ease-out, height 0.2s ease-out, y 0.2s ease-out' }} // Smooth transitions
          />
          {showLabel && (
            <text
              x={xPos} y={labelYOffset}
              fontSize="9" textAnchor="middle"
              fill={labelFill}
              style={{ transition: 'fill 0.2s ease-out' }} // Smooth transitions
            >
              {point.label}
            </text>
          )}
        </g>
      );
    });
  }, [data, activeIndex, getPointX, height, indentWidth, indentHeight, activeIndentHeight, labelYOffset]);


  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
      {/* Background (optional, or handled by HTML wrapper) */}
      {/* <rect x="0" y="0" width={width} height={height} fill="transparent" /> */}

      {/* Group for the ruler marks, which will be translated */}
      <g
        className="timeline-ruler-marks"
        style={{ transform: `translateX(${scrubShift}px)`, transition: 'transform 0.2s ease-out' }}
      >
        {ticksSVG}
      </g>
    </svg>
  );
};

export default SvgTimeline;
