import type { EventTrace } from "./event-debugger";

export interface FlowNode {
  id: string;
  eventType: string;
  timestamp: number;
  status: "pending" | "processing" | "completed" | "failed";
  duration: number | undefined;
  data: any | undefined;
  children: FlowNode[];
  parent: FlowNode | undefined;
  level: number;
}

export interface FlowVisualization {
  nodes: FlowNode[];
  edges: Array<{
    from: string;
    to: string;
    type: "triggers" | "follows" | "parallel";
  }>;
  metadata: {
    totalEvents: number;
    duration: number;
    criticalPath: FlowNode[];
    bottlenecks: FlowNode[];
    parallelPaths: FlowNode[][];
  };
}

export interface FlowAnalysis {
  summary: {
    totalEvents: number;
    totalDuration: number;
    avgEventDuration: number;
    longestPath: number;
    parallelismFactor: number;
  };
  criticalPath: FlowNode[];
  bottlenecks: Array<{
    node: FlowNode;
    reason: "slow_processing" | "many_dependencies" | "blocking_others";
    impact: number;
  }>;
  patterns: Array<{
    type: "sequential" | "parallel" | "fan_out" | "fan_in" | "loop";
    nodes: FlowNode[];
    frequency: number;
  }>;
  recommendations: string[];
}

export class EventFlowVisualizer {
  private flowHistory: FlowVisualization[] = [];
  private maxHistorySize = 50;

  /**
   * Create flow visualization from event traces
   */
  createFlowVisualization(
    traces: EventTrace[],
    _title = "Event Flow"
  ): FlowVisualization {
    const nodes = this.buildFlowNodes(traces);
    const edges = this.buildFlowEdges(nodes);
    const metadata = this.analyzeFlowMetadata(nodes);

    const visualization: FlowVisualization = {
      nodes,
      edges,
      metadata,
    };

    // Store in history
    this.addToHistory(visualization);

    return visualization;
  }

  /**
   * Build flow nodes from traces
   */
  private buildFlowNodes(traces: EventTrace[]): FlowNode[] {
    const nodeMap = new Map<string, FlowNode>();
    const correlationGroups = new Map<string, EventTrace[]>();

    // Group traces by correlation ID
    traces.forEach((trace) => {
      const correlationId = trace.correlationId || "default";
      if (!correlationGroups.has(correlationId)) {
        correlationGroups.set(correlationId, []);
      }
      correlationGroups.get(correlationId)!.push(trace);
    });

    // Build nodes for each correlation group
    let level = 0;
    correlationGroups.forEach((groupTraces) => {
      groupTraces.sort((a, b) => a.timestamp - b.timestamp);

      groupTraces.forEach((trace, index) => {
        const node: FlowNode = {
          id: trace.id,
          eventType: trace.eventType,
          timestamp: trace.timestamp,
          status: trace.status,
          duration: trace.duration,
          data: trace.data,
          children: [],
          parent: undefined,
          level,
        };

        nodeMap.set(trace.id, node);

        // Link to previous node in sequence
        if (index > 0) {
          const prevTrace = groupTraces[index - 1];
          const prevNode = nodeMap.get(prevTrace.id);
          if (prevNode) {
            prevNode.children.push(node);
            node.parent = prevNode;
          }
        }
      });
      level++;
    });

    return Array.from(nodeMap.values());
  }

  /**
   * Build edges between nodes
   */
  private buildFlowEdges(nodes: FlowNode[]): Array<{
    from: string;
    to: string;
    type: "triggers" | "follows" | "parallel";
  }> {
    const edges: Array<{
      from: string;
      to: string;
      type: "triggers" | "follows" | "parallel";
    }> = [];

    nodes.forEach((node) => {
      node.children.forEach((child) => {
        const type = this.determineEdgeType(node, child);
        edges.push({ from: node.id, to: child.id, type });
      });
    });

    return edges;
  }

  /**
   * Determine the type of edge between two nodes
   */
  private determineEdgeType(
    from: FlowNode,
    to: FlowNode
  ): "triggers" | "follows" | "parallel" {
    const timeDiff = to.timestamp - from.timestamp;

    // If events happen very close together, they're likely parallel
    if (timeDiff < 10) {
      // 10ms threshold
      return "parallel";
    }

    // If one clearly triggers the other (common event patterns)
    const triggerPatterns = [
      { from: "GAME_CREATED", to: "GAME_RESOLVED" },
      { from: "DAY_STARTED", to: "GAME_CREATED" },
      { from: "PLAYER_ADVANCED", to: "VIRTUAL_DOLLAR_ADVANCED" },
    ];

    const matchesTriggerPattern = triggerPatterns.some(
      (pattern) =>
        from.eventType.includes(pattern.from) &&
        to.eventType.includes(pattern.to)
    );

    return matchesTriggerPattern ? "triggers" : "follows";
  }

