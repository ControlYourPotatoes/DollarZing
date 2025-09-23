import { motion } from "framer-motion";

import { PresentationWorkflowLayer } from "@/shared/presentation";

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

function computeLayerArcs(layers: PresentationWorkflowLayer[], radius: number) {
  if (!layers || layers.length === 0) {
    return [];
  }
  const total = layers.reduce((sum, layer) => sum + layer.value, 0);
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return layers.map((layer) => {
    const fraction = total > 0 ? layer.value / total : 0;
    const arcLength = circumference * fraction;
    const arc = {
      id: layer.id,
      color: layer.color,
      dashArray: `${arcLength} ${circumference - arcLength}`,
      dashOffset: offset,
    };
    offset -= arcLength;
    return arc;
  });
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
  const arcsBase = computeLayerArcs(layers, radius - 6);
  const arcsMid = computeLayerArcs(midSegments, radius);
  const arcsHigh = computeLayerArcs(highSegments, radius + 6);

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
        {arcsBase.map((arc) => (
          <motion.circle
            key={arc.id}
            cx={0}
            cy={0}
            r={radius - 6}
            fill="transparent"
            stroke={arc.color}
            strokeWidth={isActive ? 6 : 4}
            strokeLinecap="round"
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
            transform="rotate(-90)"
            initial={{ opacity: 0 }}
            animate={{ opacity: isActive ? 1 : 0.9 }}
            transition={{ delay: 0.06, duration: 0.28 }}
          />
        ))}
        {/* Mid comparison ring */}
        {arcsMid.map((arc) => (
          <motion.circle
            key={`mid-${arc.id}`}
            cx={0}
            cy={0}
            r={radius}
            fill="transparent"
            stroke={arc.color}
            strokeOpacity={isActive ? 0.9 : 0.5}
            strokeWidth={isActive ? 6 : 2.5}
            strokeLinecap="round"
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
            transform="rotate(-90)"
            initial={{ opacity: 0 }}
            animate={{ opacity: isActive ? 1 : 0.8 }}
            transition={{ delay: 0.05, duration: 0.25 }}
          />
        ))}
        {/* High comparison ring */}
        {arcsHigh.map((arc) => (
          <motion.circle
            key={`high-${arc.id}`}
            cx={0}
            cy={0}
            r={radius + 6}
            fill="transparent"
            stroke={arc.color}
            strokeOpacity={isActive ? 0.85 : 0.45}
            strokeWidth={isActive ? 6 : 2.5}
            strokeLinecap="round"
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
            transform="rotate(-90)"
            initial={{ opacity: 0 }}
            animate={{ opacity: isActive ? 1 : 0.7 }}
            transition={{ delay: 0.02, duration: 0.25 }}
          />
        ))}
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
