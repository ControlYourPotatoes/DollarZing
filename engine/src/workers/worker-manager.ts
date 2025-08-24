// Web Worker Manager - Main Thread Interface
// Provides high-level API for managing data generation workers

import { SimulationParameters, SimulationDataset } from '../../../data/src/types/index';

// Re-export types for convenience
export interface WorkerProgress {
  completedDays: number;
  totalDays: number;
  percentage: number;
  estimatedTimeRemaining: number;
  currentPhase: 'initialization' | 'generation' | 'finalization';
  memoryUsage?: number;
}

export interface WorkerStatus {
  isActive: boolean;
  memoryUsage: number;
  activeRequests: number;
  totalProcessed: number;
  uptime: number;
  version: string;
}

interface WorkerRequest {
  id: string;
  type: 'generate' | 'cancel' | 'status' | 'ping';
  payload?: any;
}

interface WorkerResponse {
  id: string;
  type: 'progress' | 'complete' | 'error' | 'status' | 'pong';
  payload?: any;
}

// Generation options interface
export interface GenerationOptions {
  parameters: SimulationParameters;
  onProgress?: (progress: WorkerProgress) => void;
  timeout?: number; // Timeout in milliseconds
  priority?: 'low' | 'normal' | 'high';
}

// Result interface
export interface GenerationResult {
  dataset: SimulationDataset;
  generationTime: number;
  memoryUsed: number;
}

// Error types
export class WorkerError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'WorkerError';
  }
}

export class WorkerTimeoutError extends WorkerError {
  constructor(timeout: number) {
    super(`Generation timed out after ${timeout}ms`, 'TIMEOUT');
  }
}

export class WorkerCancellationError extends WorkerError {
  constructor() {
    super('Generation was cancelled', 'CANCELLED');
  }
}