  /**
   * Analyze flow for metadata
   */
  private analyzeFlowMetadata(
    nodes: FlowNode[]
  ): FlowVisualization["metadata"] {
    const criticalPath = this.findCriticalPath(nodes);
    const bottlenecks = this.findBottlenecks(nodes);
    const parallelPaths = this.findParallelPaths(nodes);

    const durations = nodes.filter((n) => n.duration).map((n) => n.duration!);
    const totalDuration =
      Math.max(...durations) - Math.min(...nodes.map((n) => n.timestamp));

    return {
      totalEvents: nodes.length,
      duration: totalDuration,
      criticalPath,
      bottlenecks,
      parallelPaths,
    };
  }

  /**
   * Find critical path (longest sequence)
   */
  private findCriticalPath(nodes: FlowNode[]): FlowNode[] {
    let longestPath: FlowNode[] = [];

    const findPath = (node: FlowNode, currentPath: FlowNode[]): void => {
      const newPath = [...currentPath, node];

      if (node.children.length === 0) {
        // End of path
        if (newPath.length > longestPath.length) {
          longestPath = [...newPath];
        }
      } else {
        // Continue with children
        node.children.forEach((child) => {
          findPath(child, newPath);
        });
      }
    };

    // Start from root nodes (no parents)
    nodes
      .filter((n) => !n.parent)
      .forEach((rootNode) => {
        findPath(rootNode, []);
      });

    return longestPath;
  }

  /**
   * Find bottleneck nodes
   */
  private findBottlenecks(nodes: FlowNode[]): FlowNode[] {
    return nodes.filter((node) => {
      // Nodes with long duration
      if (node.duration && node.duration > 100) return true;

      // Nodes with many children (fan-out)
      if (node.children.length > 3) return true;

      // Nodes that block others (parents with slow children)
      const avgChildDuration =
        node.children
          .filter((c) => c.duration)
          .reduce((sum, c) => sum + c.duration!, 0) / node.children.length;

      if (avgChildDuration > 50) return true;

      return false;
    });
  }

  /**
   * Find parallel execution paths
   */
  private findParallelPaths(nodes: FlowNode[]): FlowNode[][] {
    const parallelGroups: FlowNode[][] = [];
    const visited = new Set<string>();

    nodes.forEach((node) => {
      if (visited.has(node.id)) return;

      // Find nodes that executed around the same time
      const parallelNodes = nodes.filter((other) => {
        if (other.id === node.id || visited.has(other.id)) return false;

        const timeDiff = Math.abs(other.timestamp - node.timestamp);
        return timeDiff < 50; // 50ms window for parallel execution
      });

      if (parallelNodes.length > 0) {
        const group = [node, ...parallelNodes];
        group.forEach((n) => visited.add(n.id));
        parallelGroups.push(group);
      }
    });

    return parallelGroups;
  }

  /**
   * Analyze flow patterns and performance
   */
  analyzeFlow(traces: EventTrace[]): FlowAnalysis {
    const visualization = this.createFlowVisualization(traces);
    const { nodes, metadata } = visualization;

    const summary = this.calculateSummary(nodes);
    const bottlenecks = this.analyzeBottlenecks(nodes);
    const patterns = this.identifyPatterns(nodes);
    const recommendations = this.generateRecommendations(
      nodes,
      bottlenecks,
      patterns
    );

    return {
      summary,
      criticalPath: metadata.criticalPath,
      bottlenecks,
      patterns,
      recommendations,
    };
  }

  /**
   * Calculate flow summary statistics
   */
  private calculateSummary(nodes: FlowNode[]): FlowAnalysis["summary"] {
    const durations = nodes.filter((n) => n.duration).map((n) => n.duration!);
    const totalDuration =
      nodes.length > 0
        ? Math.max(...nodes.map((n) => n.timestamp)) -
          Math.min(...nodes.map((n) => n.timestamp))
        : 0;
    const avgEventDuration =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

    // Calculate longest path
    const paths = this.getAllPaths(nodes);
    const longestPath = paths.reduce(
      (max, path) => Math.max(max, path.length),
      0
    );

    // Calculate parallelism factor
    const maxConcurrentEvents = this.calculateMaxConcurrency(nodes);
    const parallelismFactor =
      nodes.length > 0 ? maxConcurrentEvents / nodes.length : 0;

    return {
      totalEvents: nodes.length,
      totalDuration,
      avgEventDuration,
      longestPath,
      parallelismFactor,
    };
  }

