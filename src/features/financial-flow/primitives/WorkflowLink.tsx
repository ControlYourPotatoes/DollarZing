import { motion } from "framer-motion";

export interface WorkflowLinkProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  value: number;
  highlighted?: boolean;
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
}: WorkflowLinkProps) {
  const midX = (sourceX + targetX) / 2;
  return (
    <g>
      <motion.path
        d={`M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`}
        fill="transparent"
        stroke={highlighted ? "#38bdf8" : "rgba(148, 163, 184, 0.35)"}
        strokeWidth={highlighted ? 3 : 2}
        strokeLinecap="round"
        strokeDasharray="4 6"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      />
      <motion.text
        x={(sourceX + targetX) / 2}
        y={(sourceY + targetY) / 2 - 12}
        textAnchor="middle"
        fontSize={11}
        fill="rgba(226,232,240,0.8)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {formatValue(value)}
      </motion.text>
    </g>
  );
}

export default WorkflowLink;
