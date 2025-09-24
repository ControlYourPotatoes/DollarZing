import { motion } from "framer-motion";
import * as d3 from "d3";
import { PresentationWorkflowLayer } from "@/shared/presentation";

type ArcData = {
  data: PresentationWorkflowLayer;
  startAngle: number;
  endAngle: number;
  padAngle: number;
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
  x: number;
  y: number;
  radius: number;
  isActive?: boolean;
  onHover?: (id: string | null) => void;
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
  x,
  y,
  radius,
  isActive = false,
  onHover,
}: WorkflowNodeProps) {
  const valueLabel = formatCurrency(aggregateValue);
  const arcsBase = computeArcs(layers);
  const arcsMid = computeArcs(midSegments);
  const arcsHigh = computeArcs(highSegments);

  return (
    <motion.g
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${valueLabel}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: isActive ? 1.05 : 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      onFocus={() => onHover?.(id)}
      onBlur={() => onHover?.(null)}
      onMouseEnter={() => onHover?.(id)}
      onMouseLeave={() => onHover?.(null)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onHover?.(id);
        }
        if (e.key === "Escape") {
          onHover?.(null);
        }
      }}
    >
      <g transform={`translate(${x}, ${y})`}>
        <motion.circle
          cx={0}
          cy={0}
          r={radius}
          fill="rgba(15, 23, 42, 0.85)" 
          stroke={isActive ? "#38bdf8" : "rgba(148, 163, 184, 0.35)"}
          strokeWidth={isActive ? 4 : 3}
        />
        {/* Base segments */}
        {arcsBase.map((arcItem, index) => {
          const ringCenter = radius - 6;
          const thickness = 8;
          const innerRadius = ringCenter - thickness / 2;
          const outerRadius = ringCenter + thickness / 2;
          const arcData = {
            innerRadius,
            outerRadius,
            startAngle: arcItem.startAngle,
            endAngle: arcItem.endAngle,
            padAngle: 0
          };
          const dPath = d3.arc()(arcData) || '';
          return (
            <motion.path
              key={arcItem.data.id}
              d={dPath}
              fill={arcItem.data.color}
              stroke="none"
              initial={{ opacity: 0, pathLength: 0 }}
              animate={{ opacity: isActive ? 1 : 0.9, pathLength: 1 }}
              transition={{ delay: 0.06 + index * 0.05, duration: 0.28 }}
            />
          );
        })}
        {/* Mid comparison ring */}
        {arcsMid.map((arcItem, index) => {
          const ringCenter = radius;
          const thickness = 5;
          const innerRadius = ringCenter - thickness / 2;
          const outerRadius = ringCenter + thickness / 2;
          const arcData = {
            innerRadius,
            outerRadius,
            startAngle: arcItem.startAngle,
            endAngle: arcItem.endAngle,
            padAngle: 0
          };
          const dPath = d3.arc()(arcData) || '';
          return (
            <motion.path
              key={`mid-${arcItem.data.id}`}
              d={dPath}
              fill={arcItem.data.color}
              stroke="none"
              initial={{ opacity: 0, pathLength: 0 }}
              animate={{ opacity: isActive ? 0.9 : 0.5, pathLength: 1 }}
              transition={{ delay: 0.05 + index * 0.05, duration: 0.25 }}
            />
          );
        })}
        {/* High comparison ring */}
        {arcsHigh.map((arcItem, index) => {
          const ringCenter = radius + 6;
          const thickness = 5;
          const innerRadius = ringCenter - thickness / 2;
          const outerRadius = ringCenter + thickness / 2;
          const arcData = {
            innerRadius,
            outerRadius,
            startAngle: arcItem.startAngle,
            endAngle: arcItem.endAngle,
            padAngle: 0
          };
          const dPath = d3.arc()(arcData) || '';
          return (
            <motion.path
              key={`high-${arcItem.data.id}`}
              d={dPath}
              fill={arcItem.data.color}
              stroke="none"
              initial={{ opacity: 0, pathLength: 0 }}
              animate={{ opacity: isActive ? 0.85 : 0.45, pathLength: 1 }}
              transition={{ delay: 0.02 + index * 0.05, duration: 0.25 }}
            />
          );
        })}
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