  /**
   * Get all paths in the flow
   */
  private getAllPaths(nodes: FlowNode[]): FlowNode[][] {
    const paths: FlowNode[][] = [];

    const findPaths = (node: FlowNode, currentPath: FlowNode[]): void => {
      const newPath = [...currentPath, node];

      if (node.children.length === 0) {
        paths.push(newPath);
      } else {
        node.children.forEach((child) => findPaths(child, newPath));
      }
    };

    nodes.filter((n) => !n.parent).forEach((root) => findPaths(root, []));
    return paths;
  }

  /**
   * Calculate maximum concurrent events
   */
  private calculateMaxConcurrency(nodes: FlowNode[]): number {
    const timeSlots: Array<{ time: number; delta: number }> = [];

    nodes.forEach((node) => {
      timeSlots.push({ time: node.timestamp, delta: 1 });
      if (node.duration) {
        timeSlots.push({ time: node.timestamp + node.duration, delta: -1 });
      }
    });

    timeSlots.sort((a, b) => a.time - b.time);

    let maxConcurrent = 0;
    let current = 0;

    timeSlots.forEach((slot) => {
      current += slot.delta;
      maxConcurrent = Math.max(maxConcurrent, current);
    });

    return maxConcurrent;
  }

  /**
   * Analyze bottlenecks with detailed reasons
   */
  private analyzeBottlenecks(nodes: FlowNode[]): FlowAnalysis["bottlenecks"] {
    const bottlenecks: FlowAnalysis["bottlenecks"] = [];

    nodes.forEach((node) => {
      // Slow processing bottleneck
      if (node.duration && node.duration > 100) {
        bottlenecks.push({
          node,
          reason: "slow_processing",
          impact: node.duration,
        });
      }

      // Many dependencies bottleneck
      if (node.children.length > 3) {
        bottlenecks.push({
          node,
          reason: "many_dependencies",
          impact: node.children.length * 10, // Arbitrary impact calculation
        });
      }

      // Blocking others bottleneck
      const dependentNodes = this.findDependentNodes(node, nodes);
      if (dependentNodes.length > 2 && node.duration && node.duration > 50) {
        bottlenecks.push({
          node,
          reason: "blocking_others",
          impact: dependentNodes.length * (node.duration || 0),
        });
      }
    });

    return bottlenecks.sort((a, b) => b.impact - a.impact);
  }

  /**
   * Find all nodes that depend on the given node
   */
  private findDependentNodes(
    node: FlowNode,
    _allNodes: FlowNode[]
  ): FlowNode[] {
    const dependent: FlowNode[] = [];
    const visited = new Set<string>();

    const traverse = (current: FlowNode): void => {
      if (visited.has(current.id)) return;
      visited.add(current.id);

      current.children.forEach((child) => {
        dependent.push(child);
        traverse(child);
      });
    };

    traverse(node);
    return dependent;
  }

  /**
   * Identify common flow patterns
   */
  private identifyPatterns(nodes: FlowNode[]): FlowAnalysis["patterns"] {
    const patterns: FlowAnalysis["patterns"] = [];

    // Sequential pattern: A -> B -> C
    const sequentialChains = this.findSequentialChains(nodes);
    if (sequentialChains.length > 0) {
      patterns.push({
        type: "sequential",
        nodes: sequentialChains.flat(),
        frequency: sequentialChains.length,
      });
    }

    // Fan-out pattern: A -> [B, C, D]
    const fanOutNodes = nodes.filter((n) => n.children.length > 2);
    if (fanOutNodes.length > 0) {
      patterns.push({
        type: "fan_out",
        nodes: fanOutNodes,
        frequency: fanOutNodes.length,
      });
    }

    // Fan-in pattern: [A, B, C] -> D
    const fanInNodes = this.findFanInNodes(nodes);
    if (fanInNodes.length > 0) {
      patterns.push({
        type: "fan_in",
        nodes: fanInNodes,
        frequency: fanInNodes.length,
      });
    }

    // Parallel pattern: A || B || C
    const parallelGroups = this.findParallelPaths(nodes);
    if (parallelGroups.length > 0) {
      patterns.push({
        type: "parallel",
        nodes: parallelGroups.flat(),
        frequency: parallelGroups.length,
      });
    }

    return patterns;
  }

