import { useEffect, useMemo } from "react";

import { motion, useSpring } from "framer-motion";
import * as d3 from "d3";

type DefaultArcObject = d3.DefaultArcObject;

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

type RingSizingConfig = Record<WorkflowRingKey, {
  default: RingSizingVariant;
  active?: RingSizingVariant;
  hovered?: RingSizingVariant;
}>;

const RING_ORDER: WorkflowRingKey[] = ["base", "mid", "high"];

const DEFAULT_RING_SIZING_CONFIG: RingSizingConfig = {
  base: {
    default: { innerOffset: 1, thickness: 12, gapToNext: 2 },
    active: { innerOffset: 1, thickness: 16, gapToNext: 6 },
    hovered: { innerOffset: 0, thickness: 22, gapToNext: 10 },
  },
  mid: {
    default: { innerOffset: 0, thickness: 10, gapToNext: 2 },
    active: { innerOffset: 0, thickness: 14, gapToNext: 4 },
    hovered: { innerOffset: -2, thickness: 20, gapToNext: 8 },
  },
  high: {
    default: { innerOffset: 0, thickness: 10, gapToNext: 0 },
    active: { innerOffset: 0, thickness: 12, gapToNext: 0 },
    hovered: { innerOffset: -2, thickness: 18, gapToNext: 0 },
  },
};

export type WorkflowNodeProps = {
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
  midDeltaPercent?: number;
  highDeltaPercent?: number;
  x: number;
  y: number;
  radius: number;
  isActive?: boolean;
  onHover?: (id: string | null) => void;
  onToggle?: (id: string) => void;
  viewState?: WorkflowNodeViewState;
  ringSizing?: RingSizingConfig;
};

