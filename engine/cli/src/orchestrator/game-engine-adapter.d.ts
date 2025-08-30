import { SimulationResults, SimulationProgress } from '../types/simulation-controller';
import { CashOutStrategy } from '../types/virtual-dollar-engine';
import type { ParameterCombination, OrchestratorConfig, DatasetMetadata } from './types';
/**
 * Configuration mapping between orchestrator parameters and simulation settings
 */
export interface ParameterMappingConfig {
    baseSimulationDays: number;
    basePlayerCount: number;
    baseInitialDonation: number;
    maxSimulationTimeMs: number;
    growthRateScaling: {
        playerCountMultiplier: Record<15 | 35 | 60, number>;
        durationMultiplier: Record<15 | 35 | 60, number>;
    };
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
export type DatasetProgressCallback = (combination: ParameterCombination, progress: SimulationProgress) => void;
/**
 * GameEngineAdapter - Bridges orchestrator parameters to game engine execution
 * Handles parameter translation, simulation execution, and result processing
 */
export declare class GameEngineAdapter {
    private config;
    private orchestratorConfig;
    constructor(orchestratorConfig: OrchestratorConfig, mappingConfig?: Partial<ParameterMappingConfig>);
    /**
     * Generate a single dataset using the provided parameter combination
     */
    generateDataset(combination: ParameterCombination, progressCallback?: DatasetProgressCallback): Promise<AdapterGenerationResult>;
    /**
     * Create simulation configuration from orchestrator parameters
     */
    private createSimulationConfig;
    /**
     * Generate deterministic seed from parameter combination
     */
    private generateSeed;
    /**
     * Create parameter mapping configuration with defaults
     */
    private createMappingConfig;
    /**
     * Convert simulation results to dataset metadata
     */
    createDatasetMetadata(combination: ParameterCombination, simulationResults: SimulationResults, generationTimeMs: number, datasetSizeBytes: number): DatasetMetadata;
    /**
     * Calculate estimated record count from simulation results
     */
    private calculateRecordCount;
    /**
     * Validate simulation results meet quality requirements
     */
    validateSimulationResults(simulationResults: SimulationResults): {
        isValid: boolean;
        errors: string[];
    };
    /**
     * Get current configuration
     */
    getConfig(): ParameterMappingConfig;
    /**
     * Get orchestrator configuration
     */
    getOrchestratorConfig(): OrchestratorConfig;
    /**
     * Update parameter mapping configuration
     */
    updateMappingConfig(updates: Partial<ParameterMappingConfig>): void;
    /**
     * Create a dataset generation result for testing/mocking
     */
    static createMockResult(combination: ParameterCombination, success?: boolean): AdapterGenerationResult;
}
//# sourceMappingURL=game-engine-adapter.d.ts.map