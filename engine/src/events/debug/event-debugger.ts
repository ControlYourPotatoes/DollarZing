import { EventBus, EventHandler } from "../event-bus";
import { EVENT_TYPES, type SimulationEvent } from "../event-types";
import { deepClone } from "../../utils/deep-clone";

export interface EventTrace {
  id: string;
  eventType: string;
  timestamp: number;
  duration?: number;
  data: any;
  source?: string;
  correlationId?: string;
  parentEventId?: string;
  children: string[];
  status: "pending" | "processing" | "completed" | "failed";
  error?: Error;
}

export interface EventMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  averageProcessingTime: Record<string, number>;
  errors: Record<string, number>;
  eventFlow: EventTrace[];
  performanceStats: {
    slowestEvents: Array<{
      eventType: string;
      duration: number;
      timestamp: number;
    }>;
    fastestEvents: Array<{
      eventType: string;
      duration: number;
      timestamp: number;
    }>;
    errorRate: number;
    throughput: number;
  };
}

export interface DebuggerConfig {
  enabled: boolean;
  maxTraces: number;
  includeData: boolean;
  filterEvents?: string[];
  logLevel: "none" | "error" | "warn" | "info" | "debug";
  enablePerformanceTracking: boolean;
  enableEventFlowVisualization: boolean;
}

export class EventDebugger {
  private traces: Map<string, EventTrace> = new Map();
  private eventMetrics: EventMetrics;
  private config: DebuggerConfig;
  private eventBus: EventBus | undefined;
  private listeners: Map<string, EventHandler> = new Map();
  private sessionId: string;

