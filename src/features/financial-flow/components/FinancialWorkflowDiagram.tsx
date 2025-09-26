import { useEffect, useMemo, useRef, useState } from "react";

import { motion } from "framer-motion";

import { useWorkflowData } from "../hooks/useWorkflowData";
import { WorkflowNode } from "../primitives/WorkflowNode";
import { WorkflowLink } from "../primitives/WorkflowLink";
import { WorkflowNodeTooltip } from "./WorkflowNodeTooltip";

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
  const svgWrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<
    | {
        x: number;
        y: number;
        side: "left" | "right";
        offset: number;
      }
    | null
  >(null);

  const displayNodes = useMemo(() => {
    return nodes.map((node) => {
      let adjustedX = node.x;
      let adjustedY = node.y;
      if (node.id === "platform") {
        adjustedX += 10;
      }
      return {
        ...node,
        x: adjustedX,
        y: adjustedY,
      };
    });
  }, [nodes]);

  const hoveredNode = useMemo(
    () => displayNodes.find((candidate) => candidate.id === hoveredId),
    [hoveredId, displayNodes]
  );

  if (!day) {
    return (
      <div className="rounded-md border border-slate-700 bg-slate-900/60 p-6 text-center text-slate-400">
        Load a presentation snapshot to explore the financial workflow.
      </div>
    );
  }

  // Compute dynamic viewBox to fit all nodes/links comfortably
  const padding = 35;
  const bounds = displayNodes.length
    ? displayNodes.reduce(
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

  useEffect(() => {
    if (!hoveredNode || !svgRef.current || !svgWrapperRef.current) {
      setTooltipPosition(null);
      return;
    }
    const svgElement = svgRef.current;
    const wrapperElement = svgWrapperRef.current;
    const svgRect = svgElement.getBoundingClientRect();
    const wrapperRect = wrapperElement.getBoundingClientRect();
    if (svgRect.width === 0 || svgRect.height === 0) {
      setTooltipPosition(null);
      return;
    }

    const normalizedX = ((hoveredNode.x - vbX) / vbW) * svgRect.width;
    const normalizedY = ((hoveredNode.y - vbY) / vbH) * svgRect.height;
    const offsetX = svgRect.left - wrapperRect.left;
    const offsetY = svgRect.top - wrapperRect.top;
    const anchorX = offsetX + normalizedX;
    const anchorY = offsetY + normalizedY;
    const side: "left" | "right" =
      normalizedX > svgRect.width * 0.55 ? "left" : "right";

    const nodeRadiusPx = Math.max(
      0,
      (hoveredNode.radius / Math.max(1, vbW)) * svgRect.width
    );
    const horizontalOffset = Math.max(28, nodeRadiusPx + 24);

    const paddingY = 20;
    const clampedY = Math.max(
      paddingY,
      Math.min(wrapperRect.height - paddingY, anchorY)
    );

    setTooltipPosition({
      x: anchorX,
      y: clampedY,
      side,
      offset: horizontalOffset,
    });
  }, [hoveredNode, vbX, vbW]);

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
      <div ref={svgWrapperRef} className="relative">
        <motion.svg
          ref={svgRef}
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
        {displayNodes.map((n) => (
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
        {displayNodes.map((node) => (
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
            x={node.x}
            y={node.y}
            radius={node.radius}
            isActive={hoveredId ? hoveredId === node.id : node.id === "total"}
            onHover={setHoveredId}
          />
        ))}
        </motion.svg>
        {hoveredNode && tooltipPosition && (
          <WorkflowNodeTooltip
            node={hoveredNode}
            dayIndex={day?.dayIndex}
            style={{ left: tooltipPosition.x, top: tooltipPosition.y }}
            side={tooltipPosition.side}
          />
        )}
      </div>
    </div>
  );
}

export default FinancialWorkflowDiagram;
