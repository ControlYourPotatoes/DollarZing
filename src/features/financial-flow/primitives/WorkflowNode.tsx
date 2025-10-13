import { useEffect, useMemo, useCallback, useRef } from "react";

import * as d3 from "d3";
import { motion } from "framer-motion";

type DefaultArcObject = d3.DefaultArcObject;

import { usePresentationTimelineStore } from "@/shared/hooks/presentationTimelineStore";
import { PresentationWorkflowLayer } from "@/shared/presentation";

import { WorkflowRingKey } from "../types";

type ArcData = {
  data: PresentationWorkflowLayer;
  startAngle: number;
  endAngle: number;
};

type RingDescriptor = {
  key: WorkflowRingKey;
  arcs: ArcData[];
  innerRadius: number;
  outerRadius: number;
};

type RingSizingVariant = {
  innerOffset: number;
  thickness: number;
  gapToNext: number;
};

type RingSizingConfig = Record<
  WorkflowRingKey,
  {
    default: RingSizingVariant;
    active?: RingSizingVariant;
    hovered?: RingSizingVariant;
  }
>;

const RING_ORDER: WorkflowRingKey[] = ["base", "mid", "high"];

const DEFAULT_RING_SIZING_CONFIG: RingSizingConfig = {
  base: {
    default: { innerOffset: 0, thickness: 10, gapToNext: 2 },
    active: { innerOffset: 1, thickness: 12, gapToNext: 4 },
    hovered: { innerOffset: -2, thickness: 26, gapToNext: 16 },
  },
  mid: {
    default: { innerOffset: 0, thickness: 10, gapToNext: 2 },
    active: { innerOffset: 1, thickness: 14, gapToNext: 4 },
    hovered: { innerOffset: -2, thickness: 30, gapToNext: 16 },
  },
  high: {
    default: { innerOffset: 0, thickness: 10, gapToNext: 0 },
    active: { innerOffset: 0, thickness: 18, gapToNext: 10 },
    hovered: { innerOffset: 6, thickness: 30, gapToNext: 16 },
  },
};

// const RING_ANIMATION_DURATIONS: Record<RingSizingState, number> = {
//   default: 0.12,
//   active: 0.16,
//   hovered: 0.22,
// };

export type WorkflowNodeProps = {
  id: string;
  label: string;
  aggregateValue: number;
  layers?: PresentationWorkflowLayer[];
  midSegments?: PresentationWorkflowLayer[];
  highSegments?: PresentationWorkflowLayer[];
  baseDeltaPercent?: number;
  midDeltaPercent?: number;
  highDeltaPercent?: number;
  x: number;
  y: number;
  radius: number;
  isActive?: boolean;
  onHover?: (id: string | null) => void;
  onToggle?: (id: string) => void;
  ringSizing?: RingSizingConfig;
  baseValue?: number; // Target for base ring
  midValue?: number; // Target for mid
  highValue?: number; // Target for high
};

function computeArcs(
  layers?: PresentationWorkflowLayer[],
  targetValue?: number
): ArcData[] {
  if (!layers || layers.length === 0) return [];
  const sum = layers.reduce((s, l) => s + l.value, 0);
  const effectiveTarget = (targetValue ?? sum) || 1;
  const sorted = [...layers].sort((a, b) => a.id.localeCompare(b.id));
  let startAngle = -Math.PI / 2;
  const arcs: ArcData[] = [];
  let usedFraction = 0;
  for (const seg of sorted) {
    const fraction = Math.min(1, seg.value / effectiveTarget);
    usedFraction += fraction;
  }
  const scale = Math.min(1, 1 / usedFraction); // Cap total to 1
  startAngle = -Math.PI / 2;
  for (const seg of sorted) {
    const fraction = Math.min(1, seg.value / effectiveTarget) * scale;
    const arcLength = 2 * Math.PI * fraction;
    const endAngle = startAngle + arcLength;
    arcs.push({ data: seg, startAngle, endAngle });
    startAngle = endAngle;
  }
  return arcs;
}

