/**
 * Event Type Definitions for Event-Driven Simulation Architecture
 * Comprehensive TypeScript interfaces for all simulation events
 */

import { CashOutStrategy } from "../types/virtual-dollar-engine";

// ===== BASE EVENT INTERFACES =====

export interface BaseEvent {
  type: string;
  timestamp: Date;
  id?: string; // Optional unique identifier for event tracking
}

export interface ErrorEvent extends BaseEvent {
  type: "EVENT_ERROR";
  eventType: string;
  error: string;
  context?: any;
}

// ===== GAME EVENTS =====

export interface GameCreatedEvent extends BaseEvent {
  type: "GAME_CREATED";
  gameId: string;
  player1Id: string;
  player2Id: string;
  player1Level: number;
  player2Level: number;
  virtualDollar1Id: string;
  virtualDollar2Id: string;
}

export interface GameResolvedEvent extends BaseEvent {
  type: "GAME_RESOLVED";
  gameId: string;
  winnerId: string;
  loserId: string;
  winnerLevel: number;
  loserLevel: number;
  winnerDollarId: string;
  loserDollarId: string;
  winnings: number;
  gameResult: "WIN" | "LOSS";
}

// ===== PLAYER PROGRESSION EVENTS =====

export interface PlayerProgressionEvent extends BaseEvent {
  type: "PLAYER_ADVANCED";
  playerId: string;
  virtualDollarId: string;
  fromLevel: number;
  toLevel: number;
  totalWinnings: number;
  gamesPlayed: number;
}

export interface PlayerProgressionFailedEvent extends BaseEvent {
  type: "PLAYER_PROGRESSION_FAILED";
  playerId: string;
  virtualDollarId: string;
  currentLevel: number;
  reason: string;
  error?: string;
}

// ===== CASH-OUT DECISION EVENTS =====

export interface CashOutDecisionEvent extends BaseEvent {
  type: "CASH_OUT_DECISION";
  playerId: string;
  virtualDollarId: string;
  decision: "CASH_OUT" | "CONTINUE";
  currentLevel: number;
  totalWinnings: number;
  cashOutStrategy: CashOutStrategy;
  reason: string;
  amount?: number; // Only present if decision is CASH_OUT
}

export interface CashOutCompletedEvent extends BaseEvent {
  type: "CASH_OUT_COMPLETED";
  playerId: string;
  virtualDollarId: string;
  finalLevel: number;
  totalWinnings: number;
  cashOutAmount: number;
  runCompleted: boolean;
  wasJackpot: boolean;
}

export interface CashOutDecisionFailedEvent extends BaseEvent {
  type: "CASH_OUT_DECISION_FAILED";
  playerId: string;
  virtualDollarId: string;
  reason: string;
  error: string;
}

export interface ContinuePlayEvent extends BaseEvent {
  type: "CONTINUE_PLAY";
  playerId: string;
  virtualDollarId: string;
  currentLevel: number;
  potentialWinnings: number;
  nextLevel: number;
  nextPotentialWinnings: number;
}

// ===== POOL MANAGEMENT EVENTS =====

export interface RePoolRequestEvent extends BaseEvent {
  type: "RE_POOL_REQUEST";
  virtualDollarId: string;
  playerId: string;
  currentLevel: number;
  reason: "WINNER_CONTINUES" | "NEW_RUN_CREATED";
}

export interface PoolAddedEvent extends BaseEvent {
  type: "POOL_ADDED";
  virtualDollarId: string;
  playerId: string;
  currentLevel: number;
  poolSize: number;
  availableForMatching: number;
}

export interface PoolRemovedEvent extends BaseEvent {
  type: "POOL_REMOVED";
  virtualDollarId: string;
  playerId: string;
  reason: "MATCHED_FOR_GAME" | "CASHED_OUT" | "ERROR";
  poolSize: number;
  availableForMatching: number;
}

export interface PoolUpdatedEvent extends BaseEvent {
  type: "POOL_UPDATED";
  totalDollarsInPool: number;
  availableForMatching: number;
  dollarsInPlay: number;
  levelDistribution: Record<number, number>; // level -> count
}

