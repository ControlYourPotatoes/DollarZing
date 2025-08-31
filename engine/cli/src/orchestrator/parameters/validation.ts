// Parameter validation for dataset orchestrator

import type {
  ParameterCombination,
  OrchestratorConfig,
  GrowthRateLevel,
  CharityPercentageLevel,
  ValidationResult
} from '../core/types';
import { createParameterMatrix } from './matrix';

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

// Validate orchestrator configuration
export function validateOrchestratorConfig(config: OrchestratorConfig): void {
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