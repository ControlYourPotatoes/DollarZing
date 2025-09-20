import { useState } from "react";

import { motion } from "framer-motion";

import { useWorkflowData } from "../hooks/useWorkflowData";
import { WorkflowNode } from "../primitives/WorkflowNode";
import { WorkflowLink } from "../primitives/WorkflowLink";

export interface FinancialWorkflowDiagramProps {
  width?: number;
  height?: number;
}

export function FinancialWorkflowDiagram({
  width = 720,
  height = 260,
}: FinancialWorkflowDiagramProps) {
  const { nodes, links, day } = useWorkflowData();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!day) {
    return (
      <div className="rounded-md border border-slate-700 bg-slate-900/60 p-6 text-center text-slate-400">
        Load a presentation snapshot to explore the financial workflow.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
        <span>Financial Distribution Workflow</span>
        <span className="text-slate-500">
          Net change: {day.summary.netChange.toLocaleString(undefined, {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          })}
        </span>
      </div>
      <motion.svg
        role="img"
        aria-label="Financial distribution flow diagram"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto block"
      >
        <defs>
          <filter id="workflow-glow" x="-20" y="-20" width="200" height="200">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {links.map((link) => (
          <WorkflowLink
            key={link.id}
            {...link}
            highlighted={hoveredId ? link.target === hoveredId || link.source === hoveredId : false}
          />
        ))}
        {nodes.map((node) => (
          <WorkflowNode
            key={node.id}
            id={node.id}
            label={node.label}
            aggregateValue={node.aggregateValue}
            layers={node.layers}
            x={node.x}
            y={node.y}
            radius={node.radius}
            isActive={hoveredId ? hoveredId === node.id : node.id === "total"}
            onHover={setHoveredId}
          />
        ))}
      </motion.svg>
      {hoveredId && (
        <div className="mt-3 rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
          {(() => {
            const node = nodes.find((candidate) => candidate.id === hoveredId);
            if (!node) return null;
            return (
              <div className="space-y-1">
                <div className="font-semibold text-slate-100">{node.label}</div>
                <div>Total: {node.aggregateValue.toLocaleString(undefined, { style: "currency", currency: "USD" })}</div>
                {node.layers && node.layers.length > 0 && (
                  <ul className="space-y-1">
                    {node.layers.map((layer) => (
                      <li key={layer.id} className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: layer.color }}
                          />
                          {layer.label}
                        </span>
                        <span>
                          {layer.value.toLocaleString(undefined, {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default FinancialWorkflowDiagram;
