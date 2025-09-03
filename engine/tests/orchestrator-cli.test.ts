// Tests for orchestrator CLI argument parsing and configuration system
import { describe, it, expect, beforeEach, vi } from "vitest";

// Import CLI functions that will be created
import {
  parseCliArguments,
  createCliProgram,
  validateCliConfiguration,
} from "../cli/src/orchestrator/cli/cli";

// Import existing functions from parameter matrix
import { createDefaultOrchestratorConfig } from "../cli/src/orchestrator/core/config";

import { generateAllCombinations } from "../cli/src/orchestrator/parameters/matrix";

import type { OrchestratorConfig } from "../cli/src/orchestrator/core/types";

describe("CLI Argument Parsing", () => {
  beforeEach(() => {
    // Reset process.argv to prevent test interference
    vi.restoreAllMocks();
  });

  it("should parse basic CLI arguments correctly", () => {
    const mockArgv = [
      "node",
      "orchestrator.js",
      "--output",
      "custom/output",
      "--verbose",
    ];

    const config = parseCliArguments(mockArgv);

    expect(config.outputDirectory).toBe("custom/output");
    expect(config.verbose).toBe(true);
    expect(config.dryRun).toBe(false); // Default
  });

  it("should handle boolean flags correctly", () => {
    const mockArgv = [
      "node",
      "orchestrator.js",
      "--dry-run",
      "--no-progress",
      "--no-validation",
    ];

    const config = parseCliArguments(mockArgv);

    expect(config.dryRun).toBe(true);
    expect(config.enableProgressReporting).toBe(false);
    expect(config.enableValidation).toBe(false);
  });

  it("should parse numeric arguments correctly", () => {
    const mockArgv = [
      "node",
      "orchestrator.js",
      "--batch-size",
      "3",
      "--timeout",
      "600000",
    ];

    const config = parseCliArguments(mockArgv);

    expect(config.batchSize).toBe(3);
    expect(config.timeoutPerDataset).toBe(600000);
  });

  it("should apply defaults for unspecified arguments", () => {
    const mockArgv = ["node", "orchestrator.js"];

    const config = parseCliArguments(mockArgv);
    const defaults = createDefaultOrchestratorConfig();

    expect(config.outputDirectory).toBe(defaults.outputDirectory);
    expect(config.batchSize).toBe(defaults.batchSize);
    expect(config.timeoutPerDataset).toBe(defaults.timeoutPerDataset);
    expect(config.enableProgressReporting).toBe(
      defaults.enableProgressReporting
    );
  });

  it("should handle help flag appropriately", () => {
    const mockArgv = ["node", "orchestrator.js", "--help"];

    // This should throw a "Help requested" error to indicate help was shown
    expect(() => parseCliArguments(mockArgv)).toThrow("Help requested");
  });

  it("should validate invalid numeric arguments", () => {
    const mockArgv = [
      "node",
      "orchestrator.js",
      "--batch-size",
      "-1", // Invalid
    ];

    expect(() => parseCliArguments(mockArgv)).toThrow(
      "Batch size must be positive"
    );
  });

  it("should validate timeout values", () => {
    const mockArgv = [
      "node",
      "orchestrator.js",
      "--timeout",
      "0", // Invalid
    ];

    expect(() => parseCliArguments(mockArgv)).toThrow(
      "Timeout must be positive"
    );
  });
});