export function WorkflowNode({
  id,
  label,
  aggregateValue,
  layers = [],
  midSegments = [],
  highSegments = [],
  baseDeltaPercent,
  x,
  y,
  radius,
  isActive = false,
  onHover,
  onToggle,
  ringSizing,
  baseValue,
  midValue,
  highValue,
}: WorkflowNodeProps) {
  // Store hooks right after props
  const hoveredRingKey = usePresentationTimelineStore(
    (state) => state.hoveredRingKey
  );
  const setHoveredRing = usePresentationTimelineStore(
    (state) => state.setHoveredRing
  );
  const setStoreHoveredNode = usePresentationTimelineStore(
    (state) => state.setHoveredNode
  );

  const ringHoverKey = hoveredRingKey ?? null;

  const svgRef = useRef<SVGSVGElement>(null);

  // State for current radii
  // No [currentRingRadii] in deps

  const arcGenerator = useMemo(() => d3.arc<DefaultArcObject>(), []);

  // Compute absolute radii for all rings
  const ringDescriptors = useMemo(() => {
    const sizing = ringSizing ?? DEFAULT_RING_SIZING_CONFIG;
    const descriptors: RingDescriptor[] = [];
    let currentOuter = radius;

    for (const key of RING_ORDER) {
      const config = sizing[key];
      const isCurrentHovered = ringHoverKey === key;
      let variant = config.default;
      if (isActive && config.active) {
        variant = config.active;
      }
      if (isCurrentHovered && config.hovered) {
        variant = config.hovered;
      }

      const segments =
        key === "base" ? layers : key === "mid" ? midSegments : highSegments;
      const sum = segments.reduce((s, l) => s + l.value, 0);
      let target = undefined;
      if (key === "base") target = baseValue ? baseValue * 1.3 : sum;
      else if (key === "mid") target = midValue ? midValue * 1.2 : sum;
      else if (key === "high") target = highValue ? highValue * 1.5 : sum;
      const arcs = computeArcs(segments, target);

      const outerRadius = Math.max(
        0,
        currentOuter + variant.innerOffset + variant.thickness
      );
      const innerRadius = Math.max(0, outerRadius - variant.thickness);

      descriptors.push({ key, arcs, innerRadius, outerRadius });
      currentOuter = outerRadius + variant.gapToNext;
    }

    return descriptors;
  }, [
    layers,
    midSegments,
    highSegments,
    radius,
    ringHoverKey,
    ringSizing,
    isActive,
    baseValue,
    midValue,
    highValue,
  ]);

  // Compute totals for rings
  const { midTotal, highTotal } = useMemo(() => {
    const midTarget =
      midValue ?? midSegments.reduce((sum, seg) => sum + seg.value, 0);
    const highTarget =
      highValue ?? highSegments.reduce((sum, seg) => sum + seg.value, 0);
    return { midTotal: midTarget, highTotal: highTarget };
  }, [midSegments, highSegments, midValue, highValue]);

  // Helper for polar to cartesian
  const polarToCartesian = (
    centerX: number,
    centerY: number,
    radius: number,
    angleInDegrees: number
  ) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  // Interactive radius
  const interactiveRadius = useMemo(() => {
    const maxOuter = ringDescriptors.reduce((acc, descriptor) => {
      return Math.max(acc, descriptor.outerRadius);
    }, radius);
    return Math.max(maxOuter + 24, radius * 1.25);
  }, [ringDescriptors, radius]);

  // D3 animation effect
  useEffect(() => {
    if (!svgRef.current) return;

    RING_ORDER.forEach((key) => {
      const descriptor = ringDescriptors.find((d) => d.key === key);
      if (!descriptor) return;

      const targetOpacity = ringHoverKey === key ? 0.95 : 0.75;

      const selection = d3
        .select(svgRef.current)
        .selectAll(`.ring-${key} .ring-path`);

      selection
        .transition()
        .duration(200)
        .ease(d3.easeCubicOut)
        .style("opacity", targetOpacity);
    });
  }, [ringHoverKey, ringDescriptors]); // Deps: only hover, no currentRingRadii

  const handleRingHover = useCallback(
    (e: React.PointerEvent<SVGCircleElement>) => {
      const svg = e.currentTarget.ownerSVGElement;
      if (!svg) return;

      const point = svg.createSVGPoint();
      point.x = e.clientX;
      point.y = e.clientY;

      const ctm = e.currentTarget.getScreenCTM();
      if (!ctm) return;

      const localPoint = point.matrixTransform(ctm.inverse());
      const distance = Math.hypot(localPoint.x, localPoint.y);

      if (distance > interactiveRadius) {
        if (ringHoverKey !== null) {
          setHoveredRing(null);
        }
        return;
      }

      let newHoveredRing: WorkflowRingKey | null = null;
      for (const desc of ringDescriptors) {
        if (distance >= desc.innerRadius && distance < desc.outerRadius) {
          newHoveredRing = desc.key;
          break;
        }
      }

      if (newHoveredRing !== ringHoverKey) {
        setHoveredRing(newHoveredRing);
      }
    },
    [ringDescriptors, ringHoverKey, setHoveredRing, interactiveRadius]
  );

  // Update renderRing to include gap text and totals
  const renderRing = (
    descriptor: RingDescriptor,
    index: number,
    descriptors: RingDescriptor[]
  ) => {
    if (!descriptor.arcs.length) return null;
    const { key, arcs, innerRadius, outerRadius } = descriptor;
    const nextDescriptor = descriptors[index + 1];
    const showGapText = index < descriptors.length - 1;
    const gapMidRadius = showGapText
      ? (outerRadius + nextDescriptor.innerRadius) / 2
      : null;
    const totalText =
      key === "mid"
        ? formatCurrency(midTotal)
        : key === "high"
        ? formatCurrency(highTotal)
        : null;

    const gapTextPos = showGapText
      ? polarToCartesian(0, 0, gapMidRadius!, 0)
      : { x: 0, y: 0 };
    const totalPos = totalText
      ? polarToCartesian(0, 0, outerRadius + 5, 0)
      : { x: 0, y: 0 };

    return (
      <g className={`ring-${key}`} key={key}>
        {arcs.map((arc) => {
          const arcShape: DefaultArcObject = {
            innerRadius,
            outerRadius,
            startAngle: arc.startAngle, // Already partial
            endAngle: arc.endAngle,
          };
          const path = arcGenerator(arcShape);
          return (
            <motion.path
              className={`ring-path ${key}`}
              key={`${key}-${arc.data.id}`}
              d={path || ""}
              fill={
                arc.data.color && arc.data.color !== "transparent"
                  ? arc.data.color
                  : "rgba(148,163,184,0.2)"
              }
              style={{ opacity: ringHoverKey === key ? 0.95 : 0.75 }}
              stroke="#0f172a"
              strokeWidth={0.8}
              pointerEvents="none"
              initial={false}
              animate={{ d: path || "" }}
              transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
            />
          );
        })}
        {totalText && ringHoverKey === key && (
          <text
            x={totalPos.x}
            y={totalPos.y}
            textAnchor="start"
            fontSize={12}
            fontWeight={500}
            fill="#f8fafc"
            pointerEvents="none"
          >
            {totalText}
          </text>
        )}
        {showGapText && ringHoverKey === key && (
          <text
            x={gapTextPos.x}
            y={gapTextPos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            fontWeight={400}
            fill="#cbd5e1"
            pointerEvents="none"
          >
            {key.toUpperCase()}
          </text>
        )}
      </g>
    );
  };

  // Define renderDelta before use
  const renderDelta = (
    percent: number | undefined,
    positiveColor = "#22c55e"
  ) => {
    if (percent === undefined || Number.isNaN(percent)) {
      return { label: null, color: "rgba(148,163,184,0.65)" };
    }
    const rounded = percent.toFixed(1);
    const labelText = `${percent > 0 ? "+" : ""}${rounded}%`;
    const color =
      percent > 0
        ? positiveColor
        : percent < 0
        ? "#f87171"
        : "rgba(148,163,184,0.65)";
    return { label: labelText, color };
  };

  // Format currency utility (add if not imported)
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const valueLabel = formatCurrency(aggregateValue);

  const baseDeltaMeta = renderDelta(baseDeltaPercent);

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={
        baseDeltaMeta.label
          ? `${label}: ${valueLabel}, ${baseDeltaMeta.label} change vs previous day`
          : `${label}: ${valueLabel}`
      }
      onFocus={() => {
        onHover?.(id);
        setStoreHoveredNode(id);
      }}
      onBlur={() => {
        onHover?.(null);
        setStoreHoveredNode(null);
        setHoveredRing(null);
      }}
      onMouseEnter={() => {
        onHover?.(id);
        setStoreHoveredNode(id);
      }}
      onMouseLeave={() => {
        onHover?.(null);
        setStoreHoveredNode(null);
        setHoveredRing(null);
      }}
      onClick={() => {
        onToggle?.(id);
        if (!onToggle) {
          onHover?.(id);
          setStoreHoveredNode(id);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (onToggle) {
            onToggle(id);
          } else {
            onHover?.(id);
            setStoreHoveredNode(id);
          }
        }
        if (e.key === "Escape") {
          onHover?.(null);
          setStoreHoveredNode(null);
          setHoveredRing(null);
        }
      }}
    >
      <g ref={svgRef} transform={`translate(${x}, ${y})`}>
        <defs>
          {ringDescriptors.map((desc) => {
            const pathId = `ring-path-${id}-${desc.key}`;
            // Path at the center of the ring for curved text
            const centerRadius = (desc.innerRadius + desc.outerRadius) / 2;
            // Path starting at top to match gauge direction
            const pathD = `M 0,${-centerRadius} A ${centerRadius},${centerRadius} 0 1,1 0,${centerRadius} A ${centerRadius},${centerRadius} 0 1,1 0,${-centerRadius}`;
            return <path key={pathId} id={pathId} d={pathD} fill="none" />;
          })}
        </defs>
        <circle
          cx={0}
          cy={0}
          r={interactiveRadius}
          fill="transparent"
          stroke="none"
          pointerEvents="all"
          onPointerEnter={handleRingHover}
          onPointerMove={handleRingHover}
          onPointerLeave={() => setHoveredRing(null)}
        />
        <circle
          cx={0}
          cy={0}
          r={radius}
          fill="rgba(15, 23, 42, 0.85)"
          stroke="rgba(148, 163, 184, 0.35)"
          strokeWidth={3}
          pointerEvents="none"
        />
        {ringDescriptors.map((desc, idx) =>
          renderRing(desc, idx, ringDescriptors)
        )}
        {/* Curved text for ring descriptors */}
        {ringDescriptors.map((desc) => {
          const isHovered = ringHoverKey === desc.key;
          const pathId = `ring-path-${id}-${desc.key}`;
          // Dynamic color based on ring key for contrast
          const textColor = desc.key === "base" ? "black" : "white";
          const label =
            desc.key === "base" ? "Base" : desc.key === "mid" ? "Mid" : "High";
          return (
            <text
              key={`text-${desc.key}`}
              fontSize={isHovered ? 12 : 8}
              fontWeight={isHovered ? 600 : 400}
              fill={textColor}
              textAnchor="middle"
              dominantBaseline="middle"
              opacity={isHovered ? 1 : 0.3}
            >
              <textPath href={`#${pathId}`} startOffset="12.5%">
                {label}
              </textPath>
            </text>
          );
        })}
        {/* Curved text for ring totals at the filled amount location */}
        {ringDescriptors.map((desc) => {
          const segments =
            desc.key === "base"
              ? layers
              : desc.key === "mid"
              ? midSegments
              : highSegments;
          const totalValue = segments.reduce((sum, seg) => sum + seg.value, 0);
          const pathId = `ring-path-${id}-${desc.key}`;
          // Dynamic color based on ring key for contrast
          const textColor = desc.key === "base" ? "black" : "white";
          // Calculate effectiveTarget as in computeArcs
          const sum = segments.reduce((s, l) => s + l.value, 0);
          const target =
            desc.key === "base"
              ? baseValue
              : desc.key === "mid"
              ? midValue
              : highValue;
          const effectiveTarget = target
            ? target *
              (desc.key === "base" ? 1.3 : desc.key === "mid" ? 1.2 : 1.5)
            : sum;
          const percentage =
            effectiveTarget > 0
              ? Math.min((totalValue / effectiveTarget) * 100, 100)
              : 0;
          return (
            <motion.text
              key={`total-${desc.key}`}
              fontSize={10}
              fill={textColor}
              textAnchor="middle"
              dominantBaseline="middle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <motion.textPath
                href={`#${pathId}`}
                startOffset={`${percentage}%`}
              >
                {formatCurrency(totalValue)}
              </motion.textPath>
            </motion.text>
          );
        })}
        <g transform="translate(0, -6)">
          {label.split(" ").map((word, index, array) => {
            const lineHeight = 16;
            const totalHeight = array.length * lineHeight;
            const startY = -totalHeight / 2 + lineHeight / 2;
            return (
              <text
                key={index}
                x={0}
                y={startY + index * lineHeight}
                textAnchor="middle"
                fontSize={20}
                fontWeight={600}
                fill="#e2e8f0"
                pointerEvents="none"
              >
                {word}
              </text>
            );
          })}
          <text
            x={0}
            y={35}
            textAnchor="middle"
            fontSize={22}
            fontWeight={500}
            fill="#f8fafc"
            pointerEvents="none"
          >
            {valueLabel}
          </text>
          {baseDeltaMeta.label && (
            <text
              x={0}
              y={35}
              textAnchor="middle"
              fontSize={16}
              fontWeight={600}
              fill={baseDeltaMeta.color}
              pointerEvents="none"
            >
              {baseDeltaMeta.label}
            </text>
          )}
        </g>
      </g>
    </g>
  );
}

export default WorkflowNode;
