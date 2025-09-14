import { EventDebugger, type DebuggerConfig, type EventTrace } from './event-debugger.js';
import { EventLogger, type LoggerConfig, type LogEntry } from './event-logger.js';
import { EventFlowVisualizer, type FlowAnalysis } from './event-flow-visualizer.js';
import { PerformanceMonitor, type MonitorConfig, type PerformanceSnapshot } from './performance-monitor.js';
import type { EventBus } from '../event-bus.js';

export interface DebugInterfaceConfig {
  debugger: Partial<DebuggerConfig>;
  logger: Partial<LoggerConfig>;
  performanceMonitor: Partial<MonitorConfig>;
  autoStartMonitoring: boolean;
  reportInterval: number;
}

export interface DebugSession {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  traces: EventTrace[];
  logs: LogEntry[];
  performanceSnapshots: PerformanceSnapshot[];
  analysis?: FlowAnalysis;
}

export interface DebugReport {
  sessionId: string;
  generatedAt: number;
  summary: {
    duration: number;
    totalEvents: number;
    errorCount: number;
    avgLatency: number;
    peakThroughput: number;
  };
  sections: {
    eventFlow: string;
    performance: string;
    errors: string;
    recommendations: string[];
  };
}

/**
 * Main debugging interface that coordinates all debugging tools
 */
export class EventDebugInterface {
  private debugger: EventDebugger;
  private logger: EventLogger;
  private visualizer: EventFlowVisualizer;
  private performanceMonitor: PerformanceMonitor;
  private config: DebugInterfaceConfig;

  private currentSession?: DebugSession;
  private sessions: DebugSession[] = [];
  private eventBus?: EventBus;
  private reportInterval?: NodeJS.Timeout;

  constructor(config: Partial<DebugInterfaceConfig> = {}) {
    this.config = {
      debugger: {},
      logger: {},
      performanceMonitor: {},
      autoStartMonitoring: true,
      reportInterval: 60000, // 1 minute
      ...config
    };

    // Initialize components
    this.debugger = new EventDebugger(this.config.debugger);
    this.logger = new EventLogger(this.config.logger);
    this.visualizer = new EventFlowVisualizer();
    this.performanceMonitor = new PerformanceMonitor(this.config.performanceMonitor);

    if (this.config.autoStartMonitoring) {
      this.startPeriodicReporting();
    }
  }

  /**
   * Attach to an EventBus for comprehensive debugging
   */
  attachToEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;

    // Attach debugger for tracing
    this.debugger.attachToEventBus(eventBus);

    // Log major lifecycle events
    this.logger.info('SYSTEM', 'EventDebugInterface attached to EventBus');

