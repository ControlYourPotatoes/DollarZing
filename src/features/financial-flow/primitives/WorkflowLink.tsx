import { motion } from "framer-motion";

export interface WorkflowLinkProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  value: number;
  highlighted?: boolean;
  percentOfTotal?: number;
  animated?: boolean;
}

function formatValue(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

export function WorkflowLink({
  sourceX,
  sourceY,
  targetX,
  targetY,
  value,
  highlighted = false,
  percentOfTotal,
  animated = false,
}: WorkflowLinkProps) {
  const deltaX = targetX - sourceX;
  const elbowX = sourceX + deltaX * 0.55;
  const labelX = (elbowX + targetX) / 2;
  const labelY = targetY - 12;
  const label =
    percentOfTotal !== undefined
      ? `${Math.round(percentOfTotal * 100)}%`
      : formatValue(value);

  return (
    <g>
      <motion.path
        d={`M ${sourceX} ${sourceY} L ${elbowX} ${sourceY} L ${elbowX} ${targetY} L ${targetX} ${targetY}`}
        fill="transparent"
        stroke={highlighted ? "#38bdf8" : "rgba(148, 163, 184, 0.45)"}
        strokeWidth={highlighted ? 3.2 : 2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={animated ? "12 14" : "8 10"}
        initial={{ pathLength: 0, opacity: 0, strokeDashoffset: 0 }}
        animate={{
          pathLength: 1,
          opacity: 1,
          strokeDashoffset: animated ? [0, -26] : 0,
        }}
        transition={{
          pathLength: { duration: 0.45, delay: 0.15, ease: "easeOut" },
          opacity: { duration: 0.45, delay: 0.15 },
          strokeDashoffset: animated
            ? {
                duration: 0.9,
                repeat: Infinity,
                repeatType: "loop",
                ease: "linear",
              }
            : { duration: 0.3, ease: "easeOut" },
        }}
      />
      <motion.text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        fontSize={12}
        fontWeight={500}
        fill={highlighted ? "#f8fafc" : "rgba(226,232,240,0.85)"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {label}
      </motion.text>
    </g>
  );
}

export default WorkflowLink;
