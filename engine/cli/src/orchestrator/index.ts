// Dataset Generation Orchestrator - Main exports

// Core types
export type {
  ParameterMatrix,
  ParameterCombination,
  OrchestratorConfig,
  OrchestratorConfigOverrides,
  GrowthRateLevel,
  RiskLevel,
  CharityPercentageLevel,
  OrchestrationProgress,
  DatasetGenerationResult,
  OrchestrationResults,
  ValidationResult,
  DatasetMetadata,
  FileNamingConfig,
} from "./core/types";

// Configuration functions
export { createDefaultOrchestratorConfig } from "./core/config";

// Parameter matrix functions
export {
  createParameterMatrix,
  generateAllCombinations,
  generateDirectoryName,
  generateFilePaths,
  parseDirectoryName,
} from "./parameters/matrix";

// Validation functions
export {
  validateParameterCombination,
  validateParameterCombinationDetailed,
  validateOrchestratorConfig,
} from "./parameters/validation";

// CLI functions
export {
  createCliProgram,
  parseCliArguments,
  parseCliArgumentsWithErrorHandling,
  validateCliConfiguration,
  showHelp,
  displayConfiguration,
  validateSystemRequirements,
  createCliDefaultConfig,
} from "./cli/cli";

// Execution components
export {
  DatasetOrchestrator,
  type ParameterMappingConfig,
  type AdapterGenerationResult,
  type DatasetProgressCallback,
} from "./execution/dataset-orchestrator";

export {
  GameEngineExecutor,
  type ExecutorConfig,
} from "./execution/game-engine-executor";

export {
  OrchestratorFactoryManager,
  createOrchestratorFactoryManager,
  type OrchestratorFactoryConfig,
} from "./execution/factory-integration";