export interface NewRunPooledEvent extends BaseEvent {
  type: "NEW_RUN_POOLED";
  playerId: string;
  virtualDollarId: string;
  previousRunId?: string;
  fundingSource: "CASH_OUT_REINVESTMENT" | "DONATION";
  poolSize: number;
}

export interface PoolCapacityReachedEvent extends BaseEvent {
  type: "POOL_CAPACITY_REACHED";
  currentPoolSize: number;
  maxCapacity: number;
  reason: string;
  rejectedDollarId?: string;
}

export interface PoolManagementErrorEvent extends BaseEvent {
  type: "POOL_MANAGEMENT_ERROR";
  virtualDollarId: string;
  operation:
    | "RE_POOL_WINNER"
    | "ADD_TO_POOL"
    | "STATE_VALIDATION"
    | "POOL_SYNC";
  error: string;
  integrationComponent?: "GameMatchingEngine" | "VirtualDollarManager";
}

export interface PoolStatsUpdatedEvent extends BaseEvent {
  type: "POOL_STATS_UPDATED";
  previousStats: {
    totalDollarsInPool: number;
    availableForMatching: number;
    dollarsInGame: number;
  };
  currentStats: {
    totalDollarsInPool: number;
    availableForMatching: number;
    dollarsInGame: number;
  };
  operation: "ADD_TO_POOL" | "REMOVE_FROM_POOL";
}

// ===== REVENUE EVENTS =====

export interface RevenueGameProcessedEvent extends BaseEvent {
  type: "REVENUE_GAME_PROCESSED";
  gameId: string;
  gameRevenue: number;
  platformRevenue: number;
  charityContribution: number;
  totalGameRevenue: number;
}

export interface RevenueCashOutProcessedEvent extends BaseEvent {
  type: "REVENUE_CASH_OUT_PROCESSED";
  playerId: string;
  virtualDollarId: string;
  cashOutAmount: number;
  playerWinnings: number;
  totalPlayerWinnings: number;
}

export interface RevenueUpdateEvent extends BaseEvent {
  type: "REVENUE_UPDATE";
  totalPlatformRevenue: number;
  totalCharityContributions: number;
  totalPlayerPayouts: number;
  totalGames: number;
  revenuePerGame: number;
}

// ===== PLAYER MANAGEMENT EVENTS =====

export interface PlayerCreatedEvent extends BaseEvent {
  type: "PLAYER_CREATED";
  playerId: string;
  initialDonationAmount: number;
  cashOutStrategy: CashOutStrategy;
  isNewPlayer: boolean; // true for growth, false for initial
}

export interface PlayerRetiredEvent extends BaseEvent {
  type: "PLAYER_RETIRED";
  playerId: string;
  totalGamesPlayed: number;
  totalWinnings: number;
  finalBalance: number;
  retirementReason: "NO_FUNDS" | "MAX_RUNS_REACHED" | "OTHER";
}

export interface NewRunCreatedEvent extends BaseEvent {
  type: "NEW_RUN_CREATED";
  playerId: string;
  virtualDollarId: string;
  fundingSource: "DONATION" | "WINNINGS";
  cashOutStrategy: CashOutStrategy;
  runCount: number; // How many runs this player has had
}

// ===== SIMULATION CONTROL EVENTS =====

export interface DayStartedEvent extends BaseEvent {
  type: "DAY_STARTED";
  dayNumber: number;
  totalPlayers: number;
  activePlayers: number;
  poolSize: number;
}

export interface DayCompletedEvent extends BaseEvent {
  type: "DAY_COMPLETED";
  dayNumber: number;
  gamesProcessed: number;
  newPlayers: number;
  totalRevenue: number;
  poolSize: number;
  activePlayers: number;
}

export interface SimulationStartedEvent extends BaseEvent {
  type: "SIMULATION_STARTED";
  config: {
    durationDays: number;
    initialPlayerCount: number;
    charityPercentage: number;
  };
}

