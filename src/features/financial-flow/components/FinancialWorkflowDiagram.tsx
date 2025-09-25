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
        <div className="mt-3 max-w-md rounded-md border border-slate-800 bg-slate-900/85 px-4 py-3 text-xs text-slate-200 shadow-lg">
          {(() => {
            const node = nodes.find((candidate) => candidate.id === hoveredId);
            if (!node) return null;
            return (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">
                      {node.label}
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">
                      Scenario comparison
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    Day {day?.dayIndex !== undefined ? day.dayIndex + 1 : "--"}
                  </div>
                </div>
                <div className="grid gap-3 text-slate-100">
                  {[
                    {
                      label: "Base Scenario",
                      value: node.baseValue ?? node.aggregateValue,
                      delta: node.baseDeltaPercent,
                      color: "text-slate-100",
                      segments: node.layers,
                    },
                    {
                      label: "Mid Scenario",
                      value: node.midValue,
                      delta: node.midDeltaPercent,
                      color: "text-sky-300",
                      segments: node.midSegments,
                    },
                    {
                      label: "High Scenario",
                      value: node.highValue,
                      delta: node.highDeltaPercent,
                      color: "text-violet-300",
                      segments: node.highSegments,
                    },
                  ].map((scenarioBlock) => {
                    if (scenarioBlock.value === undefined) return null;
                    const delta = scenarioBlock.delta;
                    const deltaColor =
                      delta === undefined
                        ? "text-slate-500"
                        : delta > 0
                        ? "text-emerald-400"
                        : delta < 0
                        ? "text-rose-400"
                        : "text-slate-500";
                    const segments = scenarioBlock.segments ?? [];
                    return (
                      <div key={scenarioBlock.label} className="space-y-2">
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-500">
                            {scenarioBlock.label}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-100">
                            <span>
                              {scenarioBlock.value.toLocaleString(undefined, {
                                style: "currency",
                                currency: "USD",
                                maximumFractionDigits: 0,
                              })}
                            </span>
                            {delta !== undefined && (
                              <span className={`text-xs font-medium ${deltaColor}`}>
                                {delta > 0 ? "+" : ""}
                                {delta.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                        {segments.length > 0 && (
                          <ul className="space-y-1 text-sm">
                            {segments.map((seg) => (
                              <li
                                key={`${scenarioBlock.label}-${seg.id}`}
                                className="flex items-center justify-between"
                              >
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
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default FinancialWorkflowDiagram;
