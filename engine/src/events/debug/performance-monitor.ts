export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  category: "latency" | "throughput" | "memory" | "cpu" | "custom";
  tags?: Record<string, string>;
}

export interface PerformanceSnapshot {
  timestamp: number;
  metrics: PerformanceMetric[];
  summary: {
    avgLatency: number;
    throughput: number;
    memoryUsage: number;
    eventQueueSize: number;
    errorRate: number;
  };
}

export interface PerformanceAlert {
  id: string;
  timestamp: number;
  level: "info" | "warning" | "critical";
  metric: string;
  message: string;
  currentValue: number;
  threshold: number;
  suggestion?: string;
}

export interface MonitorConfig {
  enabled: boolean;
  samplingInterval: number;
  retentionPeriod: number;
  alertThresholds: Record<string, { warning: number; critical: number }>;
  enableMemoryMonitoring: boolean;
  enableLatencyMonitoring: boolean;
  enableThroughputMonitoring: boolean;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private snapshots: PerformanceSnapshot[] = [];
  private alerts: PerformanceAlert[] = [];
  private config: MonitorConfig;
  private eventCounts: Map<string, number> = new Map();
  private latencies: Map<string, number[]> = new Map();
  private startTimes: Map<string, number> = new Map();
  private intervalId: NodeJS.Timeout | undefined;

