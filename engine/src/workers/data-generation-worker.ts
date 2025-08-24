// Data Generation Web Worker
// Handles background data generation to avoid blocking the main thread

import { OptimizedSimulationEngine } from '../simulation/optimized-engine';
import { SimulationParameters, SimulationDataset } from '../../../data/src/types/index';

// Message types for communication protocol
interface WorkerRequest {
  id: string;
  type: 'generate' | 'cancel' | 'status' | 'ping';
  payload?: {
    parameters?: SimulationParameters;
    duration?: number;
  };
}

interface WorkerResponse {
  id: string;
  type: 'progress' | 'complete' | 'error' | 'status' | 'pong';
  payload?: {
    progress?: WorkerProgress;
    data?: SimulationDataset;
    error?: string;
    cancelled?: boolean;
    status?: WorkerStatus;
  };
}

interface WorkerProgress {
  completedDays: number;
  totalDays: number;
  percentage: number;
  estimatedTimeRemaining: number;
  currentPhase: 'initialization' | 'generation' | 'finalization';
  memoryUsage?: number;
}

interface WorkerStatus {
  isActive: boolean;
  memoryUsage: number;
  activeRequests: number;
  totalProcessed: number;
  uptime: number;
  version: string;
}

// Worker state management
class DataGenerationWorker {
  private activeGenerations = new Map<string, {
    engine: OptimizedSimulationEngine;
    cancelled: boolean;
    startTime: number;
  }>();
  
  private totalProcessed = 0;
  private startTime = Date.now();
  private version = '1.0.0';

  constructor() {
    // Set up message handling
    self.onmessage = (event: MessageEvent<WorkerRequest>) => {
      this.handleMessage(event.data);
    };

    // Handle uncaught errors
    self.onerror = (error: ErrorEvent) => {
      this.sendError('worker-error', `Worker error: ${error.message}`, error.filename, error.lineno);
    };

    // Send ready signal
    this.sendMessage({
      id: 'init',
      type: 'status',
      payload: {
        status: {
          isActive: true,
          memoryUsage: this.getMemoryUsage(),
          activeRequests: 0,
          totalProcessed: 0,
          uptime: 0,
          version: this.version
        }
      }
    });
  }

  private handleMessage(request: WorkerRequest): void {
    try {
      switch (request.type) {
        case 'generate':
          this.handleGenerationRequest(request);
          break;
        case 'cancel':
          this.handleCancellationRequest(request);
          break;
        case 'status':
          this.handleStatusRequest(request);
          break;
        case 'ping':
          this.handlePingRequest(request);
          break;
        default:
          this.sendError(request.id, `Unknown request type: ${request.type}`);
      }
    } catch (error) {
      this.sendError(request.id, `Error handling request: ${error}`);
    }
  }

  private async handleGenerationRequest(request: WorkerRequest): Promise<void> {
    if (!request.payload?.parameters) {
      this.sendError(request.id, 'Missing parameters for generation request');
      return;
    }

    const { parameters } = request.payload;

    try {
      // Create optimized simulation engine
      const engine = new OptimizedSimulationEngine(parameters);
      
      // Track active generation
      this.activeGenerations.set(request.id, {
        engine,
        cancelled: false,
        startTime: Date.now()
      });

      // Send initialization progress
      this.sendProgress(request.id, {
        completedDays: 0,
        totalDays: 365,
        percentage: 0,
        estimatedTimeRemaining: 5000, // 5 second estimate
        currentPhase: 'initialization',
        memoryUsage: this.getMemoryUsage()
      });

      // Generate dataset with progress reporting
      const dataset = await this.generateWithProgress(request.id, engine);
      
      // Check if cancelled
      const generation = this.activeGenerations.get(request.id);
      if (generation?.cancelled) {
        this.sendError(request.id, 'Generation cancelled', undefined, undefined, true);
        return;
      }

      // Send completion
      this.sendMessage({
        id: request.id,
        type: 'complete',
        payload: { data: dataset }
      });

      this.totalProcessed++;

    } catch (error) {
      this.sendError(request.id, `Generation failed: ${error}`);
    } finally {
      this.activeGenerations.delete(request.id);
    }
  }