    // Hook into event bus events for performance monitoring
    this.setupPerformanceHooks(eventBus);
  }

  /**
   * Detach from EventBus
   */
  detach(): void {
    if (this.eventBus) {
      this.debugger.detach();
      this.logger.info('SYSTEM', 'EventDebugInterface detached from EventBus');
      this.eventBus = undefined;
    }
  }

  /**
   * Start a new debugging session
   */
  startSession(name: string): string {
    const sessionId = this.generateSessionId();

    this.currentSession = {
      id: sessionId,
      name,
      startTime: Date.now(),
      traces: [],
      logs: [],
      performanceSnapshots: []
    };

    this.logger.info('SESSION', `Started debugging session: ${name}`, { sessionId });
    return sessionId;
  }

  /**
   * End the current debugging session
   */
  endSession(): DebugSession | null {
    if (!this.currentSession) {
      this.logger.warn('SESSION', 'No active session to end');
      return null;
    }

    this.currentSession.endTime = Date.now();

    // Collect final data
    this.currentSession.traces = this.debugger.getTraces();
    this.currentSession.logs = this.logger.getLogs();
    this.currentSession.performanceSnapshots = this.performanceMonitor.getSnapshots();

    // Perform flow analysis
    this.currentSession.analysis = this.visualizer.analyzeFlow(this.currentSession.traces);

    // Store session
    this.sessions.push(this.currentSession);

    const session = this.currentSession;
    this.currentSession = undefined;

    this.logger.info('SESSION', `Ended debugging session: ${session.name}`, {
      sessionId: session.id,
      duration: session.endTime ? session.endTime - session.startTime : 0,
      eventCount: session.traces.length
    });

    return session;
  }

  /**
   * Generate comprehensive debug report
   */
  generateReport(sessionId?: string): DebugReport {
    const session = sessionId ?
      this.sessions.find(s => s.id === sessionId) || this.currentSession :
      this.currentSession;

    if (!session) {
      throw new Error('No session available for report generation');
    }

    const duration = (session.endTime || Date.now()) - session.startTime;
    const errorLogs = session.logs.filter(l => l.level === 'error');

    // Calculate summary metrics
    const latencies = session.traces
      .filter(t => t.duration !== undefined)
      .map(t => t.duration!);
    const avgLatency = latencies.length > 0 ?
      latencies.reduce((sum, l) => sum + l, 0) / latencies.length : 0;

    const throughputData = session.performanceSnapshots
      .map(s => s.summary.throughput);
    const peakThroughput = throughputData.length > 0 ? Math.max(...throughputData) : 0;

    const summary = {
      duration,
      totalEvents: session.traces.length,
      errorCount: errorLogs.length,
      avgLatency,
      peakThroughput
    };

    // Generate sections
    const sections = {
      eventFlow: this.generateEventFlowSection(session),
      performance: this.generatePerformanceSection(session),
      errors: this.generateErrorsSection(session),
      recommendations: session.analysis?.recommendations || []
    };

    return {
      sessionId: session.id,
      generatedAt: Date.now(),
      summary,
      sections
    };
  }

  /**
   * Get real-time debug dashboard data
   */
  getDashboardData(): {
    currentSession: DebugSession | undefined;
    recentEvents: EventTrace[];
    performanceSnapshot: PerformanceSnapshot | null;
    activeAlerts: any[];
    systemStatus: 'healthy' | 'warning' | 'critical';
  } {
    const recentEvents = this.debugger.getTraces({
      timeRange: { start: Date.now() - 30000, end: Date.now() }
    }).slice(0, 20);

    const performanceSnapshots = this.performanceMonitor.getSnapshots(1);
    const performanceSnapshot = performanceSnapshots.length > 0 ? performanceSnapshots[0] : null;

    const activeAlerts = this.performanceMonitor.getAlerts();

    // Determine system status
    let systemStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (activeAlerts.some(a => a.level === 'critical')) {
      systemStatus = 'critical';
    } else if (activeAlerts.some(a => a.level === 'warning')) {
      systemStatus = 'warning';
    }

    return {
      currentSession: this.currentSession,
      recentEvents,
      performanceSnapshot,
      activeAlerts,
      systemStatus
    };
  }

  /**
   * Export debug data in various formats
   */
  exportData(format: 'json' | 'csv' | 'txt', sessionId?: string): string {
    const session = sessionId ?
      this.sessions.find(s => s.id === sessionId) || this.currentSession :
      this.currentSession;

    if (!session) {
      throw new Error('No session available for export');
    }

    switch (format) {
      case 'json':
        return JSON.stringify(session, null, 2);

      case 'csv':
        return this.exportToCsv(session);

      case 'txt':
        const report = this.generateReport(sessionId);
        return this.formatReportAsText(report);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Get debugging statistics
   */
  getStats(): {
    totalSessions: number;
    currentSessionDuration: number | undefined;
    avgSessionDuration: number;
    totalEventsProcessed: number;
    avgEventsPerSession: number;
    errorRate: number;
  } {
    const completedSessions = this.sessions.filter(s => s.endTime);
    const avgSessionDuration = completedSessions.length > 0 ?
      completedSessions.reduce((sum, s) => sum + (s.endTime! - s.startTime), 0) / completedSessions.length : 0;

    const totalEventsProcessed = this.sessions.reduce((sum, s) => sum + s.traces.length, 0);
    const avgEventsPerSession = this.sessions.length > 0 ? totalEventsProcessed / this.sessions.length : 0;

    const totalErrors = this.sessions.reduce((sum, s) => sum + s.logs.filter(l => l.level === 'error').length, 0);
    const errorRate = totalEventsProcessed > 0 ? (totalErrors / totalEventsProcessed) * 100 : 0;

    return {
      totalSessions: this.sessions.length,
      currentSessionDuration: this.currentSession ? Date.now() - this.currentSession.startTime : undefined,
      avgSessionDuration,
      totalEventsProcessed,
      avgEventsPerSession,
      errorRate
    };
  }

  /**
   * Clear all debug data
   */
  clearData(): void {
    this.debugger.clearTraces();
    this.logger.clearLogs();
    this.visualizer.clearHistory();
    this.performanceMonitor.clearData();
    this.sessions = [];
    this.currentSession = undefined;

    this.logger.info('SYSTEM', 'All debug data cleared');
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DebugInterfaceConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update component configs
    if (newConfig.debugger) {
      this.debugger.updateConfig(newConfig.debugger);
    }
    if (newConfig.logger) {
      this.logger.updateConfig(newConfig.logger);
    }
    if (newConfig.performanceMonitor) {
      this.performanceMonitor.updateConfig(newConfig.performanceMonitor);
    }

    this.logger.info('SYSTEM', 'Debug interface configuration updated');
  }

  /**
   * Setup performance monitoring hooks
   */
  private setupPerformanceHooks(eventBus: EventBus): void {
    // We'll need to enhance EventBus to support these hooks
    // For now, this is a placeholder for future implementation
    this.logger.debug('SYSTEM', 'Performance hooks setup (placeholder)');
  }

  /**
   * Start periodic reporting
   */
  private startPeriodicReporting(): void {
    if (this.reportInterval) return;

    this.reportInterval = setInterval(() => {
      const dashboardData = this.getDashboardData();

      if (dashboardData.systemStatus !== 'healthy') {
        this.logger.warn('MONITOR', `System status: ${dashboardData.systemStatus}`, {
          activeAlerts: dashboardData.activeAlerts.length,
          recentEvents: dashboardData.recentEvents.length
        });
      }
    }, this.config.reportInterval);
  }

  /**
   * Generate event flow section of report
   */
  private generateEventFlowSection(session: DebugSession): string {
    if (session.analysis) {
      const visualization = this.visualizer.createFlowVisualization(session.traces);
      return this.visualizer.generateAsciiVisualization(visualization);
    }
    return 'No flow analysis available';
  }

  /**
   * Generate performance section of report
   */
  private generatePerformanceSection(session: DebugSession): string {
    return this.performanceMonitor.generateReport();
  }

  /**
   * Generate errors section of report
   */
  private generateErrorsSection(session: DebugSession): string {
    const errorLogs = session.logs.filter(l => l.level === 'error');

    if (errorLogs.length === 0) {
      return 'No errors recorded during this session.';
    }

    let section = `\n=== ERRORS (${errorLogs.length}) ===\n`;

    errorLogs.slice(0, 10).forEach((log, index) => {
      const timestamp = new Date(log.timestamp).toISOString().substr(11, 12);
      section += `${index + 1}. [${timestamp}] ${log.eventType}: ${log.message}\n`;

      if (log.data && typeof log.data === 'object' && log.data.stack) {
        section += `   Stack: ${log.data.stack.split('\n')[0]}\n`;
      }
    });

    return section;
  }

  /**
   * Export session to CSV format
   */
  private exportToCsv(session: DebugSession): string {
    const headers = ['timestamp', 'type', 'eventType', 'status', 'duration', 'message'];
    const rows = [headers.join(',')];

    // Add trace data
    session.traces.forEach(trace => {
      const row = [
        trace.timestamp,
        'event',
        trace.eventType,
        trace.status,
        trace.duration || '',
        `"Event ${trace.status}"`
      ];
      rows.push(row.join(','));
    });

    // Add log data
    session.logs.forEach(log => {
      const row = [
        log.timestamp,
        'log',
        log.eventType,
        log.level,
        '',
        `"${log.message.replace(/"/g, '""')}"`
      ];
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  /**
   * Format report as readable text
   */
  private formatReportAsText(report: DebugReport): string {
    let text = `\n=== DEBUG REPORT ===\n`;
    text += `Session: ${report.sessionId}\n`;
    text += `Generated: ${new Date(report.generatedAt).toISOString()}\n`;
    text += `Duration: ${report.summary.duration}ms\n\n`;

    text += `=== SUMMARY ===\n`;
    text += `Total Events: ${report.summary.totalEvents}\n`;
    text += `Errors: ${report.summary.errorCount}\n`;
    text += `Average Latency: ${report.summary.avgLatency.toFixed(2)}ms\n`;
    text += `Peak Throughput: ${report.summary.peakThroughput.toFixed(2)} events/sec\n\n`;

    text += report.sections.eventFlow + '\n';
    text += report.sections.performance + '\n';
    text += report.sections.errors + '\n';

    if (report.sections.recommendations.length > 0) {
      text += `=== RECOMMENDATIONS ===\n`;
      report.sections.recommendations.forEach((rec, index) => {
        text += `${index + 1}. ${rec}\n`;
      });
    }

    return text;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.detach();

    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = undefined;
    }

    this.performanceMonitor.destroy();
    this.clearData();
  }
}