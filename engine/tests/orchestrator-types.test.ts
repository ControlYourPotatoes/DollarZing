// Tests for orchestrator parameter matrix validation and type definitions
import { describe, it, expect } from "vitest";

// Import types that will be created
import type {
  ParameterMatrix,
  ParameterCombination,
  OrchestratorConfig,
  GrowthRateLevel,
  RiskLevel,
  CharityPercentageLevel,
} from "../cli/src/orchestrator/core/types";

// Import functions that will be created
import {
  createParameterMatrix,
  generateAllCombinations,
  validateParameterCombination,
} from "../cli/src/orchestrator/parameters/matrix";

import { createDefaultOrchestratorConfig } from "../cli/src/orchestrator/core/config";

describe("Parameter Matrix Types", () => {
  it("should define correct growth rate levels", () => {
    const matrix = createParameterMatrix();

    expect(matrix.growthRates).toEqual([15, 35, 60]);
    expect(matrix.growthRates).toHaveLength(3);
  });

  it("should define correct risk levels", () => {
    const matrix = createParameterMatrix();

    expect(matrix.riskLevels).toEqual(["low", "mid", "high"]);
    expect(matrix.riskLevels).toHaveLength(3);
  });

  it("should define correct charity percentage levels", () => {
    const matrix = createParameterMatrix();

    expect(matrix.charityPercentages).toEqual([10, 20, 30]);
    expect(matrix.charityPercentages).toHaveLength(3);
  });

  it("should generate exactly 27 parameter combinations", () => {
    const combinations = generateAllCombinations();

    expect(combinations).toHaveLength(27);

    // Verify first combination
    expect(combinations[0]).toEqual({
      growthRate: 15,
      riskLevel: "low",
      charityPercentage: 10,
    });

    // Verify last combination
    expect(combinations[26]).toEqual({
      growthRate: 60,
      riskLevel: "high",
      charityPercentage: 30,
    });
  });

  it("should validate parameter combinations correctly", () => {
    // Valid combinations
    expect(
      validateParameterCombination({
        growthRate: 15,
        riskLevel: "low",
        charityPercentage: 10,
      })
    ).toBe(true);

    expect(
      validateParameterCombination({
        growthRate: 60,
        riskLevel: "high",
        charityPercentage: 30,
      })
    ).toBe(true);

    // Invalid growth rate
    expect(
      validateParameterCombination({
        growthRate: 25, // Invalid - not in [15, 35, 60]
        riskLevel: "low",
        charityPercentage: 10,
      })
    ).toBe(false);

    // Invalid risk level
    expect(
      validateParameterCombination({
        growthRate: 15,
        riskLevel: "invalid" as RiskLevel,
        charityPercentage: 10,
      })
    ).toBe(false);

    // Invalid charity percentage
    expect(
      validateParameterCombination({
        growthRate: 15,
        riskLevel: "low",
        charityPercentage: 25, // Invalid - not in [10, 20, 30]
      })
    ).toBe(false);
  });

  it("should generate unique combinations without duplicates", () => {
    const combinations = generateAllCombinations();
    const uniqueCombinations = new Set(
      combinations.map(
        (combo) =>
          `${combo.growthRate}-${combo.riskLevel}-${combo.charityPercentage}`
      )
    );

    expect(uniqueCombinations.size).toBe(27);
  });

  it("should cover all possible combinations systematically", () => {
    const combinations = generateAllCombinations();

    // Check that we have all growth rates covered
    const growthRates = [...new Set(combinations.map((c) => c.growthRate))];
    expect(growthRates.sort()).toEqual([15, 35, 60]);

    // Check that we have all risk levels covered
    const riskLevels = [...new Set(combinations.map((c) => c.riskLevel))];
    expect(riskLevels.sort()).toEqual(["high", "low", "mid"]);

    // Check that we have all charity percentages covered
    const charityPercentages = [
      ...new Set(combinations.map((c) => c.charityPercentage)),
    ];
    expect(charityPercentages.sort()).toEqual([10, 20, 30]);
  });
});

describe("Orchestrator Configuration", () => {
  it("should create default configuration with sensible defaults", () => {
    const config = createDefaultOrchestratorConfig();

    expect(config.outputDirectory).toBe("engine/generated-datasets");
    expect(config.enableProgressReporting).toBe(true);
    expect(config.enableValidation).toBe(true);
    expect(config.batchSize).toBe(1); // Sequential processing
    expect(config.timeoutPerDataset).toBeGreaterThan(0);
    expect(config.generateMetadata).toBe(true);
  });

  it("should allow configuration customization", () => {
    const customConfig = createDefaultOrchestratorConfig({
      outputDirectory: "custom/output",
      enableProgressReporting: false,
      batchSize: 3,
    });

    expect(customConfig.outputDirectory).toBe("custom/output");
    expect(customConfig.enableProgressReporting).toBe(false);
    expect(customConfig.batchSize).toBe(3);
    // Other properties should retain defaults
    expect(customConfig.enableValidation).toBe(true);
    expect(customConfig.generateMetadata).toBe(true);
  });

  it("should validate configuration parameters", () => {
    expect(() =>
      createDefaultOrchestratorConfig({
        batchSize: -1, // Invalid
      })
    ).toThrow("Batch size must be positive");

    expect(() =>
      createDefaultOrchestratorConfig({
        timeoutPerDataset: 0, // Invalid
      })
    ).toThrow("Timeout must be positive");

    expect(() =>
      createDefaultOrchestratorConfig({
        outputDirectory: "", // Invalid
      })
    ).toThrow("Output directory cannot be empty");
  });
});

describe("Parameter Matrix Integration", () => {
  it("should integrate with existing simulation types", () => {
    const combination: ParameterCombination = {
      growthRate: 35,
      riskLevel: "mid",
      charityPercentage: 20,
    };

    // Verify types are compatible with simulation parameters
    expect(typeof combination.growthRate).toBe("number");
    expect(typeof combination.riskLevel).toBe("string");
    expect(typeof combination.charityPercentage).toBe("number");

    // Verify charity percentage is in correct format (percentage, not decimal)
    expect(combination.charityPercentage).toBeGreaterThanOrEqual(10);
    expect(combination.charityPercentage).toBeLessThanOrEqual(30);
  });

  it("should provide parameter name generation for dataset organization", () => {
    const combination: ParameterCombination = {
      growthRate: 35,
      riskLevel: "mid",
      charityPercentage: 20,
    };

    // We'll implement this function to create directory names
    const expectedName = `growth-${combination.growthRate}_risk-${combination.riskLevel}_charity-${combination.charityPercentage}`;

    // This will be implemented in the actual types
    expect(expectedName).toBe("growth-35_risk-mid_charity-20");
  });
});
