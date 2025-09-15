// DollarZing Simulation Engine - Library Exports
// Clean library interface for simulation engine components

// Core simulation types (from GameEngineSimulator)
export type {
  SimulationConfig,
  SimulationResults,
  SimulationProgress,
  SimulationComponents,
  PlayerStatistics,
  RevenueStatistics,
  GameStatistics,
} from "./simulation/game-engine-simulator";

export type {
  VirtualDollar,
  GameSession,
  BettingLevel,
  GameResult,
  ValidationResult,
} from "./types/virtual-dollar-engine";

export { CashOutStrategy } from "./types/virtual-dollar-engine";

export type {
  FactoryStatistics,
  VirtualDollarFactory,
  GameSessionFactory,
  PerformanceConfig,
  FactorySelector,
} from "./types/factory-interfaces";

// Main simulation controller (legacy - use GameEngineSimulator)
// export { SimulationController } from "./types/simulation-controller"; // REMOVED - migrated to GameEngineSimulator

// New component-integration simulator
export { GameEngineSimulator } from "./simulation/game-engine-simulator";

// Factory implementations (production - use these)
export {
  PooledVirtualDollarFactory,
  PooledGameSessionFactory,
} from "./factories";

// Game engine components
export { GameMatchingEngine } from "./core";
export { RevenueCalculator } from "./core";
export { ScoringEngine } from "./core";

// Backward compatibility aliases
export { DirectGameSessionFactory } from "./test-utils";

// Legacy/deprecated - will be removed in future versions
export { PlayerBalanceManager } from "./types/player-balance-manager";

// Event system
export { EventBus } from "./events/event-bus";
export { EVENT_TYPES } from "./events/event-types";
export type {
  DatasetGenerationStartedEvent,
  DatasetGenerationProgressEvent,
  DatasetGenerationCompletedEvent,
  DatasetValidationEvent,
  ParameterValidationEvent,
  OrchestratorConfigValidationEvent,
  ParameterMatrixValidationEvent,
  QualityAssuranceEvent,
} from "./events/event-types";

// Utility functions
export {
  getBettingLevelValue,
  getBettingLevelWinnings,
} from "./types/virtual-dollar-engine";

// Performance configurations
export {
  DEFAULT_PERFORMANCE_CONFIG,
  PRODUCTION_PERFORMANCE_CONFIG,
} from "./types/factory-interfaces";
