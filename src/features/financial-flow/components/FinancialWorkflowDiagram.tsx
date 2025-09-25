import { useState } from "react";

import { motion } from "framer-motion";

import { useWorkflowData } from "../hooks/useWorkflowData";
import { WorkflowNode } from "../primitives/WorkflowNode";
import { WorkflowLink } from "../primitives/WorkflowLink";

export interface FinancialWorkflowDiagramProps {
  width?: number; // container hint; svg fills 100%
  height?: number;
}

export function FinancialWorkflowDiagram({
  width = 720,
  height = 460,
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

  // Compute dynamic viewBox to fit all nodes/links comfortably
  const padding = 35;
  const bounds = nodes.length
    ? nodes.reduce(
        (acc, n) => {
          acc.minX = Math.min(acc.minX, n.x - n.radius);
          acc.maxX = Math.max(acc.maxX, n.x + n.radius);
          acc.minY = Math.min(acc.minY, n.y - n.radius - 24); // label above
          acc.maxY = Math.max(acc.maxY, n.y + n.radius + 24);
          return acc;
        },
        { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
      )
    : { minX: 0, maxX: width, minY: 0, maxY: height };
  const baseVbX = (Number.isFinite(bounds.minX) ? bounds.minX : 0) - padding;
  const baseVbY = (Number.isFinite(bounds.minY) ? bounds.minY : 0) - padding;
  const vbX = Math.min(0, baseVbX);
  const vbY = Math.min(0, baseVbY);
  const vbW = Math.max(width, bounds.maxX + padding - vbX);
  const vbH = Math.max(height, bounds.maxY + padding - vbY);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
        <span>Financial Distribution Workflow</span>
        <span className="text-slate-500">
          Net change:{" "}
          {day.summary.netChange.toLocaleString(undefined, {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          })}
        </span>
      </div>
      <motion.svg
        role="img"
        aria-label="Financial distribution flow diagram"
        width="100%"
        height={Math.max(550, height)}
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        className="mx-auto block"
        preserveAspectRatio="xMidYMid meet"
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
        {/* Debug: draw crosshairs at node positions to verify clipping */}
        {nodes.map((n) => (
          <g key={`debug-${n.id}`} opacity={0.25}>
            <line
              x1={n.x - 8}
              y1={n.y}
              x2={n.x + 8}
              y2={n.y}
              stroke="#22d3ee"
              strokeWidth={1}
            />
            <line
              x1={n.x}
              y1={n.y - 8}
              x2={n.x}
              y2={n.y + 8}
              stroke="#22d3ee"
              strokeWidth={1}
            />
          </g>
        ))}
        {links.map((link) => (
          <WorkflowLink
            key={link.id}
            {...link}
            highlighted={
              hoveredId
                ? link.target === hoveredId || link.source === hoveredId
                : false
            }
          />
        ))}
        {nodes.map((node) => {
          // Apply individual offsets (add more ifs for other nodes)
          let adjustedX = node.x;
          let adjustedY = node.y;
          if (node.id === "platform") {
            adjustedX += 10;  // Move right by 10px (positive x)
            adjustedY += 0;  // Uncomment/example: Move down by 20px (positive y)
          }
          // Example for another node:
          // if (node.id === "platform") {
          //   adjustedX -= 15;  // Move left
          // }

        return (
          <WorkflowNode
            key={node.id}
            id={node.id}
            label={node.label}
            aggregateValue={node.aggregateValue}
            layers={node.layers}
            midSegments={node.midSegments}
            highSegments={node.highSegments}
            baseValue={node.baseValue}
            midValue={node.midValue}
            highValue={node.highValue}
            x={adjustedX}
            y={adjustedY}
            radius={node.radius}
            isActive={hoveredId ? hoveredId === node.id : node.id === "total"}
            onHover={setHoveredId}
          />
        );
      })}
      </motion.svg>
      {hoveredId && (
        <div className="mt-3 rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
          {(() => {
            const node = nodes.find((candidate) => candidate.id === hoveredId);
            if (!node) return null;
            return (
              <div className="space-y-1">
                <div className="font-semibold text-slate-100">{node.label}</div>
                <div>
                  Base:{" "}
                  {(node.baseValue ?? node.aggregateValue).toLocaleString(
                    undefined,
                    {
                      style: "currency",
                      currency: "USD",
                    }
                  )}
                </div>
                {(node.midValue !== undefined || node.highValue !== undefined) && (
                  <div className="grid grid-cols-2 gap-2 text-slate-300/90">
                    {node.midValue !== undefined && (
                      <div>
                        Mid:{" "}
                        {node.midValue.toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        })}
                        {node.baseValue !== undefined && node.midValue > node.baseValue && (
                          <span className="ml-2 text-emerald-400">+
                            {(node.midValue - node.baseValue).toLocaleString(undefined, {
                              style: "currency",
                              currency: "USD",
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        )}
                      </div>
                    )}
                    {node.highValue !== undefined && (
                      <div>
                        High:{" "}
                        {node.highValue.toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        })}
                        {node.baseValue !== undefined && node.highValue > node.baseValue && (
                          <span className="ml-2 text-emerald-400">+
                            {(node.highValue - node.baseValue).toLocaleString(undefined, {
                              style: "currency",
                              currency: "USD",
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {node.layers && node.layers.length > 0 && (
                  <ul className="space-y-1">
                    {node.layers.map((layer) => (
                      <li
                        key={layer.id}
                        className="flex items-center justify-between"
                      >
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
                {((node.midSegments && node.midSegments.length > 0) ||
                  (node.highSegments && node.highSegments.length > 0)) && (
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {node.midSegments && node.midSegments.length > 0 && (
                      <div>
                        <div className="mb-1 font-medium text-slate-200">Mid Δ</div>
                        <ul className="space-y-1">
                          {node.midSegments.map((seg) => (
                            <li key={`mid-${seg.id}`} className="flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2 w-2 rounded-full"
                                  style={{ backgroundColor: seg.color }}
                                />
                                {seg.label}
                              </span>
                              <span>
                                {seg.value.toLocaleString(undefined, {
                                  style: "currency",
                                  currency: "USD",
                                  maximumFractionDigits: 0,
                                })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {node.highSegments && node.highSegments.length > 0 && (
                      <div>
                        <div className="mb-1 font-medium text-slate-200">High Δ</div>
                        <ul className="space-y-1">
                          {node.highSegments.map((seg) => (
                            <li key={`high-${seg.id}`} className="flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2 w-2 rounded-full"
                                  style={{ backgroundColor: seg.color }}
                                />
                                {seg.label}
                              </span>
                              <span>
                                {seg.value.toLocaleString(undefined, {
                                  style: "currency",
                                  currency: "USD",
                                  maximumFractionDigits: 0,
                                })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
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
