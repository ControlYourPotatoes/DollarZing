// Game Engine Adapter for Dataset Orchestrator
// Provides abstraction layer between orchestrator parameters and game engine configuration

import {
  GameEngineSimulator,
  SimulationConfig,
  SimulationResults,
  SimulationProgress,
  CashOutStrategy,
  PlayerBalanceManager,
  GameMatchingEngine,
  RunOrchestrator,
  VirtualDollarManager,
  RevenueCalculator,
  ScoringEngine,
  DirectGameSessionFactory,
  DEFAULT_PERFORMANCE_CONFIG,
} from "@/index";
import type {
  ParameterCombination,
  OrchestratorConfig,
  DatasetMetadata,
} from "../core/types";
import { validateParameterCombination } from "../parameters/validation";
import { generateDirectoryName, generateFilePaths } from "../parameters/matrix";

/**
 * Create GameEngineSimulator with default components
 */
function createGameEngineSimulator(
  config: SimulationConfig
): GameEngineSimulator {
  // Create core components
  const playerBalanceManager = new PlayerBalanceManager();
  const virtualDollarManager = new VirtualDollarManager();
  const scoringEngine = new ScoringEngine();

  // Create game session factory
  const gameSessionFactory = new DirectGameSessionFactory(
    DEFAULT_PERFORMANCE_CONFIG
  );

  // Create game matching engine
  const gameMatchingEngine = new GameMatchingEngine(
    virtualDollarManager,
    scoringEngine,
    gameSessionFactory
  );

  // Create run orchestrator
  const runOrchestrator = new RunOrchestrator(
    undefined, // ProgressionManager will be created internally
    virtualDollarManager,
    config.charityPercentage
  );

  // Create revenue calculator
  const revenueCalculator = new RevenueCalculator();

  // Create GameEngineSimulator
  return new GameEngineSimulator(
    playerBalanceManager,
    virtualDollarManager,
    gameMatchingEngine,
    runOrchestrator,
    revenueCalculator,
    scoringEngine
  );
}

/**
 * Configuration mapping between orchestrator parameters and simulation settings
 */
export interface ParameterMappingConfig {
  // Base configuration for all simulations
  baseSimulationDays: number;
  basePlayerCount: number;
  baseInitialDonation: number;
  maxSimulationTimeMs: number;

  // Growth rate scaling factors
  growthRateScaling: {
    playerCountMultiplier: Record<15 | 35 | 60, number>;
    durationMultiplier: Record<15 | 35 | 60, number>;
  };

  // Risk level to cash-out strategy mapping
  riskStrategyMapping: {
    low: Record<CashOutStrategy, number>;
    mid: Record<CashOutStrategy, number>;
    high: Record<CashOutStrategy, number>;
  };
}

/**
 * Result of a single dataset generation operation
 */
export interface AdapterGenerationResult {
  combination: ParameterCombination;
  success: boolean;
  error?: string;
  simulationResults?: SimulationResults;
  generationTimeMs: number;
  outputPaths?: {
    directory: string;
    datasetFile: string;
    metadataFile: string;
  };
}

/**
 * Progress callback function type for dataset generation
 */
export type DatasetProgressCallback = (
  combination: ParameterCombination,
  progress: SimulationProgress
) => void;

/**
 * GameEngineAdapter - Bridges orchestrator parameters to game engine execution
 * Handles parameter translation, simulation execution, and result processing
 */
export class GameEngineAdapter {
  private config: ParameterMappingConfig;
  private orchestratorConfig: OrchestratorConfig;

  constructor(
    orchestratorConfig: OrchestratorConfig,
    mappingConfig?: Partial<ParameterMappingConfig>
  ) {
    this.orchestratorConfig = orchestratorConfig;
    this.config = this.createMappingConfig(mappingConfig);
  }

  /**
   * Generate a single dataset using the provided parameter combination
   */
  async generateDataset(
    combination: ParameterCombination,
    progressCallback?: DatasetProgressCallback
  ): Promise<AdapterGenerationResult> {
    const startTime = performance.now();

    try {
      // Validate parameter combination
      if (!validateParameterCombination(combination)) {
        return {
          combination,
          success: false,
          error: `Invalid parameter combination: ${JSON.stringify(
            combination
          )}`,
          generationTimeMs: performance.now() - startTime,
        };
      }

      // Create simulation configuration
      const simulationConfig = this.createSimulationConfig(combination);

      // Create GameEngineSimulator with components
      const simulator = createGameEngineSimulator(simulationConfig);

      if (this.orchestratorConfig.verbose) {
        console.log(
          `Created GameEngineSimulator for combination ${generateDirectoryName(
            combination
          )}`
        );
      }

      // Create progress wrapper if callback provided
      const wrappedCallback = progressCallback
        ? (progress: SimulationProgress) =>
            progressCallback(combination, progress)
        : undefined;

      // Run simulation
      const simulationResults = await simulator.executeSimulation(
        simulationConfig,
        wrappedCallback
      );

      // Check for simulation success
      if (!simulationResults.success) {
        return {
          combination,
          success: false,
          error:
            simulationResults.error ||
            "Simulation failed without specific error",
          simulationResults,
          generationTimeMs: performance.now() - startTime,
        };
      }

      // Generate output paths
      const outputPaths = generateFilePaths(
        this.orchestratorConfig.outputDirectory,
        combination
      );

      // Return successful result (actual file writing handled elsewhere)
      return {
        combination,
        success: true,
        simulationResults,
        generationTimeMs: performance.now() - startTime,
        outputPaths,
      };
    } catch (error) {
      return {
        combination,
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        generationTimeMs: performance.now() - startTime,
      };
    }
  }

