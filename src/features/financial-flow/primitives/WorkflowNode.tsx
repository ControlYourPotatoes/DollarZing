import { motion } from "framer-motion";
import * as d3 from "d3";

import { usePresentationTimelineStore } from "@/shared/hooks/presentationTimelineStore";
import { PresentationWorkflowLayer } from "@/shared/presentation";

import { useWorkflowNodeAnimation } from "../hooks/useWorkflowNodeAnimation";
import {
  WorkflowNodeViewState,
  WorkflowRingKey,
  WorkflowRingMetrics,
} from "../types";

type ArcData = {
  data: PresentationWorkflowLayer;
  startAngle: number;
  endAngle: number;
  padAngle: number;
};

type RingDescriptor = {
  key: WorkflowRingKey;
  arcs: ArcData[];
  thickness: number;
  direction: "inner" | "outer";
  activeOpacity: number;
  inactiveOpacity: number;
  delayStart: number;
  delayStep: number;
  duration?: number;
};

export interface WorkflowNodeProps {
  id: string;
  label: string;
  aggregateValue: number;
  layers?: PresentationWorkflowLayer[];
  midSegments?: PresentationWorkflowLayer[];
  highSegments?: PresentationWorkflowLayer[];
  baseValue?: number;
  midValue?: number;
  highValue?: number;
  basePercent?: number;
  midPercent?: number;
  highPercent?: number;
  x: number;
  y: number;
  radius: number;
  isActive?: boolean;
  onHover?: (id: string | null) => void;
  viewState?: WorkflowNodeViewState;
}

