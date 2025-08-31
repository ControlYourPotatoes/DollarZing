// Core types for the dataset generation orchestrator

// Growth rate levels as defined in technical spec
export type GrowthRateLevel = 15 | 35 | 60;

// Risk levels for cash-out strategy mapping  
export type RiskLevel = 'low' | 'mid' | 'high';

// Charity percentage levels
export type CharityPercentageLevel = 10 | 20 | 30;

// Parameter matrix definition for 3x3x3 combinations
export interface ParameterMatrix {
  readonly growthRates: readonly [15, 35, 60];
  readonly riskLevels: readonly ['low', 'mid', 'high'];
  readonly charityPercentages: readonly [10, 20, 30];
}

// Single parameter combination for dataset generation
export interface ParameterCombination {
  growthRate: GrowthRateLevel;
  riskLevel: RiskLevel;  
  charityPercentage: CharityPercentageLevel;
}

// Configuration for orchestrator operation
export interface OrchestratorConfig {
  // Output configuration
  outputDirectory: string;
  generateMetadata: boolean;
  
  // Processing configuration  
  batchSize: number; // Number of datasets to process concurrently (1 = sequential)
  timeoutPerDataset: number; // Milliseconds before timing out a single dataset generation
  
  // Reporting configuration
  enableProgressReporting: boolean;
  enableValidation: boolean;
  
  // CLI configuration
  verbose: boolean;
  dryRun: boolean;
}

// Partial configuration for customization
export type OrchestratorConfigOverrides = Partial<OrchestratorConfig>;

// Progress information during batch processing
export interface OrchestrationProgress {
  totalCombinations: number;
  completedCombinations: number;
  currentCombination: ParameterCombination | null;
  completionPercentage: number;
  elapsedTimeMs: number;
  estimatedRemainingMs: number;
  failedCombinations: ParameterCombination[];
  successfulCombinations: ParameterCombination[];
}

// Result of processing a single parameter combination
export interface DatasetGenerationResult {
  combination: ParameterCombination;
  success: boolean;
  error?: string;
  outputPath?: string;
  metadataPath?: string;
  generationTimeMs: number;
  datasetSizeBytes?: number;
}

// Complete orchestration results
export interface OrchestrationResults {
  totalProcessed: number;
  successful: number;
  failed: number;
  totalTimeMs: number;
  results: DatasetGenerationResult[];
  outputDirectory: string;
}

// Validation result for parameter combinations
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Dataset metadata for generated anchor datasets
export interface DatasetMetadata {
  generationTimestamp: Date;
  parameters: ParameterCombination;
  generationTimeMs: number;
  datasetSizeBytes: number;
  recordCount: number;
  version: string;
  generatorVersion: string;
}

// File naming utilities (used by output organization)
export interface FileNamingConfig {
  datasetFilename: string; // e.g., 'dataset.json'
  metadataFilename: string; // e.g., 'metadata.json'
  directoryNamePattern: string; // e.g., 'growth-{growthRate}_risk-{riskLevel}_charity-{charityPercentage}'
}