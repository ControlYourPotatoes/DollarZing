import { type CSSProperties, useMemo } from "react";

import type { WorkflowLayoutResult } from "../hooks/useWorkflowData";

interface WorkflowNodeTooltipProps {
  node: WorkflowLayoutResult["nodes"][number];
  dayIndex?: number;
  className?: string;
  style?: CSSProperties;
  side?: "left" | "right";
  offsetPx?: number;
}

export function WorkflowNodeTooltip({
  node,
  dayIndex,
  className,
  style,
  side = "right",
  offsetPx,
}: WorkflowNodeTooltipProps) {
  const dayLabel = dayIndex !== undefined ? dayIndex + 1 : "--";

  const scenarioBlocks = useMemo(
    () => [
      {
        label: "Base Scenario",
        value: node.baseValue ?? node.aggregateValue,
        delta: node.baseDeltaPercent,
        segments: node.layers,
      },
      {
        label: "Mid Scenario",
        value: node.midValue,
        delta: node.midDeltaPercent,
        segments: node.midSegments,
      },
      {
        label: "High Scenario",
        value: node.highValue,
        delta: node.highDeltaPercent,
        segments: node.highSegments,
      },
    ],
    [
      node.aggregateValue,
      node.baseDeltaPercent,
      node.baseValue,
      node.highDeltaPercent,
      node.highSegments,
      node.highValue,
      node.layers,
      node.midDeltaPercent,
      node.midSegments,
      node.midValue,
    ]
  );

  const offset = offsetPx ?? 16;
  const anchorLeft = style?.left;
  const numericAnchorLeft =
    typeof anchorLeft === "number"
      ? anchorLeft
      : typeof anchorLeft === "string"
      ? Number.parseFloat(anchorLeft)
      : undefined;
  const adjustedStyle: CSSProperties = { ...style };
  if (numericAnchorLeft !== undefined) {
    adjustedStyle.left =
      side === "left"
        ? numericAnchorLeft - offset
        : numericAnchorLeft + offset;
  }
  const transform = side === "left" ? "translate(-100%, -50%)" : "translate(0, -50%)";
  const rootStyle: CSSProperties = {
    ...adjustedStyle,
    transform,
  };
  const rootClassName = [
    "pointer-events-none absolute max-w-lg rounded-md border border-slate-800 bg-slate-900/85 px-5 py-3 text-xs text-slate-200 shadow-lg",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName} style={rootStyle}>
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-100">{node.label}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              Scenario comparison
            </div>
          </div>
          <div className="text-xs text-slate-500">Day {dayLabel}</div>
        </div>
        <div className="grid gap-3 text-slate-100">
          {scenarioBlocks.map((scenarioBlock) => {
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
                      <li key={`${scenarioBlock.label}-${seg.id}`} className="flex items-center justify-between">
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
    </div>
  );
}

export default WorkflowNodeTooltip;
