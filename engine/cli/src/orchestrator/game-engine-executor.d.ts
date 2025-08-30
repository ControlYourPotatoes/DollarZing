import type { ParameterCombination, OrchestratorConfig, OrchestrationProgress, OrchestrationResults } from './types';
/**
 * Configuration for game engine execution
 */
export interface ExecutorConfig {
    orchestratorConfig: OrchestratorConfig;
    factoryPreset: 'testing' | 'development' | 'production';
    enableProgressReporting: boolean;
    enableDetailedLogging: boolean;
    timeoutPerDataset: number;
    maxRetries: number;
}
/**
 * GameEngineExecutor - High-level orchestration system for dataset generation
 * Integrates all components to execute complete dataset generation workflows
 */
export declare class GameEngineExecutor {
    private config;
    private adapter;
    private factoryManager;
    private isExecuting;
    private aborted;
    constructor(config: ExecutorConfig);
    /**
     * Execute complete dataset generation for all parameter combinations
     */
    executeAllDatasets(progressCallback?: (progress: OrchestrationProgress) => void): Promise<OrchestrationResults>;
    /**
     * Execute dataset generation for specific parameter combinations
     */
    executeDatasets(combinations: ParameterCombination[], progressCallback?: (progress: OrchestrationProgress) => void): Promise<OrchestrationResults>;
    /**
     * Execute a single dataset with retry logic
     */
    private executeDatasetWithRetries;
    /**
     * Create execution context for a single dataset run
     */
    private createExecutionContext;
    /**
     * Execute a single dataset generation with timeout
     */
    private executeSingleDataset;
    /**
     * Create progress wrapper for individual dataset execution
     */
    private createProgressWrapper;
    /**
     * Map adapter result to dataset result format
     */
    private mapToDatasetResult;
    /**
     * Estimate dataset size from simulation results
     */
    private estimateDatasetSize;
    /**
     * Abort ongoing execution
     */
    abort(): void;
    /**
     * Check if executor is currently running
     */
    isRunning(): boolean;
    /**
     * Get current configuration
     */
    getConfig(): ExecutorConfig;
    /**
     * Get factory statistics
     */
    getFactoryStatistics(): any;
    /**
     * Get memory usage estimate
     */
    getMemoryUsage(): any;
    /**
     * Update configuration
     */
    updateConfig(updates: Partial<ExecutorConfig>): void;
    /**
     * Cleanup resources
     */
    destroy(): void;
    /**
     * Utility delay function
     */
    private delay;
}
/**
 * Create executor with default configuration
 */
export declare function createGameEngineExecutor(orchestratorConfig: OrchestratorConfig, preset?: 'testing' | 'development' | 'production'): GameEngineExecutor;
//# sourceMappingURL=game-engine-executor.d.ts.map