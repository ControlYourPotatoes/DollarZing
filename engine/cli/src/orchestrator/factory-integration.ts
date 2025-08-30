// Factory Pattern Integration for Dataset Orchestrator
// Provides parameter isolation and configurable factory selection for orchestrator runs

import { 
  VirtualDollarFactory, 
  GameSessionFactory, 
  PerformanceConfig,
  FactorySelector,
  DEFAULT_PERFORMANCE_CONFIG,
  PRODUCTION_PERFORMANCE_CONFIG
} from '../types/factory-interfaces';
import { PooledVirtualDollarFactory, PooledGameSessionFactory } from '../types/pooled-factories';
import type { 
  ParameterCombination, 
  OrchestratorConfig 
} from './types';

/**
 * Factory configuration specific to orchestrator requirements
 */
export interface OrchestratorFactoryConfig extends PerformanceConfig {
  // Orchestrator-specific settings
  isolateParameterRuns: boolean;      // Whether to reset factories between parameter combinations
  enableCrossRunPooling: boolean;     // Whether to share pools across different parameter runs
  maxConcurrentRuns: number;          // Maximum concurrent simulation runs (affects pool sizing)
  
  // Memory management
  forceCleanupBetweenRuns: boolean;   // Force garbage collection between runs
  poolResetThreshold: number;         // Reset pools after N runs to prevent memory leaks
}

/**
 * Factory instance tracker for parameter isolation
 */
interface FactoryInstance {
  combination: ParameterCombination;
  virtualDollarFactory: VirtualDollarFactory;
  gameSessionFactory: GameSessionFactory;
  creationTime: Date;
  runCount: number;
}

/**
 * Configuration profiles for different orchestrator scenarios
 */
export const ORCHESTRATOR_CONFIGS = {
  // Fast testing configuration - minimal pooling for quick test runs
  testing: {
    ...DEFAULT_PERFORMANCE_CONFIG,
    enableObjectPooling: false,
    isolateParameterRuns: false,
    enableCrossRunPooling: false,
    maxConcurrentRuns: 1,
    forceCleanupBetweenRuns: false,
    poolResetThreshold: Infinity,
    poolSizes: {
      virtualDollar: 100,
      gameSession: 100
    }
  } as OrchestratorFactoryConfig,

  // Development configuration - balanced performance with debugging capabilities
  development: {
    ...DEFAULT_PERFORMANCE_CONFIG,
    enableObjectPooling: true,
    isolateParameterRuns: true,
    enableCrossRunPooling: false,
    maxConcurrentRuns: 2,
    forceCleanupBetweenRuns: true,
    poolResetThreshold: 5,
    poolSizes: {
      virtualDollar: 1000,
      gameSession: 1000
    }
  } as OrchestratorFactoryConfig,

  // Production configuration - maximum performance for dataset generation
  production: {
    ...PRODUCTION_PERFORMANCE_CONFIG,
    enableObjectPooling: true,
    isolateParameterRuns: true,
    enableCrossRunPooling: true,
    maxConcurrentRuns: 1, // Sequential for deterministic results
    forceCleanupBetweenRuns: false,
    poolResetThreshold: 10,
    poolSizes: {
      virtualDollar: 50000, // Large pools for 1-year simulations
      gameSession: 50000
    }
  } as OrchestratorFactoryConfig
};

/**
 * OrchestratorFactoryManager - Manages factory instances with parameter isolation
 * Ensures each parameter combination gets isolated factory instances if configured
 */
export class OrchestratorFactoryManager {
  private config: OrchestratorFactoryConfig;
  private factoryInstances = new Map<string, FactoryInstance>();
  private runCounter = 0;

  constructor(config: OrchestratorFactoryConfig = ORCHESTRATOR_CONFIGS.development) {
    this.config = config;
  }

