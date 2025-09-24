// Test utility for creating mock DatasetOrchestrator results
// Provides realistic mock data for testing and development

import type {
  ParameterCombination,
  DatasetGenerationResult,
} from "../core/types";
import type { SimulationResults } from "../../../../src/simulation/game-engine-simulator";
import type { AdapterGenerationResult } from "../execution/dataset-orchestrator";
import { generateDirectoryName } from "../parameters/matrix";

/**
 * Create a mock dataset generation result for testing/development
 */
export function createMockDatasetResult(
  combination: ParameterCombination,
  success: boolean = true
): DatasetGenerationResult {
  if (!success) {
    return {
      combination,
      success: false,
      error: "Mock failure for testing",
      generationTimeMs: 1000,
    };
  }

  return {
    combination,
    success: true,
    generationTimeMs: 5000,
    outputPath: `test/anchor-datasets/${generateDirectoryName(
      combination
    )}/dataset.json`,
    metadataPath: `test/anchor-datasets/${generateDirectoryName(
      combination
    )}/metadata.json`,
    datasetSizeBytes: 1024000, // Mock 1MB dataset
  };
}

/**
 * Create multiple mock results for parameter combinations
 */
export function createMockDatasetResults(
  combinations: ParameterCombination[],
  successRate: number = 1.0
): AdapterGenerationResult[] {
  return combinations.map((combination) => {
    const success = Math.random() < successRate;
    const datasetResult = createMockDatasetResult(combination, success);

    // Create mock simulation results for AdapterGenerationResult
    const mockResults: SimulationResults = {
      success: true,
      simulationDurationMs: 5000,
      config: {
        durationDays: 365,
        initialPlayerCount: 1000,
        dailySeed: "mock-seed",
        charityPercentage: combination.charityPercentage / 100,
        playerStrategies: { conservative: 0.5, balanced: 0.3, aggressive: 0.2 },
        initialDonationAmount: 50,
        maxSimulationTimeMs: 300000,
        enableProgressReporting: false,
        growthModel: {
          adoptionRate: 0.1,
          baseMarket: 1000000,
          midpointDay: 90,
          steepnessFactor: 20,
        },
      },
      playerStats: {
        totalPlayers: 1000,
        activePlayers: 800,
        retiredPlayers: 200,
        completedRunsPlayers: 600,
        totalCharityContributions: 50000,
        totalPlayerPayouts: 25000,
        totalProgressionFunds: 15000,
        averageGamesPerPlayer: 45,
        playerRetirementRate: 0.2,
      },
      revenueStats: {
        totalPlatformRevenue: 10000,
        totalCharityContributions: combination.charityPercentage * 500,
        totalPlayerPayouts: 20000,
        revenuePerGame: 2.5,
        charityPercentage: combination.charityPercentage / 100,
        averageRevenuePerDay: 27.4,
        totalCashOuts: 0,
        cashOutCount: 0,
      },
      gameStats: {
        totalGames: 4000,
        averageGamesPerDay: 11.0,
        pooledVirtualDollars: 3,
        totalVirtualDollars: 8000,
        totalRunsCreated: 8000,
        completedRuns: 1200,
        activeRuns: 400,
        jackpotsWon: 15,
        averageRunLength: 3.3,
      },
      summary: {
        totalDays: 365,
        totalPlayers: 1000,
        simulationCompleted: true,
      },
      dailyResults: [],
      dailyAggregates: [],
      completedAt: new Date(),
    };

    // Convert DatasetGenerationResult to AdapterGenerationResult
    const result: AdapterGenerationResult = {
      combination: datasetResult.combination,
      success: datasetResult.success,
      generationTimeMs: datasetResult.generationTimeMs,
    };

    if (datasetResult.error) {
      result.error = datasetResult.error;
    }

    if (success) {
      result.simulationResults = mockResults;
    }

    if (datasetResult.outputPath) {
      const directory = `test/anchor-datasets/${generateDirectoryName(
        combination
      )}`;
      result.outputPaths = {
        directory,
        datasetFile: datasetResult.outputPath,
        metadataFile: datasetResult.metadataPath || "",
        snapshotsFile: `${directory}/daily-snapshots.json`,
        eventsFile: `${directory}/events.ndjson`,
        presentationFile: `${directory}/presentation-snapshots.json`,
      };
    }

    return result;
  });
}

/**
 * Create mock parameter combination for testing
 */
export function createMockParameterCombination(
  overrides: Partial<ParameterCombination> = {}
): ParameterCombination {
  return {
    growthRate: 35,
    riskLevel: "mid",
    charityPercentage: 20,
    ...overrides,
  };
}
