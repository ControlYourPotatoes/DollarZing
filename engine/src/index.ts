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

// Factory implementations
export {
  PooledVirtualDollarFactory,
  PooledGameSessionFactory,
} from "./types/pooled-factories";
export {
  DirectVirtualDollarFactory,
  DirectGameSessionFactory,
} from "./types/direct-factories";

// Game engine components
export { GameMatchingEngine } from "./types/game-matching-engine";
export { RunOrchestrator } from "./types/run-orchestrator";
export { ScoringEngine } from "./types/scoring-engine";
export { PlayerBalanceManager } from "./types/player-balance-manager";
export { VirtualDollarManager } from "./types/virtual-dollar-types";
export { RevenueCalculator } from "./types/revenue-calculator";

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
