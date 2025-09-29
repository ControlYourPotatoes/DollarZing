export type SimulationAbortCode =
  | "MATCHMAKING_STALEMATE"
  | "USER_CANCELLED"
  | "TIMEOUT"
  | "UNKNOWN";

export interface SimulationAbortReason {
  code: SimulationAbortCode;
  message: string;
  context?: Record<string, unknown>;
}

export interface SimulationTermination {
  dayCompleted: number;
  reason: SimulationAbortReason;
  wasGraceful: boolean;
}
