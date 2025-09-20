import { motion } from "framer-motion";

import { PresentationWorkflowLayer } from "@/shared/presentation";

export interface WorkflowNodeProps {
  id: string;
  label: string;
  aggregateValue: number;
  layers?: PresentationWorkflowLayer[];
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
  x,
  y,
  radius,
  isActive = false,
  onHover,
}: WorkflowNodeProps) {
  const valueLabel = formatCurrency(aggregateValue);
  const arcs = computeLayerArcs(layers, radius - 6);

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: isActive ? 1.05 : 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      transform={`translate(${x}, ${y})`}
      onFocus={() => onHover?.(id)}
      onBlur={() => onHover?.(null)}
      onMouseEnter={() => onHover?.(id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <motion.circle
        cx={0}
        cy={0}
        r={radius}
        fill="rgba(15, 23, 42, 0.85)"
        stroke={isActive ? "#38bdf8" : "rgba(148, 163, 184, 0.35)"}
        strokeWidth={isActive ? 3 : 2}
      />
      {arcs.map((arc) => (
        <motion.circle
          key={arc.id}
          cx={0}
          cy={0}
          r={radius - 6}
          fill="transparent"
          stroke={arc.color}
          strokeWidth={4}
          strokeDasharray={arc.dashArray}
          strokeDashoffset={arc.dashOffset}
          transform="rotate(-90)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08, duration: 0.3 }}
        />
      ))}
      <motion.text
        x={0}
        y={-radius - 18}
        textAnchor="middle"
        fontSize={14}
        fill="rgba(148,163,184,0.85)"
      >
        {label}
      </motion.text>
      <motion.text
        x={0}
        y={6}
        textAnchor="middle"
        fontSize={12}
        fontWeight={500}
        fill="#f8fafc"
      >
        {valueLabel}
      </motion.text>
    </motion.g>
  );
}

export default WorkflowNode;
