// Dataset Orchestrator for Game Engine Integration
// Provides abstraction layer between orchestrator parameters and game engine configuration

import { join } from "path";
import { promises as fs } from "fs";

import {
  SimulationConfig,
  SimulationResults,
  SimulationProgress,
  CashOutStrategy,
  EventBus,
  EVENT_TYPES,
  DatasetGenerationStartedEvent,
  DatasetGenerationProgressEvent,
  DatasetGenerationCompletedEvent,
  DatasetValidationEvent,
  ParameterValidationEvent,
  QualityAssuranceEvent,
  createProductionSimulator,
  type SimulatorAssembly,
  type DailyAggregateSnapshot,
  generateDailyAggregates,
  buildPresentationSnapshotFile,
  mapParametersToScenario,
  type PresentationSnapshotFile,
  createManifestEntry,
  upsertPresentationManifest,
} from "@/index";
import type {
  ParameterCombination,
  OrchestratorConfig,
  DatasetMetadata,
  DatasetArtifactPaths,
} from "../core/types";
import { validateParameterCombination } from "../parameters/validation";
import { generateDirectoryName, generateFilePaths } from "../parameters/matrix";
import type {
  EventDebugInterface,
  EventTrace,
} from "../../../../src/events/debug/index";
import {
  serializeSimulationResults,
  serializeDatasetMetadata,
  serializeDailySnapshots,
  serializePresentationSnapshots,
  formatEventTracesAsNdjson,
  writeDatasetArtifacts,
  type DatasetArtifactContent,
} from "./dataset-writer";

