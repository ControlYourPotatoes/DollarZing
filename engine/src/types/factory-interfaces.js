// Factory Pattern Interfaces for Virtual Dollar and Game Session Creation
// Provides abstraction layer for object creation with dependency injection support
// Enables performance optimization through object pooling while maintaining clean code
/**
 * Default configuration for development and testing environments
 * Provides reasonable defaults for factory configuration
 */
export const DEFAULT_PERFORMANCE_CONFIG = {
    enableObjectPooling: false, // Disabled for development/testing by default
    poolSizes: {
        virtualDollar: 1000,
        gameSession: 1000
    },
    prewarmCounts: {
        virtualDollar: 10,
        gameSession: 10
    },
    enableBatchOptimizations: true,
    enablePerformanceMetrics: true
};
/**
 * Production configuration optimized for performance
 * Enables all optimizations for production workloads
 */
export const PRODUCTION_PERFORMANCE_CONFIG = {
    enableObjectPooling: true, // Enabled for production performance
    poolSizes: {
        virtualDollar: 10000,
        gameSession: 10000
    },
    prewarmCounts: {
        virtualDollar: 100,
        gameSession: 100
    },
    enableBatchOptimizations: true,
    enablePerformanceMetrics: true
};
//# sourceMappingURL=factory-interfaces.js.map