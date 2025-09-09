// Parameter validation for dataset orchestrator

import type {
  ParameterCombination,
  OrchestratorConfig,
  GrowthRateLevel,
  CharityPercentageLevel,
  ValidationResult,
} from "../core/types";
import { createParameterMatrix } from "./matrix";
import { EventBus } from "../../../../src/events/event-bus";
import {
  EVENT_TYPES,
  ParameterValidationEvent,
  OrchestratorConfigValidationEvent,
  ParameterMatrixValidationEvent,
} from "../../../../src/events/event-types";

// Validate a single parameter combination
export function validateParameterCombination(
  combination: ParameterCombination
): boolean {
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
  if (
    !matrix.charityPercentages.includes(
      combination.charityPercentage as CharityPercentageLevel
    )
  ) {
    return false;
  }

  return true;
}

// Comprehensive validation with detailed results
export async function validateParameterCombinationDetailed(
  combination: ParameterCombination,
  eventBus?: EventBus
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const matrix = createParameterMatrix();

  // Validate growth rate
  if (!matrix.growthRates.includes(combination.growthRate as GrowthRateLevel)) {
    errors.push(
      `Invalid growth rate: ${
        combination.growthRate
      }. Must be one of: ${matrix.growthRates.join(", ")}`
    );
  }

  // Validate risk level
  if (!matrix.riskLevels.includes(combination.riskLevel)) {
    errors.push(
      `Invalid risk level: ${
        combination.riskLevel
      }. Must be one of: ${matrix.riskLevels.join(", ")}`
    );
  }

  // Validate charity percentage
  if (
    !matrix.charityPercentages.includes(
      combination.charityPercentage as CharityPercentageLevel
    )
  ) {
    errors.push(
      `Invalid charity percentage: ${
        combination.charityPercentage
      }. Must be one of: ${matrix.charityPercentages.join(", ")}`
    );
  }

  const result = {
    isValid: errors.length === 0,
    errors,
    warnings,
  };

  // Emit parameter validation event
  if (eventBus) {
    const parameterId = `${combination.growthRate}-${combination.riskLevel}-${combination.charityPercentage}`;
    await eventBus.emit(EVENT_TYPES.PARAMETER_VALIDATION, {
      type: EVENT_TYPES.PARAMETER_VALIDATION,
      timestamp: new Date(),
      parameterId,
      isValid: result.isValid,
      errors,
      combination,
    } as ParameterValidationEvent);
  }

  return result;
}

// Validate orchestrator configuration
export async function validateOrchestratorConfig(
  config: OrchestratorConfig,
  eventBus?: EventBus
): Promise<void> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config.batchSize < 1) {
    errors.push("Batch size must be positive");
  }

  if (config.timeoutPerDataset <= 0) {
    errors.push("Timeout must be positive");
  }

  if (!config.outputDirectory || config.outputDirectory.trim() === "") {
    errors.push("Output directory cannot be empty");
  }

  // Add warnings for suboptimal configurations
  if (config.batchSize > 10) {
    warnings.push("Large batch size may cause memory pressure");
  }

  if (config.timeoutPerDataset < 30000) {
    warnings.push("Short timeout may cause premature dataset failures");
  }

  // Emit orchestrator config validation event
  if (eventBus) {
    await eventBus.emit(EVENT_TYPES.ORCHESTRATOR_CONFIG_VALIDATION, {
      type: EVENT_TYPES.ORCHESTRATOR_CONFIG_VALIDATION,
      timestamp: new Date(),
      isValid: errors.length === 0,
      errors,
      warnings,
      config: {
        batchSize: config.batchSize,
        timeoutPerDataset: config.timeoutPerDataset,
        outputDirectory: config.outputDirectory,
      },
    } as OrchestratorConfigValidationEvent);
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed: ${errors.join(", ")}`);
  }
}

// Add new function for validating entire parameter matrix
export async function validateParameterMatrix(eventBus?: EventBus): Promise<{
  totalCombinations: number;
  validCombinations: number;
  invalidCombinations: number;
  validationErrors: Array<{
    combination: ParameterCombination;
    errors: string[];
  }>;
}> {
  const allCombinations = generateAllCombinations();
  let validCount = 0;
  const validationErrors: Array<{
    combination: ParameterCombination;
    errors: string[];
  }> = [];

  for (const combination of allCombinations) {
    const validation = await validateParameterCombinationDetailed(
      combination,
      eventBus
    );

    if (validation.isValid) {
      validCount++;
    } else {
      validationErrors.push({
        combination,
        errors: validation.errors,
      });
    }
  }

  const result = {
    totalCombinations: allCombinations.length,
    validCombinations: validCount,
    invalidCombinations: allCombinations.length - validCount,
    validationErrors,
  };

  // Emit parameter matrix validation event
  if (eventBus) {
    await eventBus.emit(EVENT_TYPES.PARAMETER_MATRIX_VALIDATION, {
      type: EVENT_TYPES.PARAMETER_MATRIX_VALIDATION,
      timestamp: new Date(),
      totalCombinations: result.totalCombinations,
      validCombinations: result.validCombinations,
      invalidCombinations: result.invalidCombinations,
      validationErrors: result.validationErrors,
    } as ParameterMatrixValidationEvent);
  }

  return result;
}

// Helper function to generate all parameter combinations
function generateAllCombinations(): ParameterCombination[] {
  const matrix = createParameterMatrix();
  const combinations: ParameterCombination[] = [];

  for (const growthRate of matrix.growthRates) {
    for (const riskLevel of matrix.riskLevels) {
      for (const charityPercentage of matrix.charityPercentages) {
        combinations.push({
          growthRate: growthRate as GrowthRateLevel,
          riskLevel,
          charityPercentage: charityPercentage as CharityPercentageLevel,
        });
      }
    }
  }

  return combinations;
}