  constructor(config: Partial<MonitorConfig> = {}) {
    this.config = {
      enabled: true,
      samplingInterval: 5000, // 5 seconds
      retentionPeriod: 300000, // 5 minutes
      alertThresholds: {
        avgLatency: { warning: 100, critical: 500 },
        throughput: { warning: 10, critical: 5 },
        memoryUsage: {
          warning: 100 * 1024 * 1024,
          critical: 500 * 1024 * 1024,
        }, // MB
        eventQueueSize: { warning: 1000, critical: 5000 },
        errorRate: { warning: 5, critical: 15 }, // percentage
      },
      enableMemoryMonitoring: true,
      enableLatencyMonitoring: true,
      enableThroughputMonitoring: true,
      ...config,
    };

    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.collectSnapshot();
      this.cleanupOldData();
      this.checkAlerts();
    }, this.config.samplingInterval);
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Record event start for latency measurement
   */
  recordEventStart(eventType: string, eventId: string): void {
    if (!this.config.enableLatencyMonitoring) return;
    this.startTimes.set(`${eventType}:${eventId}`, Date.now());
  }

  /**
   * Record event completion for latency measurement
   */
  recordEventEnd(eventType: string, eventId: string, error?: Error): void {
    if (!this.config.enableLatencyMonitoring) return;

    const startKey = `${eventType}:${eventId}`;
    const startTime = this.startTimes.get(startKey);

    if (startTime) {
      const latency = Date.now() - startTime;
      this.recordLatency(eventType, latency);
      this.startTimes.delete(startKey);
    }

    // Count event completion
    if (this.config.enableThroughputMonitoring) {
      this.eventCounts.set(
        eventType,
        (this.eventCounts.get(eventType) || 0) + 1
      );
    }

    // Record error if present
    if (error) {
      this.recordMetric({
        name: "event_error",
        value: 1,
        unit: "count",
        category: "custom",
        tags: { eventType, error: error.message },
      });
    }
  }

  /**
   * Record custom metric
   */
  recordMetric(metric: Omit<PerformanceMetric, "id" | "timestamp">): void {
    const fullMetric: PerformanceMetric = {
      id: this.generateMetricId(),
      timestamp: Date.now(),
      ...metric,
    };

    this.metrics.push(fullMetric);
  }

  /**
   * Record latency for an event type
   */
  private recordLatency(eventType: string, latency: number): void {
    if (!this.latencies.has(eventType)) {
      this.latencies.set(eventType, []);
    }

    const latencies = this.latencies.get(eventType)!;
    latencies.push(latency);

    // Keep only recent latencies (last 100)
    if (latencies.length > 100) {
      latencies.shift();
    }

    // Record as metric
    this.recordMetric({
      name: "event_latency",
      value: latency,
      unit: "ms",
      category: "latency",
      tags: { eventType },
    });
  }

  /**
   * Collect performance snapshot
   */
  private collectSnapshot(): void {
    const timestamp = Date.now();
    const metrics = this.collectCurrentMetrics();
    const summary = this.calculateSummary(metrics);

    const snapshot: PerformanceSnapshot = {
      timestamp,
      metrics,
      summary,
    };

    this.snapshots.push(snapshot);
  }

  /**
   * Collect current metrics
   */
  private collectCurrentMetrics(): PerformanceMetric[] {
    const currentMetrics: PerformanceMetric[] = [];

    // Memory metrics
    if (
      this.config.enableMemoryMonitoring &&
      typeof process !== "undefined" &&
      process.memoryUsage
    ) {
      const memUsage = process.memoryUsage();
      currentMetrics.push({
        id: this.generateMetricId(),
        name: "memory_heap_used",
        value: memUsage.heapUsed,
        unit: "bytes",
        category: "memory",
        timestamp: Date.now(),
      });

      currentMetrics.push({
        id: this.generateMetricId(),
        name: "memory_heap_total",
        value: memUsage.heapTotal,
        unit: "bytes",
        category: "memory",
        timestamp: Date.now(),
      });
    }

    // Latency metrics
    if (this.config.enableLatencyMonitoring) {
      this.latencies.forEach((latencies, eventType) => {
        if (latencies.length > 0) {
          const avgLatency =
            latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
          const maxLatency = Math.max(...latencies);
          const minLatency = Math.min(...latencies);

          currentMetrics.push(
            {
              id: this.generateMetricId(),
              name: "avg_latency",
              value: avgLatency,
              unit: "ms",
              category: "latency",
              tags: { eventType },
              timestamp: Date.now(),
            },
            {
              id: this.generateMetricId(),
              name: "max_latency",
              value: maxLatency,
              unit: "ms",
              category: "latency",
              tags: { eventType },
              timestamp: Date.now(),
            },
            {
              id: this.generateMetricId(),
              name: "min_latency",
              value: minLatency,
              unit: "ms",
              category: "latency",
              tags: { eventType },
              timestamp: Date.now(),
            }
          );
        }
      });
    }

    // Throughput metrics
    if (this.config.enableThroughputMonitoring) {
      const timePeriod = this.config.samplingInterval / 1000; // seconds
      this.eventCounts.forEach((count, eventType) => {
        const throughput = count / timePeriod;
        currentMetrics.push({
          id: this.generateMetricId(),
          name: "event_throughput",
          value: throughput,
          unit: "events/sec",
          category: "throughput",
          tags: { eventType },
          timestamp: Date.now(),
        });
      });

      // Reset counters for next period
      this.eventCounts.clear();
    }

    // Event queue size (if available)
    currentMetrics.push({
      id: this.generateMetricId(),
      name: "pending_events",
      value: this.startTimes.size,
      unit: "count",
      category: "custom",
      timestamp: Date.now(),
    });

    return currentMetrics;
  }

  /**
   * Calculate performance summary
   */
  private calculateSummary(
    metrics: PerformanceMetric[]
  ): PerformanceSnapshot["summary"] {
    const latencyMetrics = metrics.filter((m) => m.name === "avg_latency");
    const throughputMetrics = metrics.filter(
      (m) => m.name === "event_throughput"
    );
    const memoryMetrics = metrics.filter((m) => m.name === "memory_heap_used");
    const queueMetrics = metrics.filter((m) => m.name === "pending_events");

    const avgLatency =
      latencyMetrics.length > 0
        ? latencyMetrics.reduce((sum, m) => sum + m.value, 0) /
          latencyMetrics.length
        : 0;

    const throughput =
      throughputMetrics.length > 0
        ? throughputMetrics.reduce((sum, m) => sum + m.value, 0)
        : 0;

    const memoryUsage = memoryMetrics.length > 0 ? memoryMetrics[0].value : 0;

    const eventQueueSize = queueMetrics.length > 0 ? queueMetrics[0].value : 0;

    // Calculate error rate from recent alerts
    const recentErrors = this.alerts.filter(
      (a) =>
        Date.now() - a.timestamp < this.config.samplingInterval &&
        a.metric === "event_error"
    ).length;

    const recentEvents = throughputMetrics.reduce((sum, m) => sum + m.value, 0);
    const errorRate =
      recentEvents > 0 ? (recentErrors / recentEvents) * 100 : 0;

    return {
      avgLatency,
      throughput,
      memoryUsage,
      eventQueueSize,
      errorRate,
    };
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(): void {
    const latestSnapshot = this.snapshots[this.snapshots.length - 1];
    if (!latestSnapshot) return;

    const { summary } = latestSnapshot;

    // Check each threshold
    Object.entries(this.config.alertThresholds).forEach(
      ([metric, thresholds]) => {
        const value = (summary as any)[metric];
        if (value === undefined) return;

        let level: PerformanceAlert["level"] | null = null;
        let threshold = 0;

        if (value >= thresholds.critical) {
          level = "critical";
          threshold = thresholds.critical;
        } else if (value >= thresholds.warning) {
          level = "warning";
          threshold = thresholds.warning;
        }

        if (level) {
          this.createAlert(level, metric, value, threshold);
        }
      }
    );
  }

  /**
   * Create performance alert
   */
  private createAlert(
    level: PerformanceAlert["level"],
    metric: string,
    value: number,
    threshold: number
  ): void {
    // Don't create duplicate alerts within a short time period
    const recentAlert = this.alerts.find(
      (a) =>
        a.metric === metric &&
        a.level === level &&
        Date.now() - a.timestamp < 30000 // 30 seconds
    );

    if (recentAlert) return;

    const suggestions: Record<string, string> = {
      avgLatency:
        "Consider optimizing event handlers or introducing async processing",
      throughput:
        "Event processing rate is low. Check for bottlenecks in handlers",
      memoryUsage:
        "Memory usage is high. Consider implementing object pooling or cleanup",
      eventQueueSize:
        "Event queue is growing. Consider increasing processing capacity",
      errorRate:
        "High error rate detected. Check event handler implementations",
    };

    const alert: PerformanceAlert = {
      id: this.generateAlertId(),
      timestamp: Date.now(),
      level,
      metric,
      message: `${metric} exceeded ${level} threshold: ${value.toFixed(
        2
      )} >= ${threshold}`,
      currentValue: value,
      threshold,
      suggestion: suggestions[metric],
    };

    this.alerts.push(alert);
  }

  /**
   * Get current performance metrics
   */
  getMetrics(filter?: {
    category?: PerformanceMetric["category"];
    name?: string;
    timeRange?: { start: number; end: number };
    limit?: number;
  }): PerformanceMetric[] {
    let filteredMetrics = [...this.metrics];

    if (filter) {
      if (filter.category) {
        filteredMetrics = filteredMetrics.filter(
          (m) => m.category === filter.category
        );
      }

      if (filter.name) {
        filteredMetrics = filteredMetrics.filter((m) => m.name === filter.name);
      }

      if (filter.timeRange) {
        filteredMetrics = filteredMetrics.filter(
          (m) =>
            m.timestamp >= filter.timeRange!.start &&
            m.timestamp <= filter.timeRange!.end
        );
      }

      if (filter.limit && filter.limit > 0) {
        filteredMetrics = filteredMetrics.slice(-filter.limit);
      }
    }

    return filteredMetrics.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get performance snapshots
   */
  getSnapshots(limit?: number): PerformanceSnapshot[] {
    const snapshots = [...this.snapshots].sort(
      (a, b) => b.timestamp - a.timestamp
    );
    return limit ? snapshots.slice(0, limit) : snapshots;
  }

  /**
   * Get active alerts
   */
  getAlerts(level?: PerformanceAlert["level"]): PerformanceAlert[] {
    let alerts = [...this.alerts].sort((a, b) => b.timestamp - a.timestamp);

    if (level) {
      alerts = alerts.filter((a) => a.level === level);
    }

    return alerts;
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const latestSnapshot = this.snapshots[this.snapshots.length - 1];
    if (!latestSnapshot) {
      return "No performance data available";
    }

    const { summary } = latestSnapshot;
    const activeAlerts = this.getAlerts();

    let report = "\n=== PERFORMANCE REPORT ===\n";
    report += `Generated: ${new Date().toISOString()}\n\n`;

    report += "--- Current Metrics ---\n";
    report += `Average Latency: ${summary.avgLatency.toFixed(2)}ms\n`;
    report += `Throughput: ${summary.throughput.toFixed(2)} events/sec\n`;
    report += `Memory Usage: ${(summary.memoryUsage / 1024 / 1024).toFixed(
      2
    )}MB\n`;
    report += `Event Queue Size: ${summary.eventQueueSize}\n`;
    report += `Error Rate: ${summary.errorRate.toFixed(2)}%\n\n`;

    // Alerts section
    if (activeAlerts.length > 0) {
      report += "--- Active Alerts ---\n";
      activeAlerts.slice(0, 5).forEach((alert, index) => {
        const icon =
          alert.level === "critical"
            ? "🚨"
            : alert.level === "warning"
            ? "⚠️"
            : "ℹ️";
        report += `${index + 1}. ${icon} ${alert.message}\n`;
        if (alert.suggestion) {
          report += `   💡 ${alert.suggestion}\n`;
        }
      });
      report += "\n";
    } else {
      report += "--- No Active Alerts ---\n\n";
    }

    // Trends section
    if (this.snapshots.length > 1) {
      const previousSnapshot = this.snapshots[this.snapshots.length - 2];
      const latencyTrend =
        summary.avgLatency - previousSnapshot.summary.avgLatency;
      const throughputTrend =
        summary.throughput - previousSnapshot.summary.throughput;

      report += "--- Trends (vs previous snapshot) ---\n";
      report += `Latency: ${latencyTrend >= 0 ? "+" : ""}${latencyTrend.toFixed(
        2
      )}ms\n`;
      report += `Throughput: ${
        throughputTrend >= 0 ? "+" : ""
      }${throughputTrend.toFixed(2)} events/sec\n`;
    }

    return report;
  }

  /**
   * Clear all performance data
   */
  clearData(): void {
    this.metrics = [];
    this.snapshots = [];
    this.alerts = [];
    this.eventCounts.clear();
    this.latencies.clear();
    this.startTimes.clear();
  }

  /**
   * Clean up old data based on retention period
   */
  private cleanupOldData(): void {
    const cutoffTime = Date.now() - this.config.retentionPeriod;

    this.metrics = this.metrics.filter((m) => m.timestamp >= cutoffTime);
    this.snapshots = this.snapshots.filter((s) => s.timestamp >= cutoffTime);
    this.alerts = this.alerts.filter((a) => a.timestamp >= cutoffTime);
  }

  /**
   * Generate unique metric ID
   */
  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update monitor configuration
   */
  updateConfig(newConfig: Partial<MonitorConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart monitoring with new config
    if (this.config.enabled && !this.intervalId) {
      this.startMonitoring();
    } else if (!this.config.enabled && this.intervalId) {
      this.stopMonitoring();
    }
  }

  /**
   * Destroy monitor and cleanup
   */
  destroy(): void {
    this.stopMonitoring();
    this.clearData();
  }
}