function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function computeArcs(layers: PresentationWorkflowLayer[]): ArcData[] {
  if (!layers || layers.length === 0) {
    return [];
  }
  const total = layers.reduce((sum, layer) => sum + layer.value, 0);
  if (total === 0) return [];
  const sorted = [...layers].sort((a, b) => a.id.localeCompare(b.id));
  let startAngle = -Math.PI / 2;
  const arcs: ArcData[] = [];
  for (const seg of sorted) {
    const fraction = seg.value / total;
    const arcLengthRadians = 2 * Math.PI * fraction;
    const padAngle_local = Math.min(0.1, arcLengthRadians * 0.15);
    const endAngle = startAngle + arcLengthRadians;
    arcs.push({ data: seg, startAngle, endAngle, padAngle: 0 });
    startAngle = endAngle + padAngle_local;
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
  baseValue,
  midValue,
  highValue,
  basePercent = 0,
  midPercent = 0,
  highPercent = 0,
  x,
  y,
  radius,
  isActive = false,
  onHover,
  viewState = "standard",
}: WorkflowNodeProps) {
  const valueLabel = `${formatCurrency(aggregateValue)} (${Math.round(
    basePercent
  )}%)`;
  const arcsBase = computeArcs(layers);
  const arcsMid = computeArcs(midSegments);
  const arcsHigh = computeArcs(highSegments);
  const arcGenerator = d3.arc();

  const nodeViewState = usePresentationTimelineStore((state) =>
    state.nodeViewStates[id] ?? viewState
  );
  const setStoreHoveredNode = usePresentationTimelineStore(
    (state) => state.setHoveredNode
  );
  const hoveredRingKey = usePresentationTimelineStore(
    (state) => state.hoveredRingKey
  );
  const setHoveredRing = usePresentationTimelineStore(
    (state) => state.setHoveredRing
  );
  const simulationPhase = usePresentationTimelineStore(
    (state) => state.simulationPhase
  );

  const layoutPresets: Record<WorkflowNodeViewState, {
    baseScale: number;
    midScale: number;
    highScale: number;
    minBase: number;
    minMid: number;
    minHigh: number;
    innerGapScale: number;
    outerGapScale: number;
    minInnerGap: number;
    minOuterGap: number;
  }> = {
    compact: {
      baseScale: 0.22,
      midScale: 0.08,
      highScale: 0.1,
      minBase: 6,
      minMid: 4,
      minHigh: 4,
      innerGapScale: 0.05,
      outerGapScale: 0.05,
      minInnerGap: 2,
      minOuterGap: 3,
    },
    standard: {
      baseScale: 0.2,
      midScale: 0.24,
      highScale: 0.28,
      minBase: 6,
      minMid: 8,
      minHigh: 10,
      innerGapScale: 0.08,
      outerGapScale: 0.08,
      minInnerGap: 2,
      minOuterGap: 3,
    },
    expanded: {
      baseScale: 0.24,
      midScale: 0.3,
      highScale: 0.34,
      minBase: 8,
      minMid: 10,
      minHigh: 12,
      innerGapScale: 0.1,
      outerGapScale: 0.1,
      minInnerGap: 3,
      minOuterGap: 4,
    },
  };

  const effectiveViewState: WorkflowNodeViewState = isActive
    ? nodeViewState
    : "compact";

  const preset = layoutPresets[effectiveViewState];
  const baseThickness = preset.minBase + (radius * preset.baseScale * (basePercent / 100));
  const midThickness = preset.minMid + (radius * preset.midScale * (midPercent / 100));
  const highThickness = preset.minHigh + (radius * preset.highScale * (highPercent / 100));
  const innerRingGap = Math.max(preset.minInnerGap, radius * preset.innerGapScale);
  const outerRingGap = Math.max(preset.minOuterGap, radius * preset.outerGapScale);

  const ringMetrics: WorkflowRingMetrics[] = [
    {
      key: "base",
      value: baseValue ?? arcsBase.reduce((sum, arc) => sum + arc.data.value, 0),
    },
    {
      key: "mid",
      value: midValue ?? arcsMid.reduce((sum, arc) => sum + arc.data.value, 0),
    },
    {
      key: "high",
      value: highValue ?? arcsHigh.reduce((sum, arc) => sum + arc.data.value, 0),
    },
  ];

  const { nodeControls, ringControls, orderedRings } = useWorkflowNodeAnimation({
    nodeId: id,
    viewState: effectiveViewState,
    isActive,
    rings: ringMetrics,
    ringHoverKey: hoveredRingKey,
    phase: simulationPhase,
  });

  const baseDescriptorMap: Record<WorkflowRingKey, RingDescriptor> = {
    base: {
      key: "base",
      arcs: arcsBase,
      thickness: baseThickness,
      direction: "inner",
      activeOpacity: 1,
      inactiveOpacity: 0.9,
      delayStart: 0.06,
      delayStep: 0.05,
      duration: 0.3,
    },
    mid: {
      key: "mid",
      arcs: arcsMid,
      thickness: midThickness,
      direction: "outer",
      activeOpacity: 0.9,
      inactiveOpacity: 0.5,
      delayStart: 0.05,
      delayStep: 0.05,
      duration: 0.25,
    },
    high: {
      key: "high",
      arcs: arcsHigh,
      thickness: highThickness,
      direction: "outer",
      activeOpacity: 0.85,
      inactiveOpacity: 0.45,
      delayStart: 0.02,
      delayStep: 0.05,
      duration: 0.25,
    },
  };

  const orderedRingDescriptors: RingDescriptor[] = orderedRings
    .map((ring) => baseDescriptorMap[ring.key])
    .filter(Boolean);

  const sortedDescriptors = orderedRingDescriptors
    .map((descriptor) => ({
      ...descriptor,
      totalValue: descriptor.arcs.reduce(
        (sum, arcItem) => sum + arcItem.data.value,
        0
      ),
    }))
    .sort((a, b) => {
      if (a.direction !== b.direction) {
        return a.direction === "inner" ? -1 : 1;
      }
      if (a.direction === "inner") {
        return b.totalValue - a.totalValue;
      }
      return b.totalValue - a.totalValue;
    });

  const renderRing = (
    descriptor: RingDescriptor,
    innerRadius: number,
    outerRadius: number
  ) => {
    if (!descriptor.arcs.length) return null;
    const controls = ringControls[descriptor.key];
    const ringKey = descriptor.key;
    return (
      <motion.g
        key={`ring-${ringKey}`}
        animate={controls}
        onMouseEnter={() => setHoveredRing(ringKey)}
        onFocus={() => setHoveredRing(ringKey)}
        onMouseLeave={() => setHoveredRing(null)}
        onBlur={() => setHoveredRing(null)}
      >
        {descriptor.arcs.map((arcItem, index) => {
          const arcData = {
            innerRadius,
            outerRadius,
            startAngle: arcItem.startAngle,
            endAngle: arcItem.endAngle,
            padAngle: 0,
          };
          const dPath = arcGenerator(arcData) || "";
          return (
            <motion.path
              key={`${descriptor.key}-${arcItem.data.id}`}
              d={dPath}
              fill={arcItem.data.color}
              stroke="none"
              initial={{ opacity: 0, pathLength: 0 }}
              animate={{
                opacity: isActive
                  ? descriptor.activeOpacity
                  : descriptor.inactiveOpacity,
                pathLength: 1,
              }}
              transition={{
                delay: descriptor.delayStart + index * descriptor.delayStep,
                duration: descriptor.duration ?? 0.28,
              }}
            />
          );
        })}
      </motion.g>
    );
  };

  let nextInnerRingOuter = radius - innerRingGap;
  const innerRingNodes = sortedDescriptors
    .filter((descriptor) => descriptor.direction === "inner" && descriptor.arcs.length)
    .flatMap((descriptor) => {
      const outerRadius = Math.max(0, nextInnerRingOuter);
      const innerRadius = Math.max(0, outerRadius - descriptor.thickness);
      nextInnerRingOuter = innerRadius - innerRingGap;
      return renderRing(descriptor, innerRadius, outerRadius);
    });

  let nextOuterRingInner = radius + outerRingGap;
  let maxOuterRingRadius = radius;
  const outerRingNodes = sortedDescriptors
    .filter((descriptor) => descriptor.direction === "outer" && descriptor.arcs.length)
    .flatMap((descriptor) => {
      const innerRadius = Math.max(0, nextOuterRingInner);
      const outerRadius = innerRadius + descriptor.thickness;
      maxOuterRingRadius = Math.max(maxOuterRingRadius, outerRadius);
      nextOuterRingInner = outerRadius + outerRingGap;
      return renderRing(descriptor, innerRadius, outerRadius);
    });

  const interactiveRadius = Math.max(radius, maxOuterRingRadius);

  return (
    <motion.g
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${valueLabel}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={nodeControls}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      onFocus={() => {
        onHover?.(id);
        setStoreHoveredNode(id);
      }}
      onBlur={() => {
        onHover?.(null);
        setStoreHoveredNode(null);
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
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onHover?.(id);
          setStoreHoveredNode(id);
        }
        if (e.key === "Escape") {
          onHover?.(null);
          setStoreHoveredNode(null);
          setHoveredRing(null);
        }
      }}
    >
      <g transform={`translate(${x}, ${y})`}>
        <circle
          cx={0}
          cy={0}
          r={interactiveRadius}
          fill="transparent"
          stroke="none"
          pointerEvents="all"
        />
        <motion.circle
          cx={0}
          cy={0}
          r={radius}
          fill="rgba(15, 23, 42, 0.85)" 
          stroke={isActive ? "#38bdf8" : "rgba(148, 163, 184, 0.35)"}
          strokeWidth={isActive ? 4 : 3}
        />
        {/* Inner stacked rings anchor to the node and size themselves to prevent overlap */}
        {innerRingNodes}
        {/* Outer stacked rings radiate outward without colliding */}
        {outerRingNodes}
        <motion.text
          x={0}
          y={-radius - 24}
          textAnchor="middle"
          fontSize={24}
          fill="rgba(148,163,184,0.85)" 
        >
          {label}
        </motion.text>
        <motion.text
          x={0}
          y={8}
          textAnchor="middle"
          fontSize={20}
          fontWeight={500}
          fill="#f8fafc"
        >
          {valueLabel}
        </motion.text>
      </g>
    </motion.g>
  );
}

export default WorkflowNode;
