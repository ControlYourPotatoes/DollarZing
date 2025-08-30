// DollarZing Simulation Engine - Library Exports
// Clean library interface for simulation engine components

// Core simulation types
export type {
  SimulationConfig,
  SimulationResults,
  SimulationProgress,
  SimulationComponents,
  PlayerStatistics,
  RevenueStatistics,
  GameStatistics
} from './types/simulation-controller.js';

export type {
  VirtualDollar,
  GameSession,
  BettingLevel,
  CashOutStrategy,
  GameResult
} from './types/virtual-dollar-engine.js';

export type {
  FactoryStatistics,
  VirtualDollarFactory,
  GameSessionFactory,
  PerformanceConfig
} from './types/factory-interfaces.js';

// Main simulation controller
export { SimulationController } from './types/simulation-controller.js';

// Factory implementations
export { PooledVirtualDollarFactory, PooledGameSessionFactory } from './types/pooled-factories.js';
export { DirectVirtualDollarFactory, DirectGameSessionFactory } from './types/direct-factories.js';

// Game engine components
export { GameMatchingEngine } from './types/game-matching-engine.js';
export { EnhancedGameMatchingEngine } from './types/enhanced-game-matching-engine.js';
export { RunOrchestrator } from './types/run-orchestrator.js';
export { ScoringEngine } from './types/scoring-engine.js';
export { PlayerBalanceManager } from './types/player-balance-manager.js';
export { RevenueCalculator } from './types/revenue-calculator.js';

// Utility functions
export {
  getBettingLevelValue,
  getBettingLevelWinnings
} from './types/virtual-dollar-engine.js';

// Performance configurations
export {
  DEFAULT_PERFORMANCE_CONFIG,
  PRODUCTION_PERFORMANCE_CONFIG
} from './types/factory-interfaces.js';