  private async generateWithProgress(
    requestId: string, 
    engine: OptimizedSimulationEngine
  ): Promise<SimulationDataset> {
    const startTime = performance.now();
    let lastProgressUpdate = startTime;
    
    // Override the engine's internal generation to add progress reporting
    const originalGenerateYearlyDataset = engine.generateYearlyDataset.bind(engine);
    
    // Create a wrapped version that reports progress
    const generateWithProgressReporting = async (): Promise<SimulationDataset> => {
      // Initialize dataset structure
      const dataset: SimulationDataset = {
        id: `simulation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        version: "1.0.0",
        createdAt: new Date(),
        updatedAt: new Date(),
        parameters: engine.getParameters(),
        metadata: {
          generationDurationMs: 0,
          dataPoints: 365,
          memoryUsageMB: 0,
          accuracy: 0.98,
        },
        dailySnapshots: [],
        aggregations: {
          weekly: [],
          monthly: [],
          yearly: null,
        },
      };

      let currentPlayers = 1000;
      let activePlayers = 1000;

      // Generate daily snapshots with progress reporting
      for (let day = 1; day <= 365; day++) {
        // Check for cancellation
        const generation = this.activeGenerations.get(requestId);
        if (generation?.cancelled) {
          throw new Error('Generation cancelled');
        }

        // Simulate the day (using private method access via reflection)
        const dailySnapshot = await (engine as any).simulateDay(day, currentPlayers, activePlayers);
        dataset.dailySnapshots.push(dailySnapshot);

        // Update player counts
        currentPlayers = dailySnapshot.playerMetrics.totalPlayers;
        activePlayers = dailySnapshot.playerMetrics.activePlayers;

        // Report progress every 10 days or every 100ms minimum
        const now = performance.now();
        if (day % 10 === 0 || now - lastProgressUpdate > 100) {
          const percentage = (day / 365) * 80; // Reserve 20% for finalization
          const elapsed = now - startTime;
          const estimatedTotal = elapsed / (day / 365);
          const estimatedTimeRemaining = Math.max(0, estimatedTotal - elapsed);

          this.sendProgress(requestId, {
            completedDays: day,
            totalDays: 365,
            percentage,
            estimatedTimeRemaining,
            currentPhase: 'generation',
            memoryUsage: this.getMemoryUsage()
          });

          lastProgressUpdate = now;
          
          // Allow other operations to run
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      // Finalization phase
      this.sendProgress(requestId, {
        completedDays: 365,
        totalDays: 365,
        percentage: 90,
        estimatedTimeRemaining: 500,
        currentPhase: 'finalization',
        memoryUsage: this.getMemoryUsage()
      });

      // Generate aggregations using engine's private method
      dataset.aggregations.yearly = (engine as any).generateYearlyAggregation(dataset.dailySnapshots);

      // Final metrics
      const endTime = performance.now();
      const memoryUsage = this.getMemoryUsage();
      
      dataset.metadata.generationDurationMs = endTime - startTime;
      dataset.metadata.memoryUsageMB = memoryUsage / (1024 * 1024);
      dataset.updatedAt = new Date();

      // Final progress update
      this.sendProgress(requestId, {
        completedDays: 365,
        totalDays: 365,
        percentage: 100,
        estimatedTimeRemaining: 0,
        currentPhase: 'finalization',
        memoryUsage: memoryUsage
      });

      return dataset;
    };

    return await generateWithProgressReporting();
  }

  private handleCancellationRequest(request: WorkerRequest): void {
    const requestIdToCancel = request.payload?.requestId;
    
    if (requestIdToCancel) {
      // Cancel specific request
      const generation = this.activeGenerations.get(requestIdToCancel);
      if (generation) {
        generation.cancelled = true;
        this.sendMessage({
          id: request.id,
          type: 'complete',
          payload: { cancelled: true }
        });
      } else {
        this.sendError(request.id, `Request ${requestIdToCancel} not found or already completed`);
      }
    } else {
      // Cancel all active requests
      let cancelledCount = 0;
      for (const [id, generation] of this.activeGenerations) {
        generation.cancelled = true;
        cancelledCount++;
      }
      
      this.sendMessage({
        id: request.id,
        type: 'complete',
        payload: { cancelled: true, cancelledCount }
      });
    }
  }

  private handleStatusRequest(request: WorkerRequest): void {
    const uptime = Date.now() - this.startTime;
    const memoryUsage = this.getMemoryUsage();
    
    const status: WorkerStatus = {
      isActive: true,
      memoryUsage,
      activeRequests: this.activeGenerations.size,
      totalProcessed: this.totalProcessed,
      uptime,
      version: this.version
    };

    this.sendMessage({
      id: request.id,
      type: 'status',
      payload: { status }
    });
  }

  private handlePingRequest(request: WorkerRequest): void {
    this.sendMessage({
      id: request.id,
      type: 'pong',
      payload: { 
        timestamp: Date.now(),
        memoryUsage: this.getMemoryUsage()
      }
    });
  }

  private sendProgress(requestId: string, progress: WorkerProgress): void {
    this.sendMessage({
      id: requestId,
      type: 'progress',
      payload: { progress }
    });
  }

  private sendError(
    requestId: string, 
    message: string, 
    filename?: string, 
    lineno?: number,
    cancelled = false
  ): void {
    this.sendMessage({
      id: requestId,
      type: 'error',
      payload: { 
        error: message, 
        cancelled,
        filename,
        lineno
      }
    });
  }

  private sendMessage(response: WorkerResponse): void {
    try {
      self.postMessage(response);
    } catch (error) {
      console.error('Failed to send worker message:', error);
    }
  }

  private getMemoryUsage(): number {
    // In a browser environment, we can't access process.memoryUsage()
    // Use performance.memory if available, otherwise estimate
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize || 0;
    }
    
    // Rough estimation based on active generations
    const baseUsage = 10 * 1024 * 1024; // 10MB base
    const generationUsage = this.activeGenerations.size * 20 * 1024 * 1024; // 20MB per active generation
    return baseUsage + generationUsage;
  }
}

// Initialize worker
new DataGenerationWorker();