type DebugSessionResult = ReturnType<EventDebugInterface["endSession"]>;

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
  outputPaths?: DatasetArtifactPaths;
  snapshotCount?: number;
  eventCount?: number;
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
  private sharedEventBus: EventBus | undefined;

  constructor(
    orchestratorConfig: OrchestratorConfig,
    mappingConfig?: Partial<ParameterMappingConfig>,
    eventBus?: EventBus
  ) {
    this.orchestratorConfig = orchestratorConfig;
    this.config = this.createMappingConfig(mappingConfig);
    this.sharedEventBus = eventBus;
  }

  private getEventBus(): EventBus | undefined {
    return this.sharedEventBus;
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
    const eventBus = this.getEventBus();

    try {
      // Emit dataset generation started event
      if (eventBus) {
        await eventBus.emit(EVENT_TYPES.DATASET_GENERATION_STARTED, {
          type: EVENT_TYPES.DATASET_GENERATION_STARTED,
          timestamp: new Date(),
          parameterId,
          combination,
          estimatedDurationMs: this.config.maxSimulationTimeMs,
        } as DatasetGenerationStartedEvent);
      }

      // Validate parameter combination and emit validation event
      const isValid = validateParameterCombination(combination);
      if (eventBus) {
        await eventBus.emit(EVENT_TYPES.PARAMETER_VALIDATION, {
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
        if (eventBus) {
          await eventBus.emit(EVENT_TYPES.DATASET_GENERATION_COMPLETED, {
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

      // Assemble simulator using factory integration
      const shouldCollectSnapshots =
        this.orchestratorConfig.collectDailySnapshots;
      const shouldCollectEvents = this.orchestratorConfig.collectEventTraces;
      const shouldCollectPresentation =
        this.orchestratorConfig.collectPresentationSnapshots;
      const requireDailySnapshots =
        shouldCollectSnapshots || shouldCollectPresentation;

      const assembly = this.createSimulatorAssembly(
        parameterId,
        simulationConfig,
        shouldCollectSnapshots,
        shouldCollectEvents,
        !!this.orchestratorConfig.debugEvents,
        eventBus
      );
      const { simulator, profile } = assembly;

      if (this.orchestratorConfig.verbose) {
        console.log(
          `Prepared simulator profile ${
            profile.name
          } for combination ${generateDirectoryName(combination)}`
        );
      }

      const debugInterface = shouldCollectEvents
        ? assembly.debugInterface
        : undefined;
      let debugSession: DebugSessionResult | null = null;

      if (debugInterface) {
        debugInterface.startSession(`dataset-${parameterId}`);
      }

      try {
        // Create enhanced progress wrapper that emits events
        const wrappedCallback =
          progressCallback || eventBus
            ? (progress: SimulationProgress) => {
                // Call original callback if provided
                if (progressCallback) {
                  progressCallback(combination, progress);
                }

                // Emit progress event if EventBus available
                if (eventBus) {
                  void eventBus.emit(EVENT_TYPES.DATASET_GENERATION_PROGRESS, {
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
        if (eventBus) {
          await eventBus.emit(EVENT_TYPES.DATASET_VALIDATION, {
            type: EVENT_TYPES.DATASET_VALIDATION,
            timestamp: new Date(),
            parameterId,
            isValid: validation.isValid,
            errors: validation.errors,
            qualityMetrics: {
              totalGames: simulationResults.gameStats?.totalGames || 0,
              totalPlayers: simulationResults.playerStats?.totalPlayers || 0,
              revenueConsistency:
                (simulationResults.revenueStats?.totalPlatformRevenue || 0) >=
                0,
            },
          } as DatasetValidationEvent);
        }

        // Perform quality assurance checks
        await this.performQualityAssurance(parameterId, simulationResults);

        // Check for simulation success
        if (!simulationResults.success || simulationResults.termination) {
          const terminationInfo = simulationResults.termination
            ? ` (terminated: ${simulationResults.termination.reason.code} after day ${simulationResults.termination.dayCompleted})`
            : "";
          const generationTimeMs = performance.now() - startTime;
          const failureResult: AdapterGenerationResult = {
            combination,
            success: false,
            error:
              simulationResults.error ||
              simulationResults.termination?.reason.message ||
              "Simulation failed without specific error",
            simulationResults,
            generationTimeMs,
          };

          if (
            terminationInfo &&
            failureResult.error &&
            !failureResult.error.includes("terminated")
          ) {
            failureResult.error += terminationInfo;
          }

          if (eventBus) {
            await eventBus.emit(EVENT_TYPES.DATASET_GENERATION_COMPLETED, {
              type: EVENT_TYPES.DATASET_GENERATION_COMPLETED,
              timestamp: new Date(),
              parameterId,
              success: false,
              durationMs: generationTimeMs,
              recordCount: 0,
              error: failureResult.error,
            } as DatasetGenerationCompletedEvent);
          }

          return failureResult;
        }

        const generationTimeMs = performance.now() - startTime;
        const scenarioSlug = generateDirectoryName(combination);
        const outputPaths = generateFilePaths(
          this.orchestratorConfig.outputDirectory,
          combination
        );
        const recordCount = this.calculateRecordCount(simulationResults);
        const dailySnapshots: DailyAggregateSnapshot[] = requireDailySnapshots
          ? simulationResults.dailyAggregates ??
            generateDailyAggregates(
              simulationResults,
              simulationResults.levelTrackingSnapshot
            ) // Use real level tracking
          : [];
        const presentationSnapshot: PresentationSnapshotFile | undefined =
          shouldCollectPresentation
            ? buildPresentationSnapshotFile({
                scenarioId: scenarioSlug,
                dailySnapshots,
                ...mapParametersToScenario(combination),
              })
            : undefined;
        debugSession = debugInterface?.endSession() ?? null;
        const eventTraces: EventTrace[] = shouldCollectEvents
          ? ((debugSession?.traces ?? []) as EventTrace[])
          : [];

        if (
          shouldCollectEvents &&
          this.orchestratorConfig.debugEvents &&
          debugSession
        ) {
          const debugDir = join(
            this.orchestratorConfig.outputDirectory,
            "anchor-datasets",
            scenarioSlug,
            "debug"
          );
          await fs.mkdir(debugDir, { recursive: true });

          const traceFile = join(debugDir, "event-traces.json");
          await fs.writeFile(
            traceFile,
            JSON.stringify(debugSession.traces, null, 2),
            "utf8"
          );

          if (debugSession.logs.length > 0) {
            const logFile = join(debugDir, "event-logs.json");
            await fs.writeFile(
              logFile,
              JSON.stringify(debugSession.logs, null, 2),
              "utf8"
            );
          }
        }

        const datasetJson = serializeSimulationResults(simulationResults);
        const datasetSizeBytes = Buffer.byteLength(datasetJson, "utf8");

        let metadataJson: string | undefined;
        if (this.orchestratorConfig.generateMetadata) {
          const metadata = this.createDatasetMetadata(
            combination,
            simulationResults,
            generationTimeMs,
            datasetSizeBytes,
            {
              simulatorProfileName: profile.name,
              poolingEnabled: assembly.poolingEnabled,
              snapshotCount: dailySnapshots.length,
              eventCount: eventTraces.length,
              presentationCount: presentationSnapshot?.days.length ?? 0,
              artifactPaths: outputPaths,
              termination: simulationResults.termination || null,
            }
          );
          metadataJson = serializeDatasetMetadata(metadata);
        }

        const snapshotsJson = shouldCollectSnapshots
          ? serializeDailySnapshots(dailySnapshots)
          : undefined;
        const eventsContent = shouldCollectEvents
          ? formatEventTracesAsNdjson(eventTraces)
          : undefined;
        const presentationJson =
          shouldCollectPresentation && presentationSnapshot
            ? serializePresentationSnapshots(presentationSnapshot)
            : undefined;

        const artifactContent: DatasetArtifactContent = {
          datasetJson,
        };

        if (metadataJson !== undefined) {
          artifactContent.metadataJson = metadataJson;
        }

        if (snapshotsJson !== undefined) {
          artifactContent.snapshotsJson = snapshotsJson;
        }

        if (eventsContent !== undefined && eventsContent.length > 0) {
          artifactContent.eventsNdjson = eventsContent;
        }

        if (presentationJson !== undefined) {
          artifactContent.presentationJson = presentationJson;
        }

        await writeDatasetArtifacts(outputPaths, artifactContent, {
          dryRun: this.orchestratorConfig.dryRun,
        });

        if (shouldCollectPresentation && presentationSnapshot) {
          const manifestPath = join(
            this.orchestratorConfig.outputDirectory,
            "anchor-datasets",
            "presentation-manifest.json"
          );
          const relativePath = `anchor-datasets/${scenarioSlug}/presentation-snapshots.json`;
          await upsertPresentationManifest(
            manifestPath,
            createManifestEntry(
              scenarioSlug,
              presentationSnapshot,
              relativePath
            )
          );
        }

        const successResult: AdapterGenerationResult = {
          combination,
          success: true,
          simulationResults,
          generationTimeMs,
          outputPaths,
          snapshotCount: dailySnapshots.length,
          eventCount: eventTraces.length,
        };

        if (eventBus) {
          await eventBus.emit(EVENT_TYPES.DATASET_GENERATION_COMPLETED, {
            type: EVENT_TYPES.DATASET_GENERATION_COMPLETED,
            timestamp: new Date(),
            parameterId,
            success: true,
            durationMs: generationTimeMs,
            recordCount,
            outputPaths,
          } as DatasetGenerationCompletedEvent);
        }

        return successResult;
      } finally {
        if (debugInterface) {
          if (!debugSession) {
            debugSession = debugInterface.endSession();
          }
          debugInterface.detach();
        }
        assembly.dispose();
      }
    } catch (error) {
      const result: AdapterGenerationResult = {
        combination,
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        generationTimeMs: performance.now() - startTime,
      };

      // Emit completion event with error
      if (eventBus) {
        await eventBus.emit(EVENT_TYPES.DATASET_GENERATION_COMPLETED, {
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

    // Convert growth rate percentage to decimal adoption rate
    const adoptionRate = growthRate / 100; // 15% -> 0.15, 35% -> 0.35, 60% -> 0.60

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

      // S-curve growth model parameters
      growthModel: {
        adoptionRate: adoptionRate, // Use calculated adoption rate from growth rate percentage
        baseMarket: 1000000, // 1M base market size
        midpointDay: 90, // S-curve inflection at day 90
        steepnessFactor: 20, // Controls curve steepness
      },
    };
  }

  /**
   * Build simulator assembly using production factory defaults
   */
  private createSimulatorAssembly(
    parameterId: string,
    simulationConfig: SimulationConfig,
    collectDailySnapshots: boolean,
    collectEventTraces: boolean,
    debugEvents: boolean,
    sharedEventBus?: EventBus
  ): SimulatorAssembly {
    const simulationEventBus =
      sharedEventBus ?? new EventBus({ enableTracing: debugEvents });

    return createProductionSimulator({
      eventBus: simulationEventBus,
      profileOverrides: {
        name: `anchor-${parameterId}`,
        config: {
          durationDays: simulationConfig.durationDays,
          initialPlayerCount: simulationConfig.initialPlayerCount,
          dailySeed: simulationConfig.dailySeed,
          charityPercentage: simulationConfig.charityPercentage,
          playerStrategies: simulationConfig.playerStrategies,
          initialDonationAmount: simulationConfig.initialDonationAmount,
          maxSimulationTimeMs: simulationConfig.maxSimulationTimeMs,
          enableProgressReporting: simulationConfig.enableProgressReporting,
          growthModel: simulationConfig.growthModel,
        },
        runtime: {
          collectDailySnapshots,
          collectEventTraces,
        },
      },
      ...(collectEventTraces
        ? {
            debug: {
              enableEventTracing: true,
              config: {
                debugger: {
                  enabled: true,
                  includeData: debugEvents,
                  maxTraces: debugEvents ? 2000 : 1000, // Reduced from 20000/10000 to prevent stack overflow
                  logLevel: debugEvents
                    ? "debug"
                    : this.orchestratorConfig.verbose
                    ? "info"
                    : "warn",
                  enablePerformanceTracking: debugEvents,
                  enableEventFlowVisualization: debugEvents,
                },
                logger: {
                  enabled: debugEvents,
                  level: debugEvents ? "debug" : "info",
                },
                performanceMonitor: {
                  enabled: debugEvents,
                },
                autoStartMonitoring: debugEvents,
              },
            },
          }
        : {}),
    });
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
      maxSimulationTimeMs: 1800000, // 30 minutes max per simulation

      growthRateScaling: {
        playerCountMultiplier: {
          15: 0.5, // Low growth: 50% of base players
          35: 0.5, // Mid growth: 100% of base players
          60: 0.5, // High growth: 200% of base players
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
    datasetSizeBytes: number,
    extras?: {
      simulatorProfileName: string;
      poolingEnabled: boolean;
      snapshotCount: number;
      eventCount: number;
      presentationCount: number;
      artifactPaths: DatasetArtifactPaths;
      termination?: {
        reason: {
          code: string;
          message: string;
        };
        dayCompleted: number;
      } | null;
    }
  ): DatasetMetadata {
    // Calculate record count from simulation results
    const recordCount = this.calculateRecordCount(simulationResults);

    const metadata: DatasetMetadata = {
      generationTimestamp: simulationResults.completedAt,
      parameters: combination,
      generationTimeMs,
      datasetSizeBytes,
      recordCount,
      version: "1.0.0",
      generatorVersion: "orchestrator-v1.0.0",
    };

    if (extras) {
      metadata.runtime = {
        simulatorProfileName: extras.simulatorProfileName,
        poolingEnabled: extras.poolingEnabled,
      };

      metadata.artifacts = {
        dataset: extras.artifactPaths.datasetFile,
        metadata: extras.artifactPaths.metadataFile,
        dailySnapshots: extras.artifactPaths.snapshotsFile,
        events: extras.artifactPaths.eventsFile,
        ...(extras.presentationCount > 0
          ? { presentation: extras.artifactPaths.presentationFile }
          : {}),
      };

      metadata.aggregates = {
        dailySnapshotCount: extras.snapshotCount,
        eventTraceCount: extras.eventCount,
        ...(extras.presentationCount > 0
          ? { presentationSnapshotCount: extras.presentationCount }
          : {}),
      };

      if (extras.termination) {
        metadata.termination = {
          reason: extras.termination.reason,
          dayCompleted: extras.termination.dayCompleted,
        };
      }
    }

    return metadata;
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

  /**
   * Perform quality assurance checks and emit events
   */
  private async performQualityAssurance(
    parameterId: string,
    simulationResults: SimulationResults
  ): Promise<void> {
    if (!this.sharedEventBus) return;

    // Data integrity check
    const dataIntegrityPassed =
      simulationResults.success &&
      simulationResults.gameStats?.totalGames > 0 &&
      simulationResults.playerStats?.totalPlayers > 0;

    await this.sharedEventBus.emit(EVENT_TYPES.QUALITY_ASSURANCE, {
      type: EVENT_TYPES.QUALITY_ASSURANCE,
      timestamp: new Date(),
      parameterId,
      checkType: "DATA_INTEGRITY",
      passed: dataIntegrityPassed,
      details: dataIntegrityPassed
        ? "All essential data fields present and valid"
        : "Missing or invalid essential data fields",
      metrics: {
        totalGames: simulationResults.gameStats?.totalGames || 0,
        totalPlayers: simulationResults.playerStats?.totalPlayers || 0,
      },
    } as QualityAssuranceEvent);

    // Performance check
    const performancePassed =
      simulationResults.simulationDurationMs < this.config.maxSimulationTimeMs;

    await this.sharedEventBus.emit(EVENT_TYPES.QUALITY_ASSURANCE, {
      type: EVENT_TYPES.QUALITY_ASSURANCE,
      timestamp: new Date(),
      parameterId,
      checkType: "PERFORMANCE",
      passed: performancePassed,
      details: performancePassed
        ? "Simulation completed within acceptable time limits"
        : `Simulation exceeded time limit: ${simulationResults.simulationDurationMs}ms vs ${this.config.maxSimulationTimeMs}ms`,
      metrics: {
        simulationDurationMs: simulationResults.simulationDurationMs,
        maxAllowedMs: this.config.maxSimulationTimeMs,
      },
    } as QualityAssuranceEvent);

    // Revenue consistency check
    const revenueConsistency = simulationResults.revenueStats
      ? simulationResults.revenueStats.totalPlatformRevenue >= 0 &&
        simulationResults.revenueStats.totalCharityContributions >= 0 &&
        simulationResults.revenueStats.totalPlayerPayouts >= 0
      : false;

    await this.sharedEventBus.emit(EVENT_TYPES.QUALITY_ASSURANCE, {
      type: EVENT_TYPES.QUALITY_ASSURANCE,
      timestamp: new Date(),
      parameterId,
      checkType: "CONSISTENCY",
      passed: revenueConsistency,
      details: revenueConsistency
        ? "Revenue calculations are consistent and valid"
        : "Revenue calculations show inconsistencies or invalid values",
      metrics: {
        platformRevenue:
          simulationResults.revenueStats?.totalPlatformRevenue || 0,
        charityContributions:
          simulationResults.revenueStats?.totalCharityContributions || 0,
        playerPayouts: simulationResults.revenueStats?.totalPlayerPayouts || 0,
      },
    } as QualityAssuranceEvent);
  }
}