function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function computeArcs(layers?: PresentationWorkflowLayer[]): ArcData[] {
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
    const endAngle = startAngle + arcLengthRadians;
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
  baseValue,
  midValue,
  highValue,
  baseDeltaPercent,
  x,
  y,
  radius,
  isActive = false,
  onHover,
  onToggle,
  viewState = "standard",
  ringSizing,
}: WorkflowNodeProps) {
  const valueLabel = formatCurrency(aggregateValue);
  const renderDelta = (
    percent: number | undefined,
    positiveColor = "#22c55e"
  ): { label: string | null; color: string } => {
    if (percent === undefined || Number.isNaN(percent)) {
      return { label: null, color: "rgba(148,163,184,0.65)" };
    }
    const rounded = percent.toFixed(1);
    const labelText = `${percent > 0 ? "+" : ""}${rounded}%`;
    const color = percent > 0 ? positiveColor : percent < 0 ? "#f87171" : "rgba(148,163,184,0.65)";
    return { label: labelText, color };
  };
  const baseDeltaMeta = renderDelta(baseDeltaPercent);

  const rings: WorkflowRingMetrics[] = useMemo(
    () => {
      const base = baseValue ?? aggregateValue ?? 0;
      const mid = midValue ?? 0;
      const high = highValue ?? 0;
      const total = Math.max(base, mid, high, 1);
      return [
        { key: "base", value: base, percent: base / total },
        { key: "mid", value: mid, percent: mid / total },
        { key: "high", value: high, percent: high / total },
      ];
    },
    [aggregateValue, baseValue, midValue, highValue]
  );

  const hoveredRingKey = usePresentationTimelineStore(
    (state) => state.hoveredRingKey
  );
  const simulationPhase = usePresentationTimelineStore(
    (state) => state.simulationPhase
  );
  const setStoreHoveredNode = usePresentationTimelineStore(
    (state) => state.setHoveredNode
  );
  const setHoveredRing = usePresentationTimelineStore(
    (state) => state.setHoveredRing
  );
  const ringHoverKey = hoveredRingKey ?? null;

  const {
    nodeControls,
    ringControls,
  } = useWorkflowNodeAnimation({
    nodeId: id,
    isActive,
    viewState,
    rings,
    ringHoverKey,
    phase: simulationPhase,
  });

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

      const arcs =
        key === "base"
          ? computeArcs(layers)
          : key === "mid"
          ? computeArcs(midSegments)
          : computeArcs(highSegments);

      const outerRadius = Math.max(0, currentOuter + variant.innerOffset + variant.thickness);
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
  ]);

  const arcGenerator = useMemo(() => d3.arc<DefaultArcObject>(), []);
  const springConfig = { stiffness: 260, damping: 28, mass: 0.8 } as const;
  const baseInnerRadius = useSpring(radius, springConfig);
  const baseOuterRadius = useSpring(radius, springConfig);
  const midInnerRadius = useSpring(radius, springConfig);
  const midOuterRadius = useSpring(radius, springConfig);
  const highInnerRadius = useSpring(radius, springConfig);
  const highOuterRadius = useSpring(radius, springConfig);

  const getRingMotion = (key: WorkflowRingKey) => {
    switch (key) {
      case "base":
        return { inner: baseInnerRadius, outer: baseOuterRadius };
      case "mid":
        return { inner: midInnerRadius, outer: midOuterRadius };
      case "high":
      default:
        return { inner: highInnerRadius, outer: highOuterRadius };
    }
  };

  useEffect(() => {
    ringDescriptors.forEach(({ key, innerRadius, outerRadius }) => {
      const { inner, outer } = getRingMotion(key);
      inner.set(innerRadius);
      outer.set(outerRadius);
    });
  }, [ringDescriptors]);

  const renderRing = (descriptor: RingDescriptor) => {
    if (!descriptor.arcs.length) return null;
    const { key, arcs } = descriptor;
    const { inner, outer } = getRingMotion(key);
    const innerRadius = Math.max(0, inner.get());
    const outerRadius = Math.max(innerRadius, outer.get());
    const thickness = Math.max(0, outerRadius - innerRadius);
    const controls = ringControls[key];
    if (!controls) return null;
    if (outerRadius <= 0) return null;
    return (
      <motion.g
        key={key}
        animate={controls}
        initial={{ opacity: 0, scale: 0.95 }}
        pointerEvents="none"
        role="presentation"
      >
        <circle
          cx={0}
          cy={0}
          r={innerRadius + thickness / 2}
          stroke="transparent"
          strokeWidth={Math.max(1, thickness)}
          fill="transparent"
          pointerEvents="stroke"
          onPointerEnter={() => setHoveredRing(key)}
          onPointerLeave={() => setHoveredRing(null)}
        />
        {arcs.map((arc) => {
          const arcShape: DefaultArcObject = {
            innerRadius,
            outerRadius,
            startAngle: arc.startAngle,
            endAngle: arc.endAngle,
          };
          const path = arcGenerator(arcShape);
          const isHovered = ringHoverKey === key;
          return (
            <path
              key={`${key}-${arc.data.id}`}
              d={path || undefined}
              fill={
                arc.data.color && arc.data.color !== "transparent"
                  ? arc.data.color
                  : "rgba(148,163,184,0.2)"
              }
              fillOpacity={isHovered ? 0.95 : 0.75}
              stroke="#0f172a"
              strokeWidth={0.8}
              pointerEvents="none"
            />
          );
        })}
      </motion.g>
    );
  };

  const baseRing = ringDescriptors.find((descriptor) => descriptor.key === "base");
  const midRing = ringDescriptors.find((descriptor) => descriptor.key === "mid");
  const highRing = ringDescriptors.find((descriptor) => descriptor.key === "high");

  const innerRingNodes = baseRing ? renderRing(baseRing) : null;
  const outerRingNodes = (
    <>
      {midRing ? renderRing(midRing) : null}
      {highRing ? renderRing(highRing) : null}
    </>
  );

  const interactiveRadius = useMemo(() => {
    const maxOuter = ringDescriptors.reduce((acc, descriptor) => {
      return Math.max(acc, descriptor.outerRadius);
    }, radius);
    return Math.max(maxOuter + 24, radius * 1.25);
  }, [ringDescriptors, radius]);


  return (
    <motion.g
      role="button"
      tabIndex={0}
      aria-label={
        baseDeltaMeta.label
          ? `${label}: ${valueLabel}, ${baseDeltaMeta.label} change vs previous day`
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
          stroke="rgba(148, 163, 184, 0.35)"
          strokeWidth={3}
        />
        {/* Inner stacked rings anchor to the node and size themselves to prevent overlap */}
        {innerRingNodes}
        {/* Outer stacked rings radiate outward without colliding */}
        {outerRingNodes}
        <g transform="translate(0, -6)">
          <motion.text
            x={0}
            y={-10}
            textAnchor="middle"
            fontSize={20}
            fontWeight={600}
            fill="#e2e8f0"
          >
            {label}
          </motion.text>
          <motion.text
            x={0}
            y={14}
            textAnchor="middle"
            fontSize={18}
            fontWeight={500}
            fill="#f8fafc"
          >
            {valueLabel}
          </motion.text>
          {baseDeltaMeta.label && (
            <motion.text
              x={0}
              y={34}
              textAnchor="middle"
              fontSize={16}
              fontWeight={600}
              fill={baseDeltaMeta.color}
            >
              {baseDeltaMeta.label}
            </motion.text>
          )}
        </g>
      </g>
    </motion.g>
  );
}

export default WorkflowNode;
