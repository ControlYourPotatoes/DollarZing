// Dataset Orchestrator for Game Engine Integration
// Provides abstraction layer between orchestrator parameters and game engine configuration

import {
  GameEngineSimulator,
  SimulationConfig,
  SimulationResults,
  SimulationProgress,
  CashOutStrategy,
  PlayerBalanceManager,
  GameMatchingEngine,
  PlayerRunManager,
  VirtualDollarManager,
  RevenueCalculator,
  ScoringEngine,
  DirectGameSessionFactory,
  DEFAULT_PERFORMANCE_CONFIG,
  EventBus,
  EVENT_TYPES,
  DatasetGenerationStartedEvent,
  DatasetGenerationProgressEvent,
  DatasetGenerationCompletedEvent,
  DatasetValidationEvent,
  ParameterValidationEvent,
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
  config: SimulationConfig,
  eventBus?: EventBus
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

  // Create player run manager
  const playerRunManager = new PlayerRunManager(config.charityPercentage);

  // Create revenue calculator
  const revenueCalculator = new RevenueCalculator();

  // Create GameEngineSimulator
  return new GameEngineSimulator(
    playerBalanceManager,
    virtualDollarManager,
    gameMatchingEngine,
    playerRunManager,
    revenueCalculator,
    scoringEngine,
    eventBus
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
 * DatasetOrchestrator - Orchestrates dataset generation using game engine
 * Handles parameter translation, simulation execution, and result processing
 */
export class DatasetOrchestrator {
  private config: ParameterMappingConfig;
  private orchestratorConfig: OrchestratorConfig;
  private eventBus: EventBus | undefined;

  constructor(
    orchestratorConfig: OrchestratorConfig,
    mappingConfig?: Partial<ParameterMappingConfig>,
    eventBus?: EventBus
  ) {
    this.orchestratorConfig = orchestratorConfig;
    this.config = this.createMappingConfig(mappingConfig);
    this.eventBus = eventBus;
  }

  /**
   * Generate a single dataset using the provided parameter combination
   */
  async generateDataset(
    combination: ParameterCombination,
    progressCallback?: DatasetProgressCallback
  ): Promise<AdapterGenerationResult> {
    const startTime = performance.now();
    const parameterId = this.generateParameterId(combination);

    try {
      // Emit dataset generation started event
      if (this.eventBus) {
        await this.eventBus.emit(EVENT_TYPES.DATASET_GENERATION_STARTED, {
          type: EVENT_TYPES.DATASET_GENERATION_STARTED,
          timestamp: new Date(),
          parameterId,
          combination,
          estimatedDurationMs: this.config.maxSimulationTimeMs,
        } as DatasetGenerationStartedEvent);
      }

      // Validate parameter combination and emit validation event
      const isValid = validateParameterCombination(combination);
      if (this.eventBus) {
        await this.eventBus.emit(EVENT_TYPES.PARAMETER_VALIDATION, {
          type: EVENT_TYPES.PARAMETER_VALIDATION,
          timestamp: new Date(),
          parameterId,
          isValid,
          errors: isValid
            ? []
            : [`Invalid parameter combination: ${JSON.stringify(combination)}`],
          combination,
        } as ParameterValidationEvent);
      }

      if (!isValid) {
        const result: AdapterGenerationResult = {
          combination,
          success: false,
          error: `Invalid parameter combination: ${JSON.stringify(
            combination
          )}`,
          generationTimeMs: performance.now() - startTime,
        };

        // Emit completion event with failure
        if (this.eventBus) {
          await this.eventBus.emit(EVENT_TYPES.DATASET_GENERATION_COMPLETED, {
            type: EVENT_TYPES.DATASET_GENERATION_COMPLETED,
            timestamp: new Date(),
            parameterId,
            success: false,
            durationMs: result.generationTimeMs,
            recordCount: 0,
            error: result.error,
          } as DatasetGenerationCompletedEvent);
        }

        return result;
      }

      // Create simulation configuration
      const simulationConfig = this.createSimulationConfig(combination);

      // Create GameEngineSimulator with EventBus
      const simulator = createGameEngineSimulator(
        simulationConfig,
        this.eventBus as EventBus
      );

      if (this.orchestratorConfig.verbose) {
        console.log(
          `Created GameEngineSimulator for combination ${generateDirectoryName(
            combination
          )}`
        );
      }

      // Create enhanced progress wrapper that emits events
      const wrappedCallback =
        progressCallback || this.eventBus
          ? (progress: SimulationProgress) => {
              // Call original callback if provided
              if (progressCallback) {
                progressCallback(combination, progress);
              }

              // Emit progress event if EventBus available
              if (this.eventBus) {
                this.eventBus.emit(EVENT_TYPES.DATASET_GENERATION_PROGRESS, {
                  type: EVENT_TYPES.DATASET_GENERATION_PROGRESS,
                  timestamp: new Date(),
                  parameterId,
                  currentDay: progress.currentDay,
                  totalDays: progress.totalDays,
                  progressPercentage:
                    (progress.currentDay / progress.totalDays) * 100,
                  gamesProcessed: progress.gamesCompleted || 0,
                  playersActive: progress.playersActive || 0,
                } as DatasetGenerationProgressEvent);
              }
            }
          : undefined;

      // Run simulation
      const simulationResults = await simulator.executeSimulation(
        simulationConfig,
        wrappedCallback
      );

      // Validate simulation results and emit validation event
      const validation = this.validateSimulationResults(simulationResults);
      if (this.eventBus) {
        await this.eventBus.emit(EVENT_TYPES.DATASET_VALIDATION, {
          type: EVENT_TYPES.DATASET_VALIDATION,
          timestamp: new Date(),
          parameterId,
          isValid: validation.isValid,
          errors: validation.errors,
          qualityMetrics: {
            totalGames: simulationResults.gameStats?.totalGames || 0,
            totalPlayers: simulationResults.playerStats?.totalPlayers || 0,
            revenueConsistency:
              (simulationResults.revenueStats?.totalPlatformRevenue || 0) >= 0,
          },
        } as DatasetValidationEvent);
      }

      // Check for simulation success
      if (!simulationResults.success) {
        const result: AdapterGenerationResult = {
          combination,
          success: false,
          error:
            simulationResults.error ||
            "Simulation failed without specific error",
          simulationResults,
          generationTimeMs: performance.now() - startTime,
        };

        // Emit completion event with failure
        if (this.eventBus) {
          await this.eventBus.emit(EVENT_TYPES.DATASET_GENERATION_COMPLETED, {
            type: EVENT_TYPES.DATASET_GENERATION_COMPLETED,
            timestamp: new Date(),
            parameterId,
            success: false,
            durationMs: result.generationTimeMs,
            recordCount: 0,
            error: result.error,
          } as DatasetGenerationCompletedEvent);
        }

        return result;
      }

      // Generate output paths
      const outputPaths = generateFilePaths(
        this.orchestratorConfig.outputDirectory,
        combination
      );

      const result: AdapterGenerationResult = {
        combination,
        success: true,
        simulationResults,
        generationTimeMs: performance.now() - startTime,
        outputPaths,
      };

      // Emit successful completion event
      if (this.eventBus) {
        await this.eventBus.emit(EVENT_TYPES.DATASET_GENERATION_COMPLETED, {
          type: EVENT_TYPES.DATASET_GENERATION_COMPLETED,
          timestamp: new Date(),
          parameterId,
          success: true,
          durationMs: result.generationTimeMs,
          recordCount: this.calculateRecordCount(simulationResults),
          outputPaths,
        } as DatasetGenerationCompletedEvent);
      }

      return result;
    } catch (error) {
      const result: AdapterGenerationResult = {
        combination,
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        generationTimeMs: performance.now() - startTime,
      };

      // Emit completion event with error
      if (this.eventBus) {
        await this.eventBus.emit(EVENT_TYPES.DATASET_GENERATION_COMPLETED, {
          type: EVENT_TYPES.DATASET_GENERATION_COMPLETED,
          timestamp: new Date(),
          parameterId,
          success: false,
          durationMs: result.generationTimeMs,
          recordCount: 0,
          error: result.error,
        } as DatasetGenerationCompletedEvent);
      }

      return result;
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

  /**
   * Generate a unique parameter ID for tracking
   */
  private generateParameterId(combination: ParameterCombination): string {
    return `${combination.growthRate}-${combination.riskLevel}-${combination.charityPercentage}`;
  }

  /**
   * Validate simulation results for quality metrics
   */
  private validateSimulationResults(results: SimulationResults): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!results.success) {
      errors.push("Simulation failed");
    }

    if (!results.gameStats || results.gameStats.totalGames === 0) {
      errors.push("No games were processed");
    }

    if (!results.playerStats || results.playerStats.totalPlayers === 0) {
      errors.push("No players were active");
    }

    if (results.revenueStats && results.revenueStats.totalPlatformRevenue < 0) {
      errors.push("Invalid revenue data");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate record count from simulation results
   */
  private calculateRecordCount(results: SimulationResults): number {
    return results.dailyResults?.length || 0;
  }
}
