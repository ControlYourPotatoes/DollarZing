// Game Engine Executor for Dataset Orchestrator
// High-level orchestration system that integrates the game engine adapter with factory management

import {
  DatasetOrchestrator,
  AdapterGenerationResult,
  DatasetProgressCallback,
} from "./dataset-orchestrator";
import {
  OrchestratorFactoryManager,
  createOrchestratorFactoryManager,
} from "./factory-integration";
import type {
  ParameterCombination,
  DatasetGenerationResult,
  OrchestratorConfig,
  OrchestrationProgress,
  OrchestrationResults,
} from "../core/types";
import {
  generateAllCombinations,
  generateDirectoryName,
} from "../parameters/matrix";
import { validateParameterCombination } from "../parameters/validation";
import { EventBus } from "@/index";

/**
 * Configuration for game engine execution
 */
export interface ExecutorConfig {
  orchestratorConfig: OrchestratorConfig;
  factoryPreset: "testing" | "development" | "production";
  enableProgressReporting: boolean;
  enableDetailedLogging: boolean;
  timeoutPerDataset: number;
  maxRetries: number;
}

/**
 * Execution context for a single dataset generation run
 */
interface ExecutionContext {
  combination: ParameterCombination;
  attemptNumber: number;
  startTime: number;
  adapter: DatasetOrchestrator;
  factoryManager: OrchestratorFactoryManager;
}

/**
 * Progress tracking for orchestrator execution
 */
class ProgressTracker {
  private startTime: number;
  private totalCombinations: number;
  private completed: ParameterCombination[] = [];
  private failed: ParameterCombination[] = [];
  private current: ParameterCombination | null = null;

  constructor(totalCombinations: number) {
    this.startTime = performance.now();
    this.totalCombinations = totalCombinations;
  }

  startCombination(combination: ParameterCombination): void {
    this.current = combination;
  }

  completeCombination(
    combination: ParameterCombination,
    success: boolean
  ): void {
    this.current = null;

    if (success) {
      this.completed.push(combination);
    } else {
      this.failed.push(combination);
    }
  }

  getProgress(): OrchestrationProgress {
    const elapsed = performance.now() - this.startTime;
    const completedCount = this.completed.length + this.failed.length;
    const completionPercentage = completedCount / this.totalCombinations;

    const estimatedTotal =
      completionPercentage > 0 ? elapsed / completionPercentage : 0;
    const estimatedRemaining = Math.max(0, estimatedTotal - elapsed);

    return {
      totalCombinations: this.totalCombinations,
      completedCombinations: completedCount,
      currentCombination: this.current,
      completionPercentage,
      elapsedTimeMs: elapsed,
      estimatedRemainingMs: estimatedRemaining,
      failedCombinations: [...this.failed],
      successfulCombinations: [...this.completed],
    };
  }

  isComplete(): boolean {
    return this.completed.length + this.failed.length >= this.totalCombinations;
  }
}

/**
 * GameEngineExecutor - High-level orchestration system for dataset generation
 * Integrates all components to execute complete dataset generation workflows
 */
export class GameEngineExecutor {
  private config: ExecutorConfig;
  private adapterFactory: (bus?: EventBus) => DatasetOrchestrator;
  private factoryManager: OrchestratorFactoryManager;
  private isExecuting: boolean = false;
  private aborted: boolean = false;

  constructor(config: ExecutorConfig) {
    this.config = config;

    this.adapterFactory = (bus?: EventBus) =>
      new DatasetOrchestrator(
        this.config.orchestratorConfig,
        undefined,
        bus ?? new EventBus()
      );

    this.factoryManager = createOrchestratorFactoryManager(
      config.factoryPreset
    );
  }