  constructor(config: Partial<DebuggerConfig> = {}) {
    this.sessionId = `debug_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    this.config = {
      enabled: true,
      maxTraces: 1000,
      includeData: true,
      logLevel: "info",
      enablePerformanceTracking: true,
      enableEventFlowVisualization: true,
      ...config,
    };

    this.eventMetrics = {
      totalEvents: 0,
      eventsByType: {},
      averageProcessingTime: {},
      errors: {},
      eventFlow: [],
      performanceStats: {
        slowestEvents: [],
        fastestEvents: [],
        errorRate: 0,
        throughput: 0,
      },
    };
  }

  /**
   * Attach debugger to an EventBus instance
   */
  attachToEventBus(eventBus: EventBus): void {
    if (!this.config.enabled) return;

    this.eventBus = eventBus;
    this.log(
      "info",
      `EventDebugger attached to EventBus (Session: ${this.sessionId})`
    );

    // Listen to all event types for debugging
    Object.values(EVENT_TYPES).forEach((eventType) => {
      if (this.shouldTraceEvent(eventType)) {
        const listener = this.createEventListener(eventType);
        eventBus.on(eventType, listener);
        this.listeners.set(eventType, listener);
      }
    });

    this.log("info", `Monitoring ${this.listeners.size} event types`);
  }

  /**
   * Detach debugger from EventBus
   */
  detach(): void {
    if (!this.eventBus) return;

    this.listeners.forEach((listener, eventType) => {
      this.eventBus!.off(eventType, listener);
    });

    this.listeners.clear();
    this.eventBus = undefined;
    this.log("info", "EventDebugger detached");
  }

  /**
   * Create event listener for tracing
   */
  private createEventListener(eventType: string): EventHandler {
    return (data: SimulationEvent) => {
      const traceId = this.generateTraceId();
      const timestamp = Date.now();

      const trace: EventTrace = {
        id: traceId,
        eventType,
        timestamp,
        data: this.config.includeData ? this.sanitizeData(data) : {},
        correlationId: (data as any).correlationId || this.sessionId,
        source: (data as any).source || "unknown",
        children: [],
        status: "pending",
      };

      this.addTrace(trace);
      this.updateMetrics(eventType, trace);
      this.log("debug", `Event traced: ${eventType}`, { traceId, data });

      // Mark as processing and measure performance
      if (this.config.enablePerformanceTracking) {
        setTimeout(() => {
          this.markEventProcessed(traceId);
        }, 0);
      }
    };
  }

  /**
   * Add event trace to collection
   */
  private addTrace(trace: EventTrace): void {
    // Maintain max traces limit
    if (this.traces.size >= this.config.maxTraces) {
      const oldestTrace = Array.from(this.traces.values()).sort(
        (a, b) => a.timestamp - b.timestamp
      )[0];
      if (oldestTrace) {
        this.traces.delete(oldestTrace.id);
      }
    }

    this.traces.set(trace.id, trace);
    this.eventMetrics.eventFlow.push(trace);

    // Maintain event flow size
    if (this.eventMetrics.eventFlow.length > this.config.maxTraces) {
      this.eventMetrics.eventFlow.shift();
    }
  }

  /**
   * Mark event as processed and calculate duration
   */
  private markEventProcessed(traceId: string, error?: Error): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.status = error ? "failed" : "completed";
    trace.duration = Date.now() - trace.timestamp;
    if (error) {
      trace.error = error;
    }

    if (this.config.enablePerformanceTracking) {
      this.updatePerformanceStats(trace);
    }

    this.log("debug", `Event processed: ${trace.eventType}`, {
      traceId,
      duration: trace.duration,
      status: trace.status,
    });
  }

  /**
   * Update performance statistics
   */
  private updatePerformanceStats(trace: EventTrace): void {
    const stats = this.eventMetrics.performanceStats;

    if (trace.duration !== undefined) {
      // Update slowest events
      stats.slowestEvents.push({
        eventType: trace.eventType,
        duration: trace.duration,
        timestamp: trace.timestamp,
      });
      stats.slowestEvents.sort((a, b) => b.duration - a.duration);
      stats.slowestEvents = stats.slowestEvents.slice(0, 10);

      // Update fastest events
      stats.fastestEvents.push({
        eventType: trace.eventType,
        duration: trace.duration,
        timestamp: trace.timestamp,
      });
      stats.fastestEvents.sort((a, b) => a.duration - b.duration);
      stats.fastestEvents = stats.fastestEvents.slice(0, 10);

      // Update average processing times
      const currentAvg =
        this.eventMetrics.averageProcessingTime[trace.eventType] || 0;
      const count = this.eventMetrics.eventsByType[trace.eventType] || 0;
      this.eventMetrics.averageProcessingTime[trace.eventType] =
        (currentAvg * (count - 1) + trace.duration) / count;
    }

    // Update error rate
    const totalErrors = Object.values(this.eventMetrics.errors).reduce(
      (sum, count) => sum + count,
      0
    );
    stats.errorRate = (totalErrors / this.eventMetrics.totalEvents) * 100;

    // Calculate throughput (events per second)
    const timeWindow = 60000; // 1 minute
    const recentEvents = Array.from(this.traces.values()).filter(
      (t) => Date.now() - t.timestamp < timeWindow
    );
    stats.throughput = recentEvents.length / (timeWindow / 1000);
  }

  /**
   * Update event metrics
   */
  private updateMetrics(eventType: string, trace: EventTrace): void {
    this.eventMetrics.totalEvents++;
    this.eventMetrics.eventsByType[eventType] =
      (this.eventMetrics.eventsByType[eventType] || 0) + 1;

    if (trace.error) {
      this.eventMetrics.errors[eventType] =
        (this.eventMetrics.errors[eventType] || 0) + 1;
    }
  }

  /**
   * Get current debugging metrics
   */
  getMetrics(): EventMetrics {
    return { ...this.eventMetrics };
  }

  /**
   * Get event traces with optional filtering
   */
  getTraces(filter?: {
    eventType?: string;
    status?: EventTrace["status"];
    timeRange?: { start: number; end: number };
    correlationId?: string;
  }): EventTrace[] {
    let traces = Array.from(this.traces.values());

    if (filter) {
      if (filter.eventType) {
        traces = traces.filter((t) => t.eventType === filter.eventType);
      }
      if (filter.status) {
        traces = traces.filter((t) => t.status === filter.status);
      }
      if (filter.timeRange) {
        traces = traces.filter(
          (t) =>
            t.timestamp >= filter.timeRange!.start &&
            t.timestamp <= filter.timeRange!.end
        );
      }
      if (filter.correlationId) {
        traces = traces.filter((t) => t.correlationId === filter.correlationId);
      }
    }

    return traces.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Generate event flow visualization
   */
  generateEventFlowVisualization(): string {
    if (!this.config.enableEventFlowVisualization) {
      return "Event flow visualization is disabled";
    }

    const recentTraces = this.getTraces({
      timeRange: { start: Date.now() - 60000, end: Date.now() },
    }).slice(0, 20);

    let visualization =
      "\n=== EVENT FLOW VISUALIZATION (Last 60 seconds) ===\n";

    recentTraces.forEach((trace, index) => {
      const status =
        trace.status === "completed"
          ? "✅"
          : trace.status === "failed"
          ? "❌"
          : trace.status === "processing"
          ? "⏳"
          : "⏸️";

      const duration = trace.duration ? ` (${trace.duration}ms)` : "";
      const timestamp = new Date(trace.timestamp).toISOString().substr(11, 12);

      visualization += `${index + 1}. [${timestamp}] ${status} ${
        trace.eventType
      }${duration}\n`;

      if (trace.error) {
        visualization += `   ❌ Error: ${trace.error.message}\n`;
      }
    });

    return visualization;
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): string {
    const metrics = this.getMetrics();
    const stats = metrics.performanceStats;

    let report = "\n=== EVENT PERFORMANCE REPORT ===\n";
    report += `Total Events: ${metrics.totalEvents}\n`;
    report += `Error Rate: ${stats.errorRate.toFixed(2)}%\n`;
    report += `Throughput: ${stats.throughput.toFixed(2)} events/sec\n\n`;

    report += "--- Events by Type ---\n";
    Object.entries(metrics.eventsByType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        const avgTime =
          metrics.averageProcessingTime[type]?.toFixed(2) || "N/A";
        report += `${type}: ${count} events (avg: ${avgTime}ms)\n`;
      });

    if (stats.slowestEvents.length > 0) {
      report += "\n--- Slowest Events ---\n";
      stats.slowestEvents.slice(0, 5).forEach((event, index) => {
        report += `${index + 1}. ${event.eventType}: ${event.duration}ms\n`;
      });
    }

    return report;
  }

  /**
   * Clear all traces and reset metrics
   */
  clearTraces(): void {
    this.traces.clear();
    this.eventMetrics = {
      totalEvents: 0,
      eventsByType: {},
      averageProcessingTime: {},
      errors: {},
      eventFlow: [],
      performanceStats: {
        slowestEvents: [],
        fastestEvents: [],
        errorRate: 0,
        throughput: 0,
      },
    };
    this.log("info", "Event traces cleared");
  }

  /**
   * Update debugger configuration
   */
  updateConfig(newConfig: Partial<DebuggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.log("info", "Debugger configuration updated", newConfig);
  }

  /**
   * Check if event should be traced based on filters
   */
  private shouldTraceEvent(eventType: string): boolean {
    if (!this.config.enabled) return false;
    if (this.config.filterEvents && this.config.filterEvents.length > 0) {
      return this.config.filterEvents.includes(eventType);
    }
    return true;
  }

  /**
   * Generate unique trace ID
   */
  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize event data for logging
   */
  private sanitizeData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    try {
      const sanitized = deepClone(data);
      if (sanitized && typeof sanitized === "object") {
        delete (sanitized as Record<string, unknown>).password;
        delete (sanitized as Record<string, unknown>).secret;
        delete (sanitized as Record<string, unknown>).token;
      }
      return sanitized;
    } catch (error) {
      return { error: "Failed to sanitize data" };
    }
  }

  /**
   * Internal logging with level filtering
   */
  private log(
    level: DebuggerConfig["logLevel"],
    message: string,
    data?: any
  ): void {
    const levels = ["none", "error", "warn", "info", "debug"];
    const currentLevel = levels.indexOf(this.config.logLevel);
    const messageLevel = levels.indexOf(level);

    if (currentLevel >= messageLevel && messageLevel > 0) {
      const timestamp = new Date().toISOString();
      const prefix = `[EventDebugger ${timestamp}]`;

      if (data) {
        console.log(`${prefix} ${message}`, data);
      } else {
        console.log(`${prefix} ${message}`);
      }
    }
  }
}
