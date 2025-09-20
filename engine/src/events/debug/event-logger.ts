import type { SimulationEvent } from "../event-types";
import { deepClone } from "../../utils/deep-clone";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  eventType: string;
  message: string;
  data: any | undefined;
  correlationId: string | undefined;
  source: string | undefined;
  traceId: string | undefined;
}

export interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  maxEntries: number;
  includeData: boolean;
  timestampFormat: "iso" | "epoch" | "relative";
  colorized: boolean;
  outputTargets: Array<"console" | "memory" | "file">;
}

export class EventLogger {
  private logs: LogEntry[] = [];
  private config: LoggerConfig;
  private startTime: number = Date.now();
  private logColors = {
    debug: "\x1b[36m", // Cyan
    info: "\x1b[32m", // Green
    warn: "\x1b[33m", // Yellow
    error: "\x1b[31m", // Red
    reset: "\x1b[0m", // Reset
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      enabled: true,
      level: "info",
      maxEntries: 1000,
      includeData: true,
      timestampFormat: "iso",
      colorized: true,
      outputTargets: ["console", "memory"],
      ...config,
    };
  }

  /**
   * Log an event with specified level
   */
  log(
    level: LogLevel,
    eventType: string,
    message: string,
    data?: any,
    context?: {
      correlationId?: string;
      source?: string;
      traceId?: string;
    }
  ): void {
    if (!this.config.enabled || !this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      eventType,
      message,
      data: this.config.includeData ? this.sanitizeData(data) : undefined,
      correlationId: context?.correlationId || undefined,
      source: context?.source || undefined,
      traceId: context?.traceId || undefined,
    };

    this.addLogEntry(entry);
    this.output(entry);
  }

  /**
   * Log debug level event
   */
  debug(eventType: string, message: string, data?: any, context?: any): void {
    this.log("debug", eventType, message, data, context);
  }

  /**
   * Log info level event
   */
  info(eventType: string, message: string, data?: any, context?: any): void {
    this.log("info", eventType, message, data, context);
  }

  /**
   * Log warning level event
   */
  warn(eventType: string, message: string, data?: any, context?: any): void {
    this.log("warn", eventType, message, data, context);
  }

  /**
   * Log error level event
   */
  error(
    eventType: string,
    message: string,
    error?: Error | any,
    context?: any
  ): void {
    const errorData =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error;

    this.log("error", eventType, message, errorData, context);
  }

  /**
   * Log event lifecycle (emitted, processed, completed)
   */
  logEventLifecycle(
    phase: "emitted" | "processing" | "completed" | "failed",
    event: SimulationEvent,
    additionalData?: any
  ): void {
    const message = `Event ${phase}: ${event.type || "unknown"}`;
    const level: LogLevel =
      phase === "failed" ? "error" : phase === "processing" ? "debug" : "info";

    this.log(
      level,
      event.type || "unknown",
      message,
      {
        event: event,
        phase,
        ...additionalData,
      },
      {
        correlationId: (event as any).correlationId,
        source: (event as any).source,
        traceId: (event as any).traceId,
      }
    );
  }

  /**
   * Get logs with optional filtering
   */
  getLogs(filter?: {
    level?: LogLevel;
    eventType?: string;
    timeRange?: { start: number; end: number };
    correlationId?: string;
    limit?: number;
  }): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (filter) {
      if (filter.level) {
        const levelIndex = this.getLevelIndex(filter.level);
        filteredLogs = filteredLogs.filter(
          (log) => this.getLevelIndex(log.level) >= levelIndex
        );
      }

      if (filter.eventType) {
        filteredLogs = filteredLogs.filter(
          (log) => log.eventType === filter.eventType
        );
      }

      if (filter.timeRange) {
        filteredLogs = filteredLogs.filter(
          (log) =>
            log.timestamp >= filter.timeRange!.start &&
            log.timestamp <= filter.timeRange!.end
        );
      }

      if (filter.correlationId) {
        filteredLogs = filteredLogs.filter(
          (log) => log.correlationId === filter.correlationId
        );
      }

      if (filter.limit && filter.limit > 0) {
        filteredLogs = filteredLogs.slice(0, filter.limit);
      }
    }

    return filteredLogs.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Export logs to different formats
   */
  exportLogs(format: "json" | "csv" | "txt"): string {
    const logs = this.getLogs();

    switch (format) {
      case "json":
        return JSON.stringify(logs, null, 2);

      case "csv":
        if (logs.length === 0) return "";

        const headers = [
          "timestamp",
          "level",
          "eventType",
          "message",
          "source",
          "correlationId",
        ];
        const csvRows = [headers.join(",")];

        logs.forEach((log) => {
          const row = [
            log.timestamp,
            log.level,
            log.eventType,
            `"${log.message.replace(/"/g, '""')}"`,
            log.source || "",
            log.correlationId || "",
          ];
          csvRows.push(row.join(","));
        });

        return csvRows.join("\n");

      case "txt":
        return logs
          .map((log) => {
            const timestamp = this.formatTimestamp(log.timestamp);
            const level = log.level.toUpperCase().padEnd(5);
            const eventType = log.eventType.padEnd(20);
            return `[${timestamp}] ${level} ${eventType} ${log.message}`;
          })
          .join("\n");

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    this.info("SYSTEM", "Event logs cleared");
  }

  /**
   * Get logging statistics
   */
  getStats(): {
    totalEntries: number;
    entriesByLevel: Record<LogLevel, number>;
    entriesByEventType: Record<string, number>;
    timeRange: { start: number; end: number } | null;
    memoryUsage: number;
  } {
    const entriesByLevel = { debug: 0, info: 0, warn: 0, error: 0 };
    const entriesByEventType: Record<string, number> = {};
    let timeRange: { start: number; end: number } | null = null;

    this.logs.forEach((log) => {
      entriesByLevel[log.level]++;
      entriesByEventType[log.eventType] =
        (entriesByEventType[log.eventType] || 0) + 1;

      if (!timeRange) {
        timeRange = { start: log.timestamp, end: log.timestamp };
      } else {
        timeRange.start = Math.min(timeRange.start, log.timestamp);
        timeRange.end = Math.max(timeRange.end, log.timestamp);
      }
    });

    // Rough memory usage calculation
    const memoryUsage = JSON.stringify(this.logs).length * 2; // Rough estimate in bytes

    return {
      totalEntries: this.logs.length,
      entriesByLevel,
      entriesByEventType,
      timeRange,
      memoryUsage,
    };
  }

  /**
   * Update logger configuration
   */
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.info("SYSTEM", "Logger configuration updated", newConfig);
  }

  /**
   * Add log entry to collection
   */
  private addLogEntry(entry: LogEntry): void {
    if (this.config.outputTargets.includes("memory")) {
      // Maintain max entries limit
      if (this.logs.length >= this.config.maxEntries) {
        this.logs.shift(); // Remove oldest entry
      }
      this.logs.push(entry);
    }
  }

  /**
   * Output log entry to configured targets
   */
  private output(entry: LogEntry): void {
    if (this.config.outputTargets.includes("console")) {
      this.outputToConsole(entry);
    }

    // Future: Add file output support
    // if (this.config.outputTargets.includes('file')) {
    //   this.outputToFile(entry);
    // }
  }

  /**
   * Output log entry to console
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = this.formatTimestamp(entry.timestamp);
    const level = entry.level.toUpperCase().padEnd(5);
    const eventType = entry.eventType.padEnd(15);

    let message = `[${timestamp}] ${level} [${eventType}] ${entry.message}`;

    if (entry.correlationId) {
      message += ` (corr: ${entry.correlationId.slice(-8)})`;
    }

    // Apply colors if enabled
    if (this.config.colorized) {
      const color = this.logColors[entry.level];
      message = `${color}${message}${this.logColors.reset}`;
    }

    console.log(message);

    // Log data if present and debug level
    if (entry.data && entry.level === "debug") {
      console.log("   Data:", entry.data);
    }
  }

  /**
   * Check if log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    const levelIndex = this.getLevelIndex(level);
    const configLevelIndex = this.getLevelIndex(this.config.level);
    return levelIndex >= configLevelIndex;
  }

  /**
   * Get numeric index for log level (higher = more severe)
   */
  private getLevelIndex(level: LogLevel): number {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] || 0;
  }

  /**
   * Format timestamp according to configuration
   */
  private formatTimestamp(timestamp: number): string {
    switch (this.config.timestampFormat) {
      case "iso":
        return new Date(timestamp).toISOString().substr(11, 12); // HH:mm:ss.sss
      case "epoch":
        return timestamp.toString();
      case "relative":
        const elapsed = timestamp - this.startTime;
        return `+${elapsed}ms`;
      default:
        return new Date(timestamp).toISOString().substr(11, 12);
    }
  }

  /**
   * Sanitize data for logging (remove sensitive info)
   */
  private sanitizeData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    try {
      const cloned = deepClone(data);

      const sanitizeObject = (obj: any): any => {
        if (obj && typeof obj === "object") {
          if (Array.isArray(obj)) {
            return obj.map(sanitizeObject);
          }

          const result: any = {};
          Object.keys(obj).forEach((key) => {
            const lowercaseKey = key.toLowerCase();
            if (
              lowercaseKey.includes("password") ||
              lowercaseKey.includes("secret") ||
              lowercaseKey.includes("token") ||
              lowercaseKey.includes("key")
            ) {
              result[key] = "[REDACTED]";
            } else {
              result[key] = sanitizeObject(obj[key]);
            }
          });
          return result;
        }
        return obj;
      };

      return sanitizeObject(cloned);
    } catch (error) {
      return {
        sanitization_error: "Failed to sanitize data",
        original_type: typeof data,
      };
    }
  }
}