  /**
   * Create simulation configuration from orchestrator parameters
   */
  private createSimulationConfig(
    combination: ParameterCombination
  ): SimulationConfig {
    const { growthRate, riskLevel, charityPercentage } = combination;

    // Apply growth rate scaling
    const playerCountMultiplier =
      this.config.growthRateScaling.playerCountMultiplier[growthRate];
    const durationMultiplier =
      this.config.growthRateScaling.durationMultiplier[growthRate];

    const adjustedPlayerCount = Math.round(
      this.config.basePlayerCount * playerCountMultiplier
    );
    const adjustedDuration = Math.round(
      this.config.baseSimulationDays * durationMultiplier
    );

    // Get cash-out strategy distribution
    const playerStrategies = this.config.riskStrategyMapping[riskLevel];

    // Generate unique seed for reproducibility
    const seed = this.generateSeed(combination);

    return {
      durationDays: adjustedDuration,
      initialPlayerCount: adjustedPlayerCount,
      dailySeed: seed,
      charityPercentage: charityPercentage / 100, // Convert percentage to decimal
      playerStrategies,
      initialDonationAmount: this.config.baseInitialDonation,
      maxSimulationTimeMs: this.config.maxSimulationTimeMs,
      enableProgressReporting: this.orchestratorConfig.enableProgressReporting,
    };
  }

  /**
   * Generate deterministic seed from parameter combination
   */
  private generateSeed(combination: ParameterCombination): string {
    return `orchestrator-${combination.growthRate}-${combination.riskLevel}-${combination.charityPercentage}`;
  }

  /**
   * Create parameter mapping configuration with defaults
   */
  private createMappingConfig(
    overrides?: Partial<ParameterMappingConfig>
  ): ParameterMappingConfig {
    const defaults: ParameterMappingConfig = {
      baseSimulationDays: 365, // 1 year simulation
      basePlayerCount: 1000, // Base player count
      baseInitialDonation: 50, // $50 starting donation
      maxSimulationTimeMs: 300000, // 5 minutes max per simulation

      growthRateScaling: {
        playerCountMultiplier: {
          15: 0.5, // Low growth: 50% of base players
          35: 1.0, // Mid growth: 100% of base players
          60: 2.0, // High growth: 200% of base players
        },
        durationMultiplier: {
          15: 1.0, // All simulations run for same duration
          35: 1.0,
          60: 1.0,
        },
      },

      riskStrategyMapping: {
        low: {
          conservative: 0.7, // 70% conservative cash-out
          balanced: 0.25, // 25% balanced cash-out
          aggressive: 0.05, // 5% aggressive cash-out
        },
        mid: {
          conservative: 0.3, // 30% conservative cash-out
          balanced: 0.5, // 50% balanced cash-out
          aggressive: 0.2, // 20% aggressive cash-out
        },
        high: {
          conservative: 0.1, // 10% conservative cash-out
          balanced: 0.3, // 30% balanced cash-out
          aggressive: 0.6, // 60% aggressive cash-out
        },
      },
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Convert simulation results to dataset metadata
   */
  createDatasetMetadata(
    combination: ParameterCombination,
    simulationResults: SimulationResults,
    generationTimeMs: number,
    datasetSizeBytes: number
  ): DatasetMetadata {
    // Calculate record count from simulation results
    const recordCount = this.calculateRecordCount(simulationResults);

    return {
      generationTimestamp: simulationResults.completedAt,
      parameters: combination,
      generationTimeMs,
      datasetSizeBytes,
      recordCount,
      version: "1.0.0",
      generatorVersion: "orchestrator-v1.0.0",
    };
  }

  /**
   * Calculate estimated record count from simulation results
   */
  private calculateRecordCount(simulationResults: SimulationResults): number {
    // Estimate based on days simulated and average daily activity
    const { gameStats, config } = simulationResults;
    return Math.round(
      config.durationDays * gameStats.averageGamesPerDay +
        gameStats.totalVirtualDollars +
        simulationResults.playerStats.totalPlayers
    );
  }

  /**
   * Validate simulation results meet quality requirements
   */
  validateSimulationResults(simulationResults: SimulationResults): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check basic success
    if (!simulationResults.success) {
      errors.push("Simulation did not complete successfully");
    }

    // Check minimum data requirements
    if (simulationResults.gameStats.totalGames < 10) {
      errors.push("Insufficient games generated (minimum 10 required)");
    }

    if (simulationResults.playerStats.totalPlayers < 1) {
      errors.push("No players found in simulation results");
    }

    // Check revenue calculations are reasonable
    const { revenueStats, playerStats } = simulationResults;
    if (revenueStats.totalPlatformRevenue < 0) {
      errors.push("Invalid negative platform revenue");
    }

    if (revenueStats.totalCharityContributions < 0) {
      errors.push("Invalid negative charity contributions");
    }

    // Check data consistency
    if (
      playerStats.activePlayers + playerStats.retiredPlayers !==
      playerStats.totalPlayers
    ) {
      errors.push("Player count inconsistency detected");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): ParameterMappingConfig {
    return { ...this.config };
  }

  /**
   * Get orchestrator configuration
   */
  getOrchestratorConfig(): OrchestratorConfig {
    return { ...this.orchestratorConfig };
  }

  /**
   * Update parameter mapping configuration
   */
  updateMappingConfig(updates: Partial<ParameterMappingConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Create a dataset generation result for testing/mocking
   */
  static createMockResult(
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
}