// Worker Manager Class
export class DataGenerationWorkerManager {
  private workers: Worker[] = [];
  private currentWorkerIndex = 0;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    onProgress?: (progress: WorkerProgress) => void;
    timeout?: NodeJS.Timeout;
    startTime: number;
  }>();
  
  private requestIdCounter = 0;
  private maxWorkers: number;
  private workerScriptPath: string;
  private isInitialized = false;

  constructor(maxWorkers = navigator.hardwareConcurrency || 4, workerScriptPath = '/workers/data-generation-worker.js') {
    this.maxWorkers = Math.min(maxWorkers, 8); // Cap at 8 workers
    this.workerScriptPath = workerScriptPath;
  }

  // Initialize worker pool
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create worker pool
      for (let i = 0; i < this.maxWorkers; i++) {
        const worker = new Worker(this.workerScriptPath);
        
        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          this.handleWorkerMessage(event.data);
        };
        
        worker.onerror = (error: ErrorEvent) => {
          this.handleWorkerError(error);
        };
        
        worker.onmessageerror = (event: MessageEvent) => {
          this.handleWorkerMessageError(event);
        };
        
        this.workers.push(worker);
      }

      // Test worker availability
      await this.pingWorkers();
      
      this.isInitialized = true;
    } catch (error) {
      throw new WorkerError(`Failed to initialize workers: ${error}`, 'INIT_FAILED');
    }
  }

  // Generate dataset using worker
  async generateDataset(options: GenerationOptions): Promise<GenerationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const requestId = `req_${++this.requestIdCounter}_${Date.now()}`;
      const startTime = performance.now();
      
      // Set up timeout if specified
      let timeoutHandle: NodeJS.Timeout | undefined;
      if (options.timeout && options.timeout > 0) {
        timeoutHandle = setTimeout(() => {
          this.cancelGeneration(requestId);
          reject(new WorkerTimeoutError(options.timeout!));
        }, options.timeout);
      }

      // Store request
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        onProgress: options.onProgress,
        timeout: timeoutHandle,
        startTime
      });

      // Select worker (round-robin)
      const worker = this.getNextWorker();
      
      const request: WorkerRequest = {
        id: requestId,
        type: 'generate',
        payload: { parameters: options.parameters }
      };

      try {
        worker.postMessage(request);
      } catch (error) {
        this.cleanupRequest(requestId);
        reject(new WorkerError(`Failed to send generation request: ${error}`, 'SEND_FAILED'));
      }
    });
  }

  // Cancel generation
  async cancelGeneration(requestId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cancelId = `cancel_${++this.requestIdCounter}_${Date.now()}`;
      
      this.pendingRequests.set(cancelId, { resolve, reject, startTime: performance.now() });
      
      const worker = this.getNextWorker();
      const request: WorkerRequest = {
        id: cancelId,
        type: 'cancel',
        payload: requestId ? { requestId } : undefined
      };

      try {
        worker.postMessage(request);
      } catch (error) {
        this.cleanupRequest(cancelId);
        reject(new WorkerError(`Failed to send cancellation request: ${error}`, 'CANCEL_FAILED'));
      }
    });
  }

  // Cancel all active generations
  async cancelAllGenerations(): Promise<void> {
    const activeRequests = Array.from(this.pendingRequests.keys())
      .filter(id => id.startsWith('req_'));
    
    if (activeRequests.length === 0) return;

    // Cancel all requests
    for (const requestId of activeRequests) {
      try {
        await this.cancelGeneration(requestId);
      } catch (error) {
        console.warn(`Failed to cancel request ${requestId}:`, error);
      }
    }
  }

  // Get worker status
  async getWorkerStatus(): Promise<WorkerStatus[]> {
    const statusPromises = this.workers.map((worker, index) => {
      return new Promise<WorkerStatus>((resolve, reject) => {
        const statusId = `status_${index}_${Date.now()}`;
        
        this.pendingRequests.set(statusId, { resolve, reject, startTime: performance.now() });
        
        const request: WorkerRequest = {
          id: statusId,
          type: 'status'
        };

        try {
          worker.postMessage(request);
        } catch (error) {
          this.cleanupRequest(statusId);
          reject(new WorkerError(`Failed to get worker status: ${error}`, 'STATUS_FAILED'));
        }
      });
    });

    return Promise.all(statusPromises);
  }

  // Ping workers to test connectivity
  async pingWorkers(): Promise<number[]> {
    const pingPromises = this.workers.map((worker, index) => {
      return new Promise<number>((resolve, reject) => {
        const pingId = `ping_${index}_${Date.now()}`;
        const startTime = performance.now();
        
        const timeout = setTimeout(() => {
          this.cleanupRequest(pingId);
          reject(new WorkerError(`Worker ${index} ping timeout`, 'PING_TIMEOUT'));
        }, 5000);
        
        this.pendingRequests.set(pingId, { 
          resolve: (data) => {
            clearTimeout(timeout);
            resolve(performance.now() - startTime);
          }, 
          reject,
          timeout,
          startTime
        });
        
        const request: WorkerRequest = {
          id: pingId,
          type: 'ping'
        };

        try {
          worker.postMessage(request);
        } catch (error) {
          clearTimeout(timeout);
          this.cleanupRequest(pingId);
          reject(new WorkerError(`Failed to ping worker ${index}: ${error}`, 'PING_FAILED'));
        }
      });
    });

    return Promise.all(pingPromises);
  }

  // Get performance statistics
  getPerformanceStats(): {
    totalWorkers: number;
    activeRequests: number;
    totalProcessed: number;
    averageResponseTime: number;
  } {
    const activeRequests = Array.from(this.pendingRequests.values()).length;
    
    return {
      totalWorkers: this.workers.length,
      activeRequests,
      totalProcessed: this.requestIdCounter,
      averageResponseTime: 0 // Would need to track this over time
    };
  }

  // Terminate all workers
  terminate(): void {
    // Cancel all pending requests
    this.pendingRequests.forEach(({ reject }) => {
      reject(new WorkerError('Worker manager terminated', 'TERMINATED'));
    });
    this.pendingRequests.clear();

    // Terminate workers
    this.workers.forEach(worker => {
      worker.terminate();
    });
    this.workers = [];
    
    this.isInitialized = false;
  }

  // Private methods
  private getNextWorker(): Worker {
    if (this.workers.length === 0) {
      throw new WorkerError('No workers available', 'NO_WORKERS');
    }
    
    const worker = this.workers[this.currentWorkerIndex];
    this.currentWorkerIndex = (this.currentWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  private handleWorkerMessage(response: WorkerResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;

    switch (response.type) {
      case 'progress':
        if (pending.onProgress && response.payload?.progress) {
          pending.onProgress(response.payload.progress);
        }
        break;

      case 'complete':
        if (response.payload?.data) {
          const generationTime = performance.now() - pending.startTime;
          const memoryUsed = response.payload.data.metadata?.memoryUsageMB || 0;
          
          pending.resolve({
            dataset: response.payload.data,
            generationTime,
            memoryUsed
          });
        } else {
          pending.resolve(response.payload);
        }
        this.cleanupRequest(response.id);
        break;

      case 'error':
        const error = response.payload?.cancelled 
          ? new WorkerCancellationError()
          : new WorkerError(response.payload?.error || 'Unknown worker error', 'GENERATION_ERROR', response.payload);
        
        pending.reject(error);
        this.cleanupRequest(response.id);
        break;

      case 'status':
      case 'pong':
        pending.resolve(response.payload?.status || response.payload);
        this.cleanupRequest(response.id);
        break;
    }
  }

  private handleWorkerError(error: ErrorEvent): void {
    const workerError = new WorkerError(`Worker error: ${error.message}`, 'WORKER_ERROR', {
      filename: error.filename,
      lineno: error.lineno,
      colno: error.colno
    });

    // Reject all pending requests from this worker
    this.pendingRequests.forEach(({ reject }) => {
      reject(workerError);
    });
    this.pendingRequests.clear();
  }

  private handleWorkerMessageError(event: MessageEvent): void {
    const error = new WorkerError(`Worker message error: ${event.data}`, 'MESSAGE_ERROR');

    // Reject all pending requests
    this.pendingRequests.forEach(({ reject }) => {
      reject(error);
    });
    this.pendingRequests.clear();
  }

  private cleanupRequest(requestId: string): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending?.timeout) {
      clearTimeout(pending.timeout);
    }
    this.pendingRequests.delete(requestId);
  }
}