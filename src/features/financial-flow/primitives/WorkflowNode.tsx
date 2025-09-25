import { motion } from "framer-motion";
import * as d3 from "d3";

import { usePresentationTimelineStore } from "@/shared/hooks/presentationTimelineStore";
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
  baseDeltaPercent?: number;
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
  baseDeltaPercent,
  x,
  y,
  radius,
  isActive = false,
  onHover,
  viewState = "standard",
}: WorkflowNodeProps) {
  const valueLabel = formatCurrency(aggregateValue);
  const hasBaseDeltaPercent =
    baseDeltaPercent !== undefined && !Number.isNaN(baseDeltaPercent);
  const formattedBaseDeltaPercent = hasBaseDeltaPercent
    ? `${baseDeltaPercent > 0 ? "+" : ""}${baseDeltaPercent.toFixed(1)}%`
    : null;
  const baseDeltaColor =
    !hasBaseDeltaPercent || baseDeltaPercent === 0
      ? "rgba(148,163,184,0.65)"
      : baseDeltaPercent && baseDeltaPercent > 0
      ? "#22c55e"
      : "#f87171";

  const arcGenerator = d3.arc();
  const arcsBase = computeLayerArcs(layers, radius - 6);
  const arcsMid = computeLayerArcs(midSegments, radius);
  const arcsHigh = computeLayerArcs(highSegments, radius + 6);

  return (
    <motion.g
      role="button"
      tabIndex={0}
      aria-label={
        formattedBaseDeltaPercent
          ? `${label}: ${valueLabel}, ${formattedBaseDeltaPercent} change vs previous day`
          : `${label}: ${valueLabel}`
      }
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
        {formattedBaseDeltaPercent && (
          <motion.text
            x={0}
            y={32}
            textAnchor="middle"
            fontSize={18}
            fontWeight={500}
            fill={baseDeltaColor}
          >
            {formattedBaseDeltaPercent}
          </motion.text>
        )}
      </g>
    </motion.g>
  );
}

export default WorkflowNode;
