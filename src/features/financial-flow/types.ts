export type WorkflowNodeViewState = "compact" | "standard" | "expanded";

export type WorkflowRingKey = "base" | "mid" | "high";

export type SimulationPhase = "idle" | "running" | "scrubbing";

export interface WorkflowRingMetrics {
  key: WorkflowRingKey;
  value: number;
  percent: number;
}