  /**
   * Execute complete dataset generation for all parameter combinations
   */
  async executeAllDatasets(
    progressCallback?: (progress: OrchestrationProgress) => void
  ): Promise<OrchestrationResults> {
    if (this.isExecuting) {
      throw new Error("Executor is already running");
    }

    this.isExecuting = true;
    this.aborted = false;
    const startTime = performance.now();

    try {
      // Generate all parameter combinations
      const allCombinations = generateAllCombinations();
      const tracker = new ProgressTracker(allCombinations.length);
      const results: DatasetGenerationResult[] = [];

      if (this.config.enableDetailedLogging) {
        console.log(
          `Starting dataset generation for ${allCombinations.length} parameter combinations`
        );
      }

      // Process each combination
      for (const combination of allCombinations) {
        if (this.aborted) {
          break;
        }

        tracker.startCombination(combination);

        if (progressCallback) {
          progressCallback(tracker.getProgress());
        }

        const result = await this.executeDatasetWithRetries(combination);
        results.push(result);

        tracker.completeCombination(combination, result.success);

        if (this.config.enableDetailedLogging) {
          const status = result.success ? "SUCCESS" : "FAILED";
          console.log(
            `${status}: ${generateDirectoryName(combination)} (${
              result.generationTimeMs
            }ms)`
          );
          if (!result.success && result.error) {
            console.log(`  Error: ${result.error}`);
          }
        }

        // Report progress after completion
        if (progressCallback) {
          progressCallback(tracker.getProgress());
        }

        // Small delay to prevent overwhelming the system
        await this.delay(10);
      }

      // Final results
      const totalTime = performance.now() - startTime;
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return {
        totalProcessed: results.length,
        successful,
        failed,
        totalTimeMs: totalTime,
        results,
        outputDirectory: this.config.orchestratorConfig.outputDirectory,
      };
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Execute dataset generation for specific parameter combinations
   */
  async executeDatasets(
    combinations: ParameterCombination[],
    progressCallback?: (progress: OrchestrationProgress) => void
  ): Promise<OrchestrationResults> {
    if (this.isExecuting) {
      throw new Error("Executor is already running");
    }

    // Validate combinations
    for (const combination of combinations) {
      if (!validateParameterCombination(combination)) {
        throw new Error(
          `Invalid parameter combination: ${JSON.stringify(combination)}`
        );
      }
    }

    this.isExecuting = true;
    this.aborted = false;
    const startTime = performance.now();

    try {
      const tracker = new ProgressTracker(combinations.length);
      const results: DatasetGenerationResult[] = [];

      if (this.config.enableDetailedLogging) {
        console.log(
          `Starting dataset generation for ${combinations.length} specified combinations`
        );
      }

      for (const combination of combinations) {
        if (this.aborted) {
          break;
        }

        tracker.startCombination(combination);

        if (progressCallback) {
          progressCallback(tracker.getProgress());
        }

        const result = await this.executeDatasetWithRetries(combination);
        results.push(result);

        tracker.completeCombination(combination, result.success);

        if (this.config.enableDetailedLogging) {
          const status = result.success ? "SUCCESS" : "FAILED";
          console.log(
            `${status}: ${generateDirectoryName(combination)} (${
              result.generationTimeMs
            }ms)`
          );
        }

        if (progressCallback) {
          progressCallback(tracker.getProgress());
        }

        await this.delay(10);
      }

      const totalTime = performance.now() - startTime;
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return {
        totalProcessed: results.length,
        successful,
        failed,
        totalTimeMs: totalTime,
        results,
        outputDirectory: this.config.orchestratorConfig.outputDirectory,
      };
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Execute a single dataset with retry logic
   */
  private async executeDatasetWithRetries(
    combination: ParameterCombination
  ): Promise<DatasetGenerationResult> {
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const context = this.createExecutionContext(combination, attempt);
        const result = await this.executeSingleDataset(context);

        if (result.success) {
          return this.mapToDatasetResult(result);
        } else {
          lastError = result.error;
          if (
            this.config.enableDetailedLogging &&
            attempt < this.config.maxRetries
          ) {
            console.log(
              `Retry ${attempt}/${
                this.config.maxRetries
              } for ${generateDirectoryName(combination)}: ${result.error}`
            );
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown error";
        if (
          this.config.enableDetailedLogging &&
          attempt < this.config.maxRetries
        ) {
          console.log(
            `Retry ${attempt}/${
              this.config.maxRetries
            } for ${generateDirectoryName(combination)}: ${lastError}`
          );
        }
      }

      // Reset factory state before retry
      if (attempt < this.config.maxRetries) {
        this.factoryManager.resetAllFactories();
        await this.delay(1000); // 1 second delay between retries
      }
    }

    // All retries failed
    return {
      combination,
      success: false,
      error: `Failed after ${this.config.maxRetries} attempts. Last error: ${lastError}`,
      generationTimeMs: 0,
    };
  }

  /**
   * Create execution context for a single dataset run
   */
  private createExecutionContext(
    combination: ParameterCombination,
    attempt: number
  ): ExecutionContext {
    return {
      combination,
      attemptNumber: attempt,
      startTime: performance.now(),
      adapter: this.adapterFactory(),
      factoryManager: this.factoryManager,
    };
  }

  /**
   * Execute a single dataset generation with timeout
   */
  private async executeSingleDataset(
    context: ExecutionContext
  ): Promise<AdapterGenerationResult> {
    const timeoutPromise = new Promise<AdapterGenerationResult>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Dataset generation timeout after ${this.config.timeoutPerDataset}ms`
          )
        );
      }, this.config.timeoutPerDataset);
    });

    const executionPromise = context.adapter.generateDataset(
      context.combination,
      this.createProgressWrapper(context)
    );

    return Promise.race([executionPromise, timeoutPromise]);
  }

  /**
   * Create progress wrapper for individual dataset execution
   */
  private createProgressWrapper(
    _context: ExecutionContext
  ): DatasetProgressCallback | undefined {
    if (!this.config.enableProgressReporting) {
      return undefined;
    }

    return (combination, progress) => {
      if (this.config.enableDetailedLogging) {
        console.log(
          `${generateDirectoryName(combination)}: Day ${
            progress.currentDay
          } (${progress.completionPercentage.toFixed(1)}%)`
        );
      }
    };
  }

  /**
   * Map adapter result to dataset result format
   */
  private mapToDatasetResult(
    result: AdapterGenerationResult
  ): DatasetGenerationResult {
    const mappedResult: DatasetGenerationResult = {
      combination: result.combination,
      success: result.success,
      generationTimeMs: result.generationTimeMs,
    };

    // Only set optional properties if they have values
    if (result.error !== undefined) {
      mappedResult.error = result.error;
    }
    if (result.outputPaths?.datasetFile !== undefined) {
      mappedResult.outputPath = result.outputPaths.datasetFile;
    }
    if (result.outputPaths?.metadataFile !== undefined) {
      mappedResult.metadataPath = result.outputPaths.metadataFile;
    }
    if (result.simulationResults !== undefined) {
      mappedResult.datasetSizeBytes = this.estimateDatasetSize(
        result.simulationResults
      );
    }

    return mappedResult;
  }

  /**
   * Estimate dataset size from simulation results
   */
  private estimateDatasetSize(simulationResults: any): number {
    // Rough estimate based on data points
    const dataPoints =
      simulationResults.config.durationDays * 10 + // Daily data points
      simulationResults.gameStats.totalGames + // Game records
      simulationResults.playerStats.totalPlayers; // Player records

    return dataPoints * 200; // Rough estimate: 200 bytes per data point
  }

  /**
   * Abort ongoing execution
   */
  abort(): void {
    this.aborted = true;
  }

  /**
   * Check if executor is currently running
   */
  isRunning(): boolean {
    return this.isExecuting;
  }

  /**
   * Get current configuration
   */
  getConfig(): ExecutorConfig {
    return { ...this.config };
  }

  /**
   * Get factory statistics
   */
  getFactoryStatistics(): any {
    return this.factoryManager.getAllFactoryStatistics();
  }

  /**
   * Get memory usage estimate
   */
  getMemoryUsage(): any {
    return this.factoryManager.getMemoryUsageEstimate();
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ExecutorConfig>): void {
    this.config = { ...this.config, ...updates };

    // Recreate adapter if orchestrator config changed
    if (updates.orchestratorConfig) {
      const baseFactory = (bus?: EventBus) =>
        new DatasetOrchestrator(
          this.config.orchestratorConfig,
          undefined,
          bus ?? new EventBus()
        );

      this.adapterFactory = baseFactory;
    }

    // Recreate factory manager if preset changed
    if (updates.factoryPreset) {
      this.factoryManager = createOrchestratorFactoryManager(
        this.config.factoryPreset
      );
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.abort();
    this.factoryManager.destroy();
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create executor with default configuration
 */
export function createGameEngineExecutor(
  orchestratorConfig: OrchestratorConfig,
  preset: "testing" | "development" | "production" = "development"
): GameEngineExecutor {
  const config: ExecutorConfig = {
    orchestratorConfig,
    factoryPreset: preset,
    enableProgressReporting: orchestratorConfig.enableProgressReporting,
    enableDetailedLogging: orchestratorConfig.verbose,
    timeoutPerDataset: orchestratorConfig.timeoutPerDataset,
    maxRetries: 2, // Default retry count
  };

  return new GameEngineExecutor(config);
}
