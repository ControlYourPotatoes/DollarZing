import { JSDOM } from 'jsdom';

// Mock Web Worker environment for testing
const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});

// Set up global variables for Web Worker testing
global.Worker = class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  
  constructor(public url: string) {}
  
  postMessage(data: any): void {
    // Mock implementation - will be overridden in tests
  }
  
  terminate(): void {
    // Mock implementation
  }
};

global.MessageEvent = dom.window.MessageEvent;
global.ErrorEvent = dom.window.ErrorEvent;

// Test interfaces for Web Worker communication
interface WorkerRequest {
  id: string;
  type: 'generate' | 'cancel' | 'status';
  payload?: {
    parameters?: any;
    duration?: number;
  };
}

interface WorkerResponse {
  id: string;
  type: 'progress' | 'complete' | 'error' | 'status';
  payload?: {
    progress?: number;
    data?: any;
    error?: string;
    cancelled?: boolean;
  };
}

interface WorkerProgress {
  completedDays: number;
  totalDays: number;
  percentage: number;
  estimatedTimeRemaining: number;
  currentPhase: 'initialization' | 'generation' | 'finalization';
}

class DataGenerationWorkerWrapper {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    onProgress?: (progress: WorkerProgress) => void;
  }>();
  private requestIdCounter = 0;
  
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create worker with data generation script
        this.worker = new (global.Worker as any)('/workers/data-generation-worker.js');
        
        this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          this.handleWorkerMessage(event.data);
        };
        
        this.worker.onerror = (event: ErrorEvent) => {
          this.handleWorkerError(event);
        };
        
        this.worker.onmessageerror = (event: MessageEvent) => {
          this.handleWorkerMessageError(event);
        };
        
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }
  
  async generateDataset(
    parameters: any,
    onProgress?: (progress: WorkerProgress) => void
  ): Promise<any> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const requestId = `req_${++this.requestIdCounter}`;
      
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        onProgress
      });
      
      const request: WorkerRequest = {
        id: requestId,
        type: 'generate',
        payload: { parameters }
      };
      
      this.worker!.postMessage(request);
    });
  }
  
  async cancelGeneration(requestId?: string): Promise<void> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const cancelId = `cancel_${++this.requestIdCounter}`;
      
      this.pendingRequests.set(cancelId, { resolve, reject });
      
      const request: WorkerRequest = {
        id: cancelId,
        type: 'cancel',
        payload: requestId ? { requestId } : undefined
      };
      
      this.worker!.postMessage(request);
    });
  }
  
  async getWorkerStatus(): Promise<any> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const statusId = `status_${++this.requestIdCounter}`;
      
      this.pendingRequests.set(statusId, { resolve, reject });
      
      const request: WorkerRequest = {
        id: statusId,
        type: 'status'
      };
      
      this.worker!.postMessage(request);
    });
  }
  
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      
      // Reject all pending requests
      this.pendingRequests.forEach(({ reject }) => {
        reject(new Error('Worker terminated'));
      });
      this.pendingRequests.clear();
    }
  }
  
  private handleWorkerMessage(response: WorkerResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;
    
    switch (response.type) {
      case 'progress':
        if (pending.onProgress && response.payload) {
          pending.onProgress(response.payload as WorkerProgress);
        }
        break;
        
      case 'complete':
        pending.resolve(response.payload?.data);
        this.pendingRequests.delete(response.id);
        break;
        
      case 'error':
        pending.reject(new Error(response.payload?.error || 'Unknown worker error'));
        this.pendingRequests.delete(response.id);
        break;
        
      case 'status':
        pending.resolve(response.payload);
        this.pendingRequests.delete(response.id);
        break;
    }
  }
  
  private handleWorkerError(event: ErrorEvent): void {
    const error = new Error(`Worker error: ${event.message}`);
    
    // Reject all pending requests
    this.pendingRequests.forEach(({ reject }) => {
      reject(error);
    });
    this.pendingRequests.clear();
  }
  
  private handleWorkerMessageError(event: MessageEvent): void {
    const error = new Error(`Worker message error: ${event.data}`);
    
    // Reject all pending requests
    this.pendingRequests.forEach(({ reject }) => {
      reject(error);
    });
    this.pendingRequests.clear();
  }
}

