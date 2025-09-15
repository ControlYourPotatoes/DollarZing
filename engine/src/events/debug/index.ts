/**
 * Event Debugging Infrastructure
 *
 * Comprehensive debugging tools for the event-driven simulation architecture
 * including event tracing, logging, flow visualization, and performance monitoring.
 */

// Import for internal use
import {
  EventDebugInterface,
  type DebugInterfaceConfig,
} from "./debug-interface";

// Main debugging interface
export { EventDebugInterface } from "./debug-interface";
export type {
  DebugInterfaceConfig,
  DebugSession,
  DebugReport,
} from "./debug-interface";

// Event debugger
export { EventDebugger } from "./event-debugger";
export type {
  EventTrace,
  EventMetrics,
  DebuggerConfig,
} from "./event-debugger";

// Event logger
export { EventLogger } from "./event-logger";
export type { LogLevel, LogEntry, LoggerConfig } from "./event-logger";

// Flow visualization
export { EventFlowVisualizer } from "./event-flow-visualizer";
export type {
  FlowNode,
  FlowVisualization,
  FlowAnalysis,
} from "./event-flow-visualizer";

// Performance monitoring
export { PerformanceMonitor } from "./performance-monitor";
export type {
  PerformanceMetric,
  PerformanceSnapshot,
  PerformanceAlert,
  MonitorConfig,
} from "./performance-monitor";

/**
 * Factory function to create a preconfigured debugging interface
 */
export function createDebugInterface(
  config?: Partial<DebugInterfaceConfig>
): EventDebugInterface {
  return new EventDebugInterface(config);
}

/**
 * Quick setup function for development debugging
 */
export function setupDevelopmentDebugging(eventBus: any): EventDebugInterface {
  const debugInterface = new EventDebugInterface({
    debugger: {
      enabled: true,
      logLevel: "debug",
      enablePerformanceTracking: true,
      enableEventFlowVisualization: true,
    },
    logger: {
      enabled: true,
      level: "debug",
      colorized: true,
    },
    performanceMonitor: {
      enabled: true,
      enableLatencyMonitoring: true,
      enableThroughputMonitoring: true,
      enableMemoryMonitoring: true,
    },
    autoStartMonitoring: true,
  });

  debugInterface.attachToEventBus(eventBus);

  // Start a default development session
  debugInterface.startSession("Development Session");

  console.log("🔍 Event debugging enabled for development");
  console.log("📊 Performance monitoring active");
  console.log("📝 Event logging at debug level");

  return debugInterface;
}

/**
 * Quick setup function for production monitoring
 */
export function setupProductionMonitoring(eventBus: any): EventDebugInterface {
  const debugInterface = new EventDebugInterface({
    debugger: {
      enabled: true,
      logLevel: "warn",
      enablePerformanceTracking: true,
      enableEventFlowVisualization: false,
    },
    logger: {
      enabled: true,
      level: "warn",
      colorized: false,
    },
    performanceMonitor: {
      enabled: true,
      enableLatencyMonitoring: true,
      enableThroughputMonitoring: true,
      enableMemoryMonitoring: true,
      alertThresholds: {
        avgLatency: { warning: 200, critical: 1000 },
        throughput: { warning: 5, critical: 1 },
        memoryUsage: {
          warning: 200 * 1024 * 1024,
          critical: 1000 * 1024 * 1024,
        },
        eventQueueSize: { warning: 2000, critical: 10000 },
        errorRate: { warning: 2, critical: 10 },
      },
    },
    autoStartMonitoring: true,
    reportInterval: 300000, // 5 minutes
  });

  debugInterface.attachToEventBus(eventBus);

  // Start a production monitoring session
  debugInterface.startSession("Production Monitoring");

  console.log("📊 Production event monitoring enabled");

  return debugInterface;
}

/**
 * Utility function to generate a quick performance report
 */
export function generateQuickReport(debugInterface: EventDebugInterface): void {
  // Check if there's an active session first
  const stats = debugInterface.getStats();
  if (stats.totalSessions === 0) {
    console.log("\n=== QUICK PERFORMANCE REPORT ===");
    console.log("No debugging sessions available. Start a session first.");
    return;
  }

  // Try to get the most recent session or generate with current session
  try {
    const report = debugInterface.generateReport();
    console.log("\n=== QUICK PERFORMANCE REPORT ===");
    console.log(`Duration: ${report.summary.duration}ms`);
    console.log(`Events: ${report.summary.totalEvents}`);
    console.log(`Errors: ${report.summary.errorCount}`);
    console.log(`Avg Latency: ${report.summary.avgLatency.toFixed(2)}ms`);
    console.log(
      `Peak Throughput: ${report.summary.peakThroughput.toFixed(2)} events/sec`
    );

    if (report.sections.recommendations.length > 0) {
      console.log("\nRecommendations:");
      report.sections.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }
  } catch (error) {
    console.log("\n=== QUICK PERFORMANCE REPORT ===");
    console.log(
      "No active session. Start a debugging session to see performance data."
    );
  }
}

/**
 * Utility to check system health
 */
export function checkSystemHealth(debugInterface: EventDebugInterface): {
  status: "healthy" | "warning" | "critical";
  issues: string[];
  recommendations: string[];
} {
  const dashboardData = debugInterface.getDashboardData();
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check for critical alerts
  const criticalAlerts = dashboardData.activeAlerts.filter(
    (a: any) => a.level === "critical"
  );
  const warningAlerts = dashboardData.activeAlerts.filter(
    (a: any) => a.level === "warning"
  );

  if (criticalAlerts.length > 0) {
    issues.push(`${criticalAlerts.length} critical performance alerts active`);
    recommendations.push("Address critical performance issues immediately");
  }

  if (warningAlerts.length > 0) {
    issues.push(`${warningAlerts.length} warning alerts active`);
    recommendations.push("Monitor warning conditions closely");
  }

  // Check recent event error rate
  const recentErrors = dashboardData.recentEvents.filter(
    (e) => e.status === "failed"
  ).length;
  const errorRate =
    dashboardData.recentEvents.length > 0
      ? (recentErrors / dashboardData.recentEvents.length) * 100
      : 0;

  if (errorRate > 15) {
    issues.push(`High error rate: ${errorRate.toFixed(1)}%`);
    recommendations.push("Investigate event handler errors");
  }

  return {
    status: dashboardData.systemStatus,
    issues,
    recommendations,
  };
}