  /**
   * Get factory instances for a specific parameter combination
   * Creates isolated instances if parameter isolation is enabled
   */
  getFactories(combination: ParameterCombination): {
    virtualDollarFactory: VirtualDollarFactory;
    gameSessionFactory: GameSessionFactory;
  } {
    const key = this.createParameterKey(combination);
    
    if (this.config.isolateParameterRuns) {
      // Get or create isolated factory instance for this parameter combination
      let instance = this.factoryInstances.get(key);
      
      if (!instance) {
        instance = this.createFactoryInstance(combination);
        this.factoryInstances.set(key, instance);
      } else {
        instance.runCount++;
        
        // Check if we should reset factories due to run threshold
        if (instance.runCount >= this.config.poolResetThreshold) {
          this.resetFactoryInstance(key);
          instance = this.createFactoryInstance(combination);
          this.factoryInstances.set(key, instance);
        }
      }

      return {
        virtualDollarFactory: instance.virtualDollarFactory,
        gameSessionFactory: instance.gameSessionFactory
      };
    } else {
      // Use shared factory instances across all parameter combinations
      if (!this.factoryInstances.has('shared')) {
        const sharedInstance = this.createFactoryInstance(combination);
        this.factoryInstances.set('shared', sharedInstance);
      }
      
      const sharedInstance = this.factoryInstances.get('shared')!;
      sharedInstance.runCount++;
      
      return {
        virtualDollarFactory: sharedInstance.virtualDollarFactory,
        gameSessionFactory: sharedInstance.gameSessionFactory
      };
    }
  }

  /**
   * Create a new factory instance for the given parameter combination
   */
  private createFactoryInstance(combination: ParameterCombination): FactoryInstance {
    // Adjust config based on parameter combination if needed
    const adjustedConfig = this.adjustConfigForParameters(combination);
    
    const virtualDollarFactory = new PooledVirtualDollarFactory(adjustedConfig);
    const gameSessionFactory = new PooledGameSessionFactory(adjustedConfig);

    return {
      combination,
      virtualDollarFactory,
      gameSessionFactory,
      creationTime: new Date(),
      runCount: 1
    };
  }

  /**
   * Adjust factory configuration based on parameter combination
   * Different parameters might require different optimization strategies
   */
  private adjustConfigForParameters(combination: ParameterCombination): PerformanceConfig {
    const baseConfig = { ...this.config };
    
    // High growth rate simulations might need larger pools
    if (combination.growthRate === 60) {
      baseConfig.poolSizes = {
        virtualDollar: Math.round(baseConfig.poolSizes.virtualDollar * 1.5),
        gameSession: Math.round(baseConfig.poolSizes.gameSession * 1.5)
      };
    }
    
    // High-risk simulations might create more game sessions
    if (combination.riskLevel === 'high') {
      baseConfig.poolSizes.gameSession = Math.round(baseConfig.poolSizes.gameSession * 1.2);
    }
    
    return baseConfig;
  }

  /**
   * Create a unique key for parameter combinations
   */
  private createParameterKey(combination: ParameterCombination): string {
    return `${combination.growthRate}-${combination.riskLevel}-${combination.charityPercentage}`;
  }

  /**
   * Reset a specific factory instance (cleanup pools and statistics)
   */
  private resetFactoryInstance(key: string): void {
    const instance = this.factoryInstances.get(key);
    if (!instance) return;

    // Reset factory statistics if available
    if ('resetStatistics' in instance.virtualDollarFactory) {
      (instance.virtualDollarFactory as any).resetStatistics();
    }
    if ('resetStatistics' in instance.gameSessionFactory) {
      (instance.gameSessionFactory as any).resetStatistics();
    }

    this.factoryInstances.delete(key);

    // Force cleanup if configured
    if (this.config.forceCleanupBetweenRuns) {
      this.forceGarbageCollection();
    }
  }