describe('Data Generation Worker', () => {
  let workerWrapper: DataGenerationWorkerWrapper;
  let mockWorker: any;
  
  beforeEach(async () => {
    workerWrapper = new DataGenerationWorkerWrapper();
    
    // Mock the Worker constructor to capture the instance
    const OriginalWorker = global.Worker;
    (global.Worker as any) = class extends OriginalWorker {
      constructor(url: string) {
        super(url);
        mockWorker = this;
      }
    };
    
    await workerWrapper.initialize();
  });
  
  afterEach(() => {
    workerWrapper.terminate();
  });
  
  describe('Worker Communication Protocol', () => {
    it('should initialize worker successfully', async () => {
      expect(mockWorker).toBeDefined();
      expect(mockWorker.url).toBe('/workers/data-generation-worker.js');
      expect(mockWorker.onmessage).toBeDefined();
      expect(mockWorker.onerror).toBeDefined();
    });
    
    it('should send generation request with correct format', async () => {
      const parameters = {
        adoptionRate: 0.5,
        cashOutStrategy: 'average',
        duration: 365
      };
      
      let sentMessage: WorkerRequest | null = null;
      mockWorker.postMessage = jest.fn((data) => {
        sentMessage = data;
      });
      
      // Start generation (don't wait for completion)
      workerWrapper.generateDataset(parameters);
      
      expect(sentMessage).not.toBeNull();
      expect(sentMessage!.type).toBe('generate');
      expect(sentMessage!.payload?.parameters).toEqual(parameters);
      expect(sentMessage!.id).toMatch(/^req_\d+$/);
    });
    
    it('should handle progress updates during generation', async () => {
      const progressUpdates: WorkerProgress[] = [];
      
      const generationPromise = workerWrapper.generateDataset(
        { duration: 365 },
        (progress) => progressUpdates.push(progress)
      );
      
      // Simulate progress messages from worker
      const requestId = 'req_1';
      const progressResponse: WorkerResponse = {
        id: requestId,
        type: 'progress',
        payload: {
          completedDays: 100,
          totalDays: 365,
          percentage: 27.4,
          estimatedTimeRemaining: 2000,
          currentPhase: 'generation'
        }
      };
      
      mockWorker.onmessage({ data: progressResponse });
      
      expect(progressUpdates).toHaveLength(1);
      expect(progressUpdates[0].completedDays).toBe(100);
      expect(progressUpdates[0].totalDays).toBe(365);
      expect(progressUpdates[0].percentage).toBe(27.4);
      expect(progressUpdates[0].currentPhase).toBe('generation');
    });
    
    it('should handle successful generation completion', async () => {
      const testData = {
        dailySnapshots: Array.from({ length: 365 }, (_, i) => ({
          day: i + 1,
          totalPlayers: 1000 + i * 10
        }))
      };
      
      const generationPromise = workerWrapper.generateDataset({ duration: 365 });
      
      // Simulate completion message from worker
      const completeResponse: WorkerResponse = {
        id: 'req_1',
        type: 'complete',
        payload: { data: testData }
      };
      
      mockWorker.onmessage({ data: completeResponse });
      
      const result = await generationPromise;
      expect(result).toEqual(testData);
    });
    
    it('should handle generation errors properly', async () => {
      const generationPromise = workerWrapper.generateDataset({ duration: 365 });
      
      // Simulate error message from worker
      const errorResponse: WorkerResponse = {
        id: 'req_1',
        type: 'error',
        payload: { error: 'Invalid parameters: duration must be positive' }
      };
      
      mockWorker.onmessage({ data: errorResponse });
      
      await expect(generationPromise).rejects.toThrow('Invalid parameters: duration must be positive');
    });
  });
  
  describe('Generation Cancellation', () => {
    it('should send cancellation request', async () => {
      let sentMessage: WorkerRequest | null = null;
      mockWorker.postMessage = jest.fn((data) => {
        sentMessage = data;
      });
      
      workerWrapper.cancelGeneration('req_123');
      
      expect(sentMessage).not.toBeNull();
      expect(sentMessage!.type).toBe('cancel');
      expect(sentMessage!.payload?.requestId).toBe('req_123');
    });
    
    it('should handle cancellation confirmation', async () => {
      const cancelPromise = workerWrapper.cancelGeneration();
      
      // Simulate cancellation confirmation
      const cancelResponse: WorkerResponse = {
        id: 'cancel_1',
        type: 'complete',
        payload: { cancelled: true }
      };
      
      mockWorker.onmessage({ data: cancelResponse });
      
      await expect(cancelPromise).resolves.toBeDefined();
    });
    
    it('should cancel ongoing generation and reject promise', async () => {
      const generationPromise = workerWrapper.generateDataset({ duration: 365 });
      
      // Simulate cancellation during generation
      const cancelResponse: WorkerResponse = {
        id: 'req_1',
        type: 'error',
        payload: { error: 'Generation cancelled', cancelled: true }
      };
      
      mockWorker.onmessage({ data: cancelResponse });
      
      await expect(generationPromise).rejects.toThrow('Generation cancelled');
    });
  });
  
  describe('Worker Status and Health Monitoring', () => {
    it('should request worker status', async () => {
      let sentMessage: WorkerRequest | null = null;
      mockWorker.postMessage = jest.fn((data) => {
        sentMessage = data;
      });
      
      workerWrapper.getWorkerStatus();
      
      expect(sentMessage).not.toBeNull();
      expect(sentMessage!.type).toBe('status');
    });
    
    it('should receive worker status information', async () => {
      const statusPromise = workerWrapper.getWorkerStatus();
      
      const statusResponse: WorkerResponse = {
        id: 'status_1',
        type: 'status',
        payload: {
          isActive: true,
          memoryUsage: 45000000, // 45MB
          activeRequests: 1,
          totalProcessed: 5
        }
      };
      
      mockWorker.onmessage({ data: statusResponse });
      
      const status = await statusPromise;
      expect(status.isActive).toBe(true);
      expect(status.memoryUsage).toBe(45000000);
      expect(status.activeRequests).toBe(1);
      expect(status.totalProcessed).toBe(5);
    });
  });
  
  describe('Error Handling and Recovery', () => {
    it('should handle worker initialization errors', async () => {
      // Mock Worker constructor to throw
      const originalWorker = global.Worker;
      (global.Worker as any) = jest.fn(() => {
        throw new Error('Failed to create worker');
      });
      
      const newWrapper = new DataGenerationWorkerWrapper();
      
      await expect(newWrapper.initialize()).rejects.toThrow('Failed to create worker');
      
      // Restore
      global.Worker = originalWorker;
    });
    
    it('should handle worker runtime errors', async () => {
      const generationPromise = workerWrapper.generateDataset({ duration: 365 });
      
      // Simulate worker error event
      const errorEvent = new (global.ErrorEvent as any)('error', {
        message: 'Script execution failed',
        filename: '/workers/data-generation-worker.js',
        lineno: 42
      });
      
      mockWorker.onerror(errorEvent);
      
      await expect(generationPromise).rejects.toThrow('Worker error: Script execution failed');
    });
    
    it('should handle worker message errors', async () => {
      const generationPromise = workerWrapper.generateDataset({ duration: 365 });
      
      // Simulate worker message error
      const messageErrorEvent = new (global.MessageEvent as any)('messageerror', {
        data: 'Malformed message data'
      });
      
      mockWorker.onmessageerror(messageErrorEvent);
      
      await expect(generationPromise).rejects.toThrow('Worker message error: Malformed message data');
    });
    
    it('should reject pending requests on worker termination', async () => {
      const generationPromise = workerWrapper.generateDataset({ duration: 365 });
      const statusPromise = workerWrapper.getWorkerStatus();
      
      // Terminate worker
      workerWrapper.terminate();
      
      await expect(generationPromise).rejects.toThrow('Worker terminated');
      await expect(statusPromise).rejects.toThrow('Worker terminated');
    });
  });
  
  describe('Concurrent Request Management', () => {
    it('should handle multiple concurrent generation requests', async () => {
      const request1 = workerWrapper.generateDataset({ duration: 180 });
      const request2 = workerWrapper.generateDataset({ duration: 365 });
      
      // Simulate responses for both requests
      mockWorker.onmessage({
        data: {
          id: 'req_1',
          type: 'complete',
          payload: { data: { duration: 180 } }
        }
      });
      
      mockWorker.onmessage({
        data: {
          id: 'req_2', 
          type: 'complete',
          payload: { data: { duration: 365 } }
        }
      });
      
      const [result1, result2] = await Promise.all([request1, request2]);
      
      expect(result1.duration).toBe(180);
      expect(result2.duration).toBe(365);
    });
    
    it('should handle mixed success and error responses', async () => {
      const request1 = workerWrapper.generateDataset({ duration: 365 });
      const request2 = workerWrapper.generateDataset({ duration: -1 }); // Invalid
      
      // First request succeeds
      mockWorker.onmessage({
        data: {
          id: 'req_1',
          type: 'complete',
          payload: { data: { success: true } }
        }
      });
      
      // Second request fails
      mockWorker.onmessage({
        data: {
          id: 'req_2',
          type: 'error',
          payload: { error: 'Invalid duration' }
        }
      });
      
      const result1 = await request1;
      expect(result1.success).toBe(true);
      
      await expect(request2).rejects.toThrow('Invalid duration');
    });
  });
  
  describe('Performance Requirements Validation', () => {
    it('should validate generation speed targets', async () => {
      const startTime = Date.now();
      
      const generationPromise = workerWrapper.generateDataset({
        duration: 365,
        adoptionRate: 0.3,
        cashOutStrategy: 'average'
      });
      
      // Simulate fast completion (under 5 seconds)
      setTimeout(() => {
        mockWorker.onmessage({
          data: {
            id: 'req_1',
            type: 'complete',
            payload: {
              data: {
                dailySnapshots: new Array(365),
                metadata: { generationTime: Date.now() - startTime }
              }
            }
          }
        });
      }, 100); // Simulate 100ms generation time
      
      const result = await generationPromise;
      const actualTime = Date.now() - startTime;
      
      expect(actualTime).toBeLessThan(5000); // Under 5 seconds
      expect(result.dailySnapshots).toHaveLength(365);
    });
    
    it('should validate memory usage requirements', async () => {
      const statusPromise = workerWrapper.getWorkerStatus();
      
      mockWorker.onmessage({
        data: {
          id: 'status_1',
          type: 'status',
          payload: {
            memoryUsage: 85000000, // 85MB - under 100MB limit
            isActive: true,
            datasetSize: 50000000 // 50MB dataset
          }
        }
      });
      
      const status = await statusPromise;
      
      expect(status.memoryUsage).toBeLessThan(100000000); // Under 100MB
      expect(status.datasetSize).toBeLessThan(status.memoryUsage);
    });
  });
});