describe("CLI Configuration Validation", () => {
  it("should validate complete configuration object", () => {
    const validConfig: OrchestratorConfig = {
      outputDirectory: "test/output",
      generateMetadata: true,
      batchSize: 2,
      timeoutPerDataset: 120000,
      enableProgressReporting: true,
      enableValidation: true,
      verbose: false,
      dryRun: false,
    };

    expect(() => validateCliConfiguration(validConfig)).not.toThrow();
  });

  it("should reject invalid output directory", () => {
    const invalidConfig: OrchestratorConfig = {
      outputDirectory: "", // Invalid
      generateMetadata: true,
      batchSize: 1,
      timeoutPerDataset: 120000,
      enableProgressReporting: true,
      enableValidation: true,
      verbose: false,
      dryRun: false,
    };

    expect(() => validateCliConfiguration(invalidConfig)).toThrow(
      "Output directory cannot be empty"
    );
  });

  it("should reject invalid batch size", () => {
    const invalidConfig: OrchestratorConfig = {
      outputDirectory: "test/output",
      generateMetadata: true,
      batchSize: 0, // Invalid
      timeoutPerDataset: 120000,
      enableProgressReporting: true,
      enableValidation: true,
      verbose: false,
      dryRun: false,
    };

    expect(() => validateCliConfiguration(invalidConfig)).toThrow(
      "Batch size must be positive"
    );
  });

  it("should provide detailed validation errors", () => {
    const invalidConfig: OrchestratorConfig = {
      outputDirectory: "",
      generateMetadata: true,
      batchSize: -1,
      timeoutPerDataset: 0,
      enableProgressReporting: true,
      enableValidation: true,
      verbose: false,
      dryRun: false,
    };

    let errorMessage = "";
    try {
      validateCliConfiguration(invalidConfig);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Unknown error";
    }

    expect(errorMessage).toContain("directory");
    expect(errorMessage).toContain("Batch size");
    expect(errorMessage).toContain("Timeout");
  });
});

describe("CLI Program Creation", () => {
  it("should create commander program with correct options", () => {
    const program = createCliProgram();

    expect(program.name()).toBe("orchestrator");
    expect(program.description()).toContain("Generate 27 anchor datasets");
    expect(program.version()).toMatch(/\d+\.\d+\.\d+/);
  });

  it("should define all required CLI options", () => {
    const program = createCliProgram();
    const options = program.options;

    const optionFlags = options.map((opt) => opt.flags);

    expect(optionFlags).toContain("-o, --output <dir>");
    expect(optionFlags).toContain("-b, --batch-size <size>");
    expect(optionFlags).toContain("-t, --timeout <ms>");
    expect(optionFlags).toContain("-v, --verbose");
    expect(optionFlags).toContain("--dry-run");
    expect(optionFlags).toContain("--no-progress");
    expect(optionFlags).toContain("--no-validation");
    expect(optionFlags).toContain("--no-metadata");
  });

  it("should provide appropriate help text for each option", () => {
    const program = createCliProgram();
    const options = program.options;

    const outputOption = options.find((opt) => opt.flags.includes("--output"));
    expect(outputOption?.description).toContain("Output directory");

    const batchOption = options.find((opt) =>
      opt.flags.includes("--batch-size")
    );
    expect(batchOption?.description).toContain("concurrent");

    const verboseOption = options.find((opt) =>
      opt.flags.includes("--verbose")
    );
    expect(verboseOption?.description).toContain("verbose");
  });
});

describe("Parameter Matrix CLI Integration", () => {
  it("should generate all 27 combinations for CLI processing", () => {
    const combinations = generateAllCombinations();

    expect(combinations).toHaveLength(27);

    // Verify the combinations are suitable for CLI batch processing
    combinations.forEach((combo) => {
      expect(combo.growthRate).toBeTypeOf("number");
      expect(combo.riskLevel).toBeTypeOf("string");
      expect(combo.charityPercentage).toBeTypeOf("number");

      expect([15, 35, 60]).toContain(combo.growthRate);
      expect(["low", "mid", "high"]).toContain(combo.riskLevel);
      expect([10, 20, 30]).toContain(combo.charityPercentage);
    });
  });

  it("should provide CLI-friendly combination naming", () => {
    const combinations = generateAllCombinations();

    // Each combination should be convertible to a CLI-friendly name
    combinations.forEach((combo) => {
      const name = `growth-${combo.growthRate}_risk-${combo.riskLevel}_charity-${combo.charityPercentage}`;

      // Verify name format is valid for file systems
      expect(name).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(name.length).toBeLessThan(100); // Reasonable file path length
    });
  });

  it("should support filtering combinations via CLI", () => {
    const allCombinations = generateAllCombinations();

    // Test filtering by growth rate (this would be a CLI feature)
    const lowGrowthCombinations = allCombinations.filter(
      (combo) => combo.growthRate === 15
    );
    expect(lowGrowthCombinations).toHaveLength(9); // 3 risk levels × 3 charity percentages

    // Test filtering by risk level
    const highRiskCombinations = allCombinations.filter(
      (combo) => combo.riskLevel === "high"
    );
    expect(highRiskCombinations).toHaveLength(9); // 3 growth rates × 3 charity percentages
  });
});