export interface SimulationCompletedEvent extends BaseEvent {
  type: "SIMULATION_COMPLETED";
  totalDays: number;
  totalGames: number;
  totalPlayers: number;
  success: boolean;
  error?: string;
}

// ===== RUN MANAGEMENT EVENTS =====

export interface RunStartedEvent extends BaseEvent {
  type: "RUN_STARTED";
  playerId: string;
  virtualDollarId: string;
  startingLevel: number;
  initialWinnings: number;
  cashOutStrategy: CashOutStrategy;
}

export interface RunCompletedEvent extends BaseEvent {
  type: "RUN_COMPLETED";
  playerId: string;
  virtualDollarId: string;
  completionType: "CASH_OUT" | "JACKPOT" | "ELIMINATED";
  finalLevel: number;
  totalWinnings: number;
  gamesPlayed: number;
  wasJackpot: boolean;
}

// ===== DATASET ORCHESTRATOR EVENTS =====

export interface DatasetGenerationStartedEvent extends BaseEvent {
  type: "DATASET_GENERATION_STARTED";
  parameterId: string;
  combination: {
    growthRate: number;
    riskLevel: string;
    charityPercentage: number;
  };
  estimatedDurationMs: number;
}

export interface DatasetGenerationProgressEvent extends BaseEvent {
  type: "DATASET_GENERATION_PROGRESS";
  parameterId: string;
  currentDay: number;
  totalDays: number;
  progressPercentage: number;
  gamesProcessed: number;
  playersActive: number;
}

export interface DatasetGenerationCompletedEvent extends BaseEvent {
  type: "DATASET_GENERATION_COMPLETED";
  parameterId: string;
  success: boolean;
  durationMs: number;
  recordCount: number;
  outputPaths?: {
    directory: string;
    datasetFile: string;
    metadataFile: string;
  };
  error?: string;
}

export interface DatasetValidationEvent extends BaseEvent {
  type: "DATASET_VALIDATION";
  parameterId: string;
  isValid: boolean;
  errors: string[];
  qualityMetrics: {
    totalGames: number;
    totalPlayers: number;
    revenueConsistency: boolean;
  };
}

export interface ParameterValidationEvent extends BaseEvent {
  type: "PARAMETER_VALIDATION";
  parameterId: string;
  isValid: boolean;
  errors: string[];
  combination: {
    growthRate: number;
    riskLevel: string;
    charityPercentage: number;
  };
}

export interface OrchestratorConfigValidationEvent extends BaseEvent {
  type: "ORCHESTRATOR_CONFIG_VALIDATION";
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config: {
    batchSize: number;
    timeoutPerDataset: number;
    outputDirectory: string;
  };
}

export interface ParameterMatrixValidationEvent extends BaseEvent {
  type: "PARAMETER_MATRIX_VALIDATION";
  totalCombinations: number;
  validCombinations: number;
  invalidCombinations: number;
  validationErrors: Array<{
    combination: {
      growthRate: number;
      riskLevel: string;
      charityPercentage: number;
    };
    errors: string[];
  }>;
}

export interface QualityAssuranceEvent extends BaseEvent {
  type: "QUALITY_ASSURANCE";
  parameterId: string;
  checkType: "DATA_INTEGRITY" | "PERFORMANCE" | "CONSISTENCY" | "COMPLETENESS";
  passed: boolean;
  details: string;
  metrics: Record<string, number>;
}

// ===== EVENT TYPE UNION =====

export type SimulationEvent =
  | ErrorEvent
  | GameCreatedEvent
  | GameResolvedEvent
  | PlayerProgressionEvent
  | PlayerProgressionFailedEvent
  | CashOutDecisionEvent
  | CashOutCompletedEvent
  | CashOutDecisionFailedEvent
  | ContinuePlayEvent
  | RePoolRequestEvent
  | PoolAddedEvent
  | PoolRemovedEvent
  | PoolUpdatedEvent
  | NewRunPooledEvent
  | PoolCapacityReachedEvent
  | PoolManagementErrorEvent
  | PoolStatsUpdatedEvent
  | RevenueGameProcessedEvent
  | RevenueCashOutProcessedEvent
  | RevenueUpdateEvent
  | PlayerCreatedEvent
  | PlayerRetiredEvent
  | NewRunCreatedEvent
  | DayStartedEvent
  | DayCompletedEvent
  | SimulationStartedEvent
  | SimulationCompletedEvent
  | RunStartedEvent
  | RunCompletedEvent
  | DatasetGenerationStartedEvent
  | DatasetGenerationProgressEvent
  | DatasetGenerationCompletedEvent
  | DatasetValidationEvent
  | ParameterValidationEvent
  | OrchestratorConfigValidationEvent
  | ParameterMatrixValidationEvent
  | QualityAssuranceEvent;

