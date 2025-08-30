import { VirtualDollarFactory, GameSessionFactory, PerformanceConfig, FactorySelector } from '../types/factory-interfaces';
import type { ParameterCombination } from './types';
/**
 * Factory configuration specific to orchestrator requirements
 */
export interface OrchestratorFactoryConfig extends PerformanceConfig {
    isolateParameterRuns: boolean;
    enableCrossRunPooling: boolean;
    maxConcurrentRuns: number;
    forceCleanupBetweenRuns: boolean;
    poolResetThreshold: number;
}
/**
 * Configuration profiles for different orchestrator scenarios
 */
export declare const ORCHESTRATOR_CONFIGS: {
    testing: OrchestratorFactoryConfig;
    development: OrchestratorFactoryConfig;
    production: OrchestratorFactoryConfig;
};
/**
 * OrchestratorFactoryManager - Manages factory instances with parameter isolation
 * Ensures each parameter combination gets isolated factory instances if configured
 */
export declare class OrchestratorFactoryManager {
    private config;
    private factoryInstances;
    private runCounter;
    constructor(config?: OrchestratorFactoryConfig);
    /**
     * Get factory instances for a specific parameter combination
     * Creates isolated instances if parameter isolation is enabled
     */
    getFactories(combination: ParameterCombination): {
        virtualDollarFactory: VirtualDollarFactory;
        gameSessionFactory: GameSessionFactory;
    };
    /**
     * Create a new factory instance for the given parameter combination
     */
    private createFactoryInstance;
    /**
     * Adjust factory configuration based on parameter combination
     * Different parameters might require different optimization strategies
     */
    private adjustConfigForParameters;
    /**
     * Create a unique key for parameter combinations
     */
    private createParameterKey;
    /**
     * Reset a specific factory instance (cleanup pools and statistics)
     */
    private resetFactoryInstance;
    /**
     * Reset all factory instances (useful between orchestrator runs)
     */
    resetAllFactories(): void;
    /**
     * Get statistics for all active factory instances
     */
    getAllFactoryStatistics(): Record<string, {
        combination: ParameterCombination;
        virtualDollarStats: any;
        gameSessionStats: any;
        runCount: number;
        age: number;
    }>;
    /**
     * Get memory usage estimation for all factories
     */
    getMemoryUsageEstimate(): {
        totalMemoryMB: number;
        factoryCount: number;
        breakdown: Record<string, number>;
    };
    /**
     * Update configuration (causes reset of all factories)
     */
    updateConfig(newConfig: Partial<OrchestratorFactoryConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): OrchestratorFactoryConfig;
    /**
     * Force garbage collection if available (Node.js environment)
     */
    private forceGarbageCollection;
    /**
     * Cleanup resources before destruction
     */
    destroy(): void;
}
/**
 * Factory selector implementation for orchestrator use
 */
export declare class OrchestratorFactorySelector implements FactorySelector {
    private config;
    constructor(config?: OrchestratorFactoryConfig);
    selectVirtualDollarFactory(config: PerformanceConfig): VirtualDollarFactory;
    selectGameSessionFactory(config: PerformanceConfig): GameSessionFactory;
}
/**
 * Utility function to create factory manager with preset configurations
 */
export declare function createOrchestratorFactoryManager(preset?: 'testing' | 'development' | 'production'): OrchestratorFactoryManager;
/**
 * Utility function to validate factory configuration
 */
export declare function validateFactoryConfig(config: OrchestratorFactoryConfig): {
    isValid: boolean;
    errors: string[];
};
//# sourceMappingURL=factory-integration.d.ts.map