  /**
   * Reset all factory instances (useful between orchestrator runs)
   */
  resetAllFactories(): void {
    const keys = Array.from(this.factoryInstances.keys());
    keys.forEach(key => this.resetFactoryInstance(key));
    this.runCounter = 0;
  }

  /**
   * Get statistics for all active factory instances
   */
  getAllFactoryStatistics(): Record<string, {
    combination: ParameterCombination;
    virtualDollarStats: any;
    gameSessionStats: any;
    runCount: number;
    age: number;
  }> {
    const stats: Record<string, any> = {};
    
    this.factoryInstances.forEach((instance, key) => {
      const age = Date.now() - instance.creationTime.getTime();
      
      stats[key] = {
        combination: instance.combination,
        virtualDollarStats: instance.virtualDollarFactory.getStatistics(),
        gameSessionStats: instance.gameSessionFactory.getStatistics(),
        runCount: instance.runCount,
        age
      };
    });
    
    return stats;
  }

  /**
   * Get memory usage estimation for all factories
   */
  getMemoryUsageEstimate(): {
    totalMemoryMB: number;
    factoryCount: number;
    breakdown: Record<string, number>;
  } {
    let totalMemory = 0;
    const breakdown: Record<string, number> = {};
    
    this.factoryInstances.forEach((instance, key) => {
      const vdStats = instance.virtualDollarFactory.getStatistics();
      const gsStats = instance.gameSessionFactory.getStatistics();
      const instanceMemory = vdStats.memoryUsageMB + gsStats.memoryUsageMB;
      
      breakdown[key] = instanceMemory;
      totalMemory += instanceMemory;
    });
    
    return {
      totalMemoryMB: totalMemory,
      factoryCount: this.factoryInstances.size,
      breakdown
    };
  }

  /**
   * Update configuration (causes reset of all factories)
   */
  updateConfig(newConfig: Partial<OrchestratorFactoryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.resetAllFactories();
  }

  /**
   * Get current configuration
   */
  getConfig(): OrchestratorFactoryConfig {
    return { ...this.config };
  }

  /**
   * Force garbage collection if available (Node.js environment)
   */
  private forceGarbageCollection(): void {
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }
  }

  /**
   * Cleanup resources before destruction
   */
  destroy(): void {
    this.resetAllFactories();
  }
}

/**
 * Factory selector implementation for orchestrator use
 */
export class OrchestratorFactorySelector implements FactorySelector {
  private config: OrchestratorFactoryConfig;

  constructor(config: OrchestratorFactoryConfig = ORCHESTRATOR_CONFIGS.development) {
    this.config = config;
  }

  selectVirtualDollarFactory(config: PerformanceConfig): VirtualDollarFactory {
    return new PooledVirtualDollarFactory(config);
  }

  selectGameSessionFactory(config: PerformanceConfig): GameSessionFactory {
    return new PooledGameSessionFactory(config);
  }
}

/**
 * Utility function to create factory manager with preset configurations
 */
export function createOrchestratorFactoryManager(
  preset: 'testing' | 'development' | 'production' = 'development'
): OrchestratorFactoryManager {
  return new OrchestratorFactoryManager(ORCHESTRATOR_CONFIGS[preset]);
}

/**
 * Utility function to validate factory configuration
 */
export function validateFactoryConfig(config: OrchestratorFactoryConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.maxConcurrentRuns < 1) {
    errors.push('maxConcurrentRuns must be at least 1');
  }

  if (config.poolResetThreshold < 1) {
    errors.push('poolResetThreshold must be at least 1');
  }

  if (config.poolSizes.virtualDollar < 10) {
    errors.push('virtualDollar pool size must be at least 10');
  }

  if (config.poolSizes.gameSession < 10) {
    errors.push('gameSession pool size must be at least 10');
  }

  // Check for conflicting settings
  if (!config.enableObjectPooling && config.isolateParameterRuns) {
    errors.push('isolateParameterRuns requires enableObjectPooling to be true');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}