// ===== EVENT TYPE CONSTANTS =====

export const EVENT_TYPES = {
  // Error events
  EVENT_ERROR: "EVENT_ERROR",

  // Game events
  GAME_CREATED: "GAME_CREATED",
  GAME_RESOLVED: "GAME_RESOLVED",

  // Player progression events
  PLAYER_ADVANCED: "PLAYER_ADVANCED",
  PLAYER_PROGRESSION_FAILED: "PLAYER_PROGRESSION_FAILED",

  // Cash-out events
  CASH_OUT_DECISION: "CASH_OUT_DECISION",
  CASH_OUT_COMPLETED: "CASH_OUT_COMPLETED",
  CASH_OUT_DECISION_FAILED: "CASH_OUT_DECISION_FAILED",
  CONTINUE_PLAY: "CONTINUE_PLAY",

  // Pool management events
  RE_POOL_REQUEST: "RE_POOL_REQUEST",
  POOL_ADDED: "POOL_ADDED",
  POOL_REMOVED: "POOL_REMOVED",
  POOL_UPDATED: "POOL_UPDATED",
  NEW_RUN_POOLED: "NEW_RUN_POOLED",
  POOL_CAPACITY_REACHED: "POOL_CAPACITY_REACHED",
  POOL_MANAGEMENT_ERROR: "POOL_MANAGEMENT_ERROR",
  POOL_STATS_UPDATED: "POOL_STATS_UPDATED",

  // Revenue events
  REVENUE_GAME_PROCESSED: "REVENUE_GAME_PROCESSED",
  REVENUE_CASH_OUT_PROCESSED: "REVENUE_CASH_OUT_PROCESSED",
  REVENUE_UPDATE: "REVENUE_UPDATE",

  // Player management events
  PLAYER_CREATED: "PLAYER_CREATED",
  PLAYER_RETIRED: "PLAYER_RETIRED",
  NEW_RUN_CREATED: "NEW_RUN_CREATED",

  // Simulation control events
  DAY_STARTED: "DAY_STARTED",
  DAY_COMPLETED: "DAY_COMPLETED",
  SIMULATION_STARTED: "SIMULATION_STARTED",
  SIMULATION_COMPLETED: "SIMULATION_COMPLETED",

  // Run management events
  RUN_STARTED: "RUN_STARTED",
  RUN_COMPLETED: "RUN_COMPLETED",

  // Dataset orchestrator events
  DATASET_GENERATION_STARTED: "DATASET_GENERATION_STARTED",
  DATASET_GENERATION_PROGRESS: "DATASET_GENERATION_PROGRESS",
  DATASET_GENERATION_COMPLETED: "DATASET_GENERATION_COMPLETED",
  DATASET_VALIDATION: "DATASET_VALIDATION",
  PARAMETER_VALIDATION: "PARAMETER_VALIDATION",

  // Orchestrator validation events
  ORCHESTRATOR_CONFIG_VALIDATION: "ORCHESTRATOR_CONFIG_VALIDATION",
  PARAMETER_MATRIX_VALIDATION: "PARAMETER_MATRIX_VALIDATION",
  QUALITY_ASSURANCE: "QUALITY_ASSURANCE",
} as const;

// ===== TYPE HELPERS =====

export type EventType = keyof typeof EVENT_TYPES;

export type EventDataFor<T extends EventType> = Extract<
  SimulationEvent,
  { type: (typeof EVENT_TYPES)[T] }
>;
