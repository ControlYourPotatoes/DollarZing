// Test utility for creating mock DatasetOrchestrator results
// Provides realistic mock data for testing and development

import type { 
  ParameterCombination, 
  AdapterGenerationResult 
} from "../core/types";
import type { SimulationResults } from "../../../src/index";
import { generateDirectoryName } from "../parameters/matrix";

/**
 * Create a mock dataset generation result for testing/development
 */
export function createMockDatasetResult(
  combination: ParameterCombination,
  success: boolean = true
): AdapterGenerationResult {
  if (!success) {
    return {
      combination,
      success: false,
      error: "Mock failure for testing",
      generationTimeMs: 1000,
    };
  }

  // Create minimal mock simulation results
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
    },
    playerStats: {
      totalPlayers: 1000,
      activePlayers: 800,
      retiredPlayers: 200,
      totalDonationsFunds: 50000,
      totalWinningsFunds: 25000,
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
    },
    gameStats: {
      totalGames: 4000,
      averageGamesPerDay: 11.0,
      totalVirtualDollars: 8000,
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
    completedAt: new Date(),
  };

  return {
    combination,
    success: true,
    simulationResults: mockResults,
    generationTimeMs: 5000,
    outputPaths: {
      directory: `test/anchor-datasets/${generateDirectoryName(combination)}`,
      datasetFile: `test/anchor-datasets/${generateDirectoryName(
        combination
      )}/dataset.json`,
      metadataFile: `test/anchor-datasets/${generateDirectoryName(
        combination
      )}/metadata.json`,
    },
  };
}

/**
 * Create multiple mock results for parameter combinations
 */
export function createMockDatasetResults(
  combinations: ParameterCombination[],
  successRate: number = 1.0
): AdapterGenerationResult[] {
  return combinations.map((combination, index) => {
    const success = Math.random() < successRate;
    return createMockDatasetResult(combination, success);
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