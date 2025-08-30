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
  FileNamingConfig
} from './types';

// Parameter matrix functions
export {
  createParameterMatrix,
  generateAllCombinations,
  validateParameterCombination,
  validateParameterCombinationDetailed,
  createDefaultOrchestratorConfig,
  generateDirectoryName,
  generateFilePaths,
  parseDirectoryName
} from './parameter-matrix';