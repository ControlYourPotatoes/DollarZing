// Parameter matrix generation and validation for dataset orchestrator

import type {
  ParameterMatrix,
  ParameterCombination,
  OrchestratorConfig,
  OrchestratorConfigOverrides,
  GrowthRateLevel,
  RiskLevel,
  CharityPercentageLevel,
  ValidationResult
} from './types';

// Create the parameter matrix definition
export function createParameterMatrix(): ParameterMatrix {
  return {
    growthRates: [15, 35, 60] as const,
    riskLevels: ['low', 'mid', 'high'] as const,
    charityPercentages: [10, 20, 30] as const
  };
}

// Generate all 27 parameter combinations
export function generateAllCombinations(): ParameterCombination[] {
  const matrix = createParameterMatrix();
  const combinations: ParameterCombination[] = [];
  
  for (const growthRate of matrix.growthRates) {
    for (const riskLevel of matrix.riskLevels) {
      for (const charityPercentage of matrix.charityPercentages) {
        combinations.push({
          growthRate,
          riskLevel,
          charityPercentage
        });
      }
    }
  }
  
  return combinations;
}

// Validate a single parameter combination
export function validateParameterCombination(combination: ParameterCombination): boolean {
  const matrix = createParameterMatrix();
  
  // Validate growth rate
  if (!matrix.growthRates.includes(combination.growthRate as GrowthRateLevel)) {
    return false;
  }
  
  // Validate risk level
  if (!matrix.riskLevels.includes(combination.riskLevel)) {
    return false;
  }
  
  // Validate charity percentage
  if (!matrix.charityPercentages.includes(combination.charityPercentage as CharityPercentageLevel)) {
    return false;
  }
  
  return true;
}

// Comprehensive validation with detailed results
export function validateParameterCombinationDetailed(combination: ParameterCombination): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const matrix = createParameterMatrix();
  
  // Validate growth rate
  if (!matrix.growthRates.includes(combination.growthRate as GrowthRateLevel)) {
    errors.push(`Invalid growth rate: ${combination.growthRate}. Must be one of: ${matrix.growthRates.join(', ')}`);
  }
  
  // Validate risk level
  if (!matrix.riskLevels.includes(combination.riskLevel)) {
    errors.push(`Invalid risk level: ${combination.riskLevel}. Must be one of: ${matrix.riskLevels.join(', ')}`);
  }
  
  // Validate charity percentage
  if (!matrix.charityPercentages.includes(combination.charityPercentage as CharityPercentageLevel)) {
    errors.push(`Invalid charity percentage: ${combination.charityPercentage}. Must be one of: ${matrix.charityPercentages.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Create default orchestrator configuration
export function createDefaultOrchestratorConfig(overrides?: OrchestratorConfigOverrides): OrchestratorConfig {
  const defaults: OrchestratorConfig = {
    outputDirectory: 'engine/generated-datasets',
    generateMetadata: true,
    batchSize: 1, // Sequential processing to avoid resource conflicts
    timeoutPerDataset: 300000, // 5 minutes per dataset
    enableProgressReporting: true,
    enableValidation: true,
    verbose: false,
    dryRun: false
  };
  
  const config = { ...defaults, ...overrides };
  
  // Validate configuration
  validateOrchestratorConfig(config);
  
  return config;
}

// Validate orchestrator configuration
function validateOrchestratorConfig(config: OrchestratorConfig): void {
  if (config.batchSize < 1) {
    throw new Error('Batch size must be positive');
  }
  
  if (config.timeoutPerDataset <= 0) {
    throw new Error('Timeout must be positive');  
  }
  
  if (!config.outputDirectory || config.outputDirectory.trim() === '') {
    throw new Error('Output directory cannot be empty');
  }
}

// Generate directory name for parameter combination
export function generateDirectoryName(combination: ParameterCombination): string {
  return `growth-${combination.growthRate}_risk-${combination.riskLevel}_charity-${combination.charityPercentage}`;
}

// Generate file paths for a parameter combination
export function generateFilePaths(outputDirectory: string, combination: ParameterCombination) {
  const dirName = generateDirectoryName(combination);
  const basePath = `${outputDirectory}/anchor-datasets/${dirName}`;
  
  return {
    directory: basePath,
    datasetFile: `${basePath}/dataset.json`,
    metadataFile: `${basePath}/metadata.json`
  };
}

// Parse directory name back to parameter combination (for validation/debugging)
export function parseDirectoryName(directoryName: string): ParameterCombination | null {
  const pattern = /^growth-(\d+)_risk-(\w+)_charity-(\d+)$/;
  const match = directoryName.match(pattern);
  
  if (!match) {
    return null;
  }
  
  const [, growthRateStr, riskLevel, charityPercentageStr] = match;
  const growthRate = parseInt(growthRateStr, 10);
  const charityPercentage = parseInt(charityPercentageStr, 10);
  
  const combination: ParameterCombination = {
    growthRate: growthRate as GrowthRateLevel,
    riskLevel: riskLevel as RiskLevel,
    charityPercentage: charityPercentage as CharityPercentageLevel
  };
  
  // Validate parsed combination
  if (!validateParameterCombination(combination)) {
    return null;
  }
  
  return combination;
}