  /**
   * Find sequential chains in the flow
   */
  private findSequentialChains(nodes: FlowNode[]): FlowNode[][] {
    const chains: FlowNode[][] = [];
    const visited = new Set<string>();

    nodes.forEach((node) => {
      if (visited.has(node.id) || node.children.length !== 1) return;

      const chain: FlowNode[] = [node];
      let current = node;

      while (
        current.children.length === 1 &&
        !visited.has(current.children[0].id)
      ) {
        current = current.children[0];
        chain.push(current);
        visited.add(current.id);
      }

      if (chain.length > 2) {
        // Only consider chains of 3+ nodes
        chains.push(chain);
        chain.forEach((n) => visited.add(n.id));
      }
    });

    return chains;
  }

  /**
   * Find fan-in nodes (multiple parents, single child)
   */
  private findFanInNodes(nodes: FlowNode[]): FlowNode[] {
    const parentCount = new Map<string, number>();

    nodes.forEach((node) => {
      node.children.forEach((child) => {
        parentCount.set(child.id, (parentCount.get(child.id) || 0) + 1);
      });
    });

    return nodes.filter((node) => (parentCount.get(node.id) || 0) > 2);
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    nodes: FlowNode[],
    bottlenecks: FlowAnalysis["bottlenecks"],
    patterns: FlowAnalysis["patterns"]
  ): string[] {
    const recommendations: string[] = [];

    // Bottleneck recommendations
    if (bottlenecks.length > 0) {
      const slowEvents = bottlenecks.filter(
        (b) => b.reason === "slow_processing"
      );
      if (slowEvents.length > 0) {
        recommendations.push(
          `Optimize slow events: ${slowEvents
            .map((b) => b.node.eventType)
            .join(", ")}`
        );
      }

      const blockingEvents = bottlenecks.filter(
        (b) => b.reason === "blocking_others"
      );
      if (blockingEvents.length > 0) {
        recommendations.push(
          `Consider async processing for blocking events: ${blockingEvents
            .map((b) => b.node.eventType)
            .join(", ")}`
        );
      }
    }

    // Pattern-based recommendations
    const parallelPattern = patterns.find((p) => p.type === "parallel");
    if (parallelPattern && parallelPattern.frequency > 3) {
      recommendations.push(
        "Good use of parallel processing detected. Consider expanding this pattern to other areas."
      );
    }

    const sequentialPattern = patterns.find((p) => p.type === "sequential");
    if (sequentialPattern && sequentialPattern.frequency > 5) {
      recommendations.push(
        "Long sequential chains detected. Look for opportunities to parallelize independent operations."
      );
    }

    // General recommendations
    const avgDuration =
      nodes.filter((n) => n.duration).reduce((sum, n) => sum + n.duration!, 0) /
      nodes.length;
    if (avgDuration > 50) {
      recommendations.push(
        "Overall event processing time is high. Consider performance optimizations."
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "Event flow appears well-optimized. Monitor for changes in performance patterns."
      );
    }

    return recommendations;
  }

  /**
   * Generate ASCII visualization of flow
   */
  generateAsciiVisualization(visualization: FlowVisualization): string {
    const { nodes } = visualization;
    let output = "\n=== EVENT FLOW VISUALIZATION ===\n\n";

    // Group nodes by level
    const levels = new Map<number, FlowNode[]>();
    nodes.forEach((node) => {
      if (!levels.has(node.level)) {
        levels.set(node.level, []);
      }
      levels.get(node.level)!.push(node);
    });

    // Sort levels
    const sortedLevels = Array.from(levels.entries()).sort(
      (a, b) => a[0] - b[0]
    );

    sortedLevels.forEach(([level, levelNodes]) => {
      output += `Level ${level}:\n`;

      levelNodes.forEach((node, index) => {
        const status =
          node.status === "completed"
            ? "✅"
            : node.status === "failed"
            ? "❌"
            : node.status === "processing"
            ? "⏳"
            : "⏸️";

        const duration = node.duration ? ` (${node.duration}ms)` : "";
        const prefix = index === levelNodes.length - 1 ? "└──" : "├──";

        output += `  ${prefix} ${status} ${node.eventType}${duration}\n`;

        // Show connections to children
        if (node.children.length > 0) {
          const childrenTypes = node.children
            .map((c) => c.eventType)
            .join(", ");
          output += `      └─→ triggers: ${childrenTypes}\n`;
        }
      });
      output += "\n";
    });

    return output;
  }

  /**
   * Add visualization to history
   */
  private addToHistory(visualization: FlowVisualization): void {
    this.flowHistory.push(visualization);

    if (this.flowHistory.length > this.maxHistorySize) {
      this.flowHistory.shift();
    }
  }

  /**
   * Get flow history
   */
  getFlowHistory(): FlowVisualization[] {
    return [...this.flowHistory];
  }

  /**
   * Clear flow history
   */
  clearHistory(): void {
    this.flowHistory = [];
  }
}
