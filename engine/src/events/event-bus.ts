/**
 * Event Bus Implementation for Event-Driven Simulation Architecture
 * Provides typed event publishing, subscription management, and error handling
 */

import { EVENT_TYPES } from "./event-types";

export type EventHandler<T = any> = (event: T) => void | Promise<void>;
export type EventHandlerWithPriority<T = any> = {
  handler: EventHandler<T>;
  priority: number; // Higher numbers execute first
};

export interface EventSubscription {
  eventType: string;
  unsubscribe: () => void;
}

export interface EventBusOptions {
  enableTracing?: boolean;
  maxListeners?: number;
}

const DEFAULT_MAX_LISTENERS = 100;
const MAX_QUEUE_FLUSH = 2000;
const MAX_DISPATCH_DEPTH = 5000; // Increased from 400 to handle multi-day simulations (365 days × ~10-15 depth per day)

/**
 * Central event dispatcher using publish-subscribe pattern with typed events
 */
export class EventBus {
  private listeners: Map<string, EventHandlerWithPriority[]> = new Map();
  private traceEnabled: boolean;
  private maxListeners: number;
  private eventTrace: Array<{ type: string; timestamp: Date; data: any }> = [];
  private dispatchQueue: Array<{
    type: string;
    data: unknown;
    resolve: () => void;
    reject: (reason: unknown) => void;
  }> = [];
  private isDispatching = false;
  private activeDispatchDepth = 0;
  private maxDispatchDepth = MAX_DISPATCH_DEPTH;

  constructor(options: EventBusOptions = {}) {
    this.traceEnabled = options.enableTracing ?? false;
    this.maxListeners = options.maxListeners ?? DEFAULT_MAX_LISTENERS;
  }

  /**
   * Subscribe to events of a specific type with optional priority
   */
  on<T>(
    eventType: string,
    handler: EventHandler<T>,
    priority: number = 0
  ): EventSubscription {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    const handlers = this.listeners.get(eventType)!;

    // Check listener limit
    if (handlers.length >= this.maxListeners) {
      throw new Error(
        `Maximum listener limit (${this.maxListeners}) reached for event type: ${eventType}`
      );
    }

    const handlerWithPriority: EventHandlerWithPriority<T> = {
      handler,
      priority,
    };
    handlers.push(handlerWithPriority);

    // Sort by priority (higher numbers first)
    handlers.sort((a, b) => b.priority - a.priority);

    if (this.traceEnabled) {
      console.log(
        `[EventBus] Subscribed to ${eventType} with priority ${priority}`
      );
    }

    // Return subscription object
    return {
      eventType,
      unsubscribe: () => this.off(eventType, handler),
    };
  }

  /**
   * Unsubscribe from events
   */
  off<T>(eventType: string, handler: EventHandler<T>): void {
    const handlers = this.listeners.get(eventType);
    if (!handlers) return;

    const index = handlers.findIndex((h) => h.handler === handler);
    if (index !== -1) {
      handlers.splice(index, 1);

      // Remove empty arrays to prevent memory leaks
      if (handlers.length === 0) {
        this.listeners.delete(eventType);
      }

      if (this.traceEnabled) {
        console.log(`[EventBus] Unsubscribed from ${eventType}`);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   */
  async emit<T>(eventType: string, data: T): Promise<void> {
    return new Promise((resolve, reject) => {
      this.dispatchQueue.push({ type: eventType, data, resolve, reject });
      if (this.traceEnabled) {
        console.log(
          `[EventBus][emit] queued ${eventType}, queue length now ${this.dispatchQueue.length}`
        );
      }

      if (!this.isDispatching) {
        this.isDispatching = true;
        this.processQueue();
      }
    });
  }

  private processQueue(): void {
    if (this.traceEnabled) {
      console.log(
        `[EventBus][processQueue] starting with queue length ${this.dispatchQueue.length}`
      );
    }
    let processed = 0;
    const pump = (): void => {
      if (this.dispatchQueue.length === 0) {
        this.isDispatching = false;
        return;
      }

      const { type, data, resolve, reject } = this.dispatchQueue.shift()!;
      if (this.traceEnabled) {
        console.log(
          `[EventBus][processQueue] dispatching ${type}, remaining ${this.dispatchQueue.length}`
        );
      }

      const finish = (): void => {
        processed += 1;
        if (processed % MAX_QUEUE_FLUSH === 0) {
          setTimeout(pump, 0);
        } else {
          pump();
        }
      };

      try {
        const task = this.dispatchEvent(type, data);
        task
          .then(() => {
            resolve();
            finish();
          })
          .catch((error) => {
            reject(error);
            finish();
          });
      } catch (error) {
        reject(error);
        finish();
      }
    };

    pump();
  }

  private async dispatchEvent<T>(eventType: string, data: T): Promise<void> {
    if (this.traceEnabled) {
      console.log(
        `[EventBus][dispatchEvent] begin ${eventType}, depth ${this.activeDispatchDepth}`
      );
    }
    if (this.activeDispatchDepth > this.maxDispatchDepth) {
      console.warn(
        `[EventBus] Dispatch depth ${this.activeDispatchDepth} exceeded max ${this.maxDispatchDepth} for ${eventType}. Switching to iterative flush.`
      );
      return this.flushHandlersIteratively(eventType, data);
    }

    this.activeDispatchDepth++;

    try {
      if (this.traceEnabled) {
        console.log(`[EventBus] Emitting ${eventType}:`, data);
        this.eventTrace.push({
          type: eventType,
          timestamp: new Date(),
          data,
        });
      }

      const handlers = this.listeners.get(eventType);
      if (!handlers || handlers.length === 0) {
        if (this.traceEnabled) {
          console.log(`[EventBus] No handlers for ${eventType}`);
        }
        return;
      }

      const settledHandlers = handlers.slice();
      const asyncHandlers: Array<Promise<void>> = [];

      for (const { handler } of settledHandlers) {
        if (this.traceEnabled) {
          console.log(
            `[EventBus][dispatchEvent] executing handler for ${eventType}`
          );
        }
        try {
          const result = handler(data);
          if (result instanceof Promise) {
            asyncHandlers.push(result.then(() => undefined));
          }
        } catch (error) {
          console.error(`[EventBus] Error in handler for ${eventType}:`, error);
          this.emitSync(EVENT_TYPES.EVENT_ERROR, {
            eventType,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date(),
          });
        }
      }

      if (asyncHandlers.length > 0) {
        await this.resolveAsyncHandlers(eventType, asyncHandlers);
      }
    } finally {
      if (this.traceEnabled) {
        console.log(
          `[EventBus][dispatchEvent] end ${eventType}, depth ${this.activeDispatchDepth}`
        );
      }
      this.activeDispatchDepth--;
    }
  }

  private async resolveAsyncHandlers(
    eventType: string,
    handlers: Array<Promise<void>>
  ): Promise<void> {
    const chunkSize = 20;
    let index = 0;
    while (index < handlers.length) {
      const slice = handlers.slice(index, index + chunkSize);
      try {
        await Promise.all(slice);
      } catch (error) {
        console.error(
          `[EventBus] Error in async handlers for ${eventType}:`,
          error
        );
        this.emitSync(EVENT_TYPES.EVENT_ERROR, {
          eventType,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
        });
      }
      index += chunkSize;
      if (index < handlers.length) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  private async flushHandlersIteratively<T>(
    eventType: string,
    data: T
  ): Promise<void> {
    const handlers = this.listeners.get(eventType);
    if (!handlers || handlers.length === 0) {
      return;
    }

    const queue = handlers.slice();
    while (queue.length > 0) {
      const current = queue.shift()!;
      try {
        const result = current.handler(data);
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        console.error(`[EventBus] Error in handler for ${eventType}:`, error);
        this.emitSync(EVENT_TYPES.EVENT_ERROR, {
          eventType,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
        });
      }

      if (queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  /**
   * Emit an event synchronously (for error events to avoid recursion)
   */
  private emitSync<T>(eventType: string, data: T): void {
    const handlers = this.listeners.get(eventType);
    if (!handlers) return;

    for (const { handler } of handlers) {
      try {
        const result = handler(data);
        if (result instanceof Promise) {
          result.catch((error) =>
            console.error(
              `[EventBus] Unhandled async error in ${eventType}:`,
              error
            )
          );
        }
      } catch (error) {
        console.error(
          `[EventBus] Error in sync handler for ${eventType}:`,
          error
        );
      }
    }
  }

  /**
   * Subscribe to an event once, then automatically unsubscribe
   */
  once<T>(
    eventType: string,
    handler: EventHandler<T>,
    priority: number = 0
  ): EventSubscription {
    const onceHandler: EventHandler<T> = (data) => {
      subscription.unsubscribe();
      return handler(data);
    };

    const subscription = this.on(eventType, onceHandler, priority);
    return subscription;
  }

  /**
   * Get event trace for debugging (only if tracing enabled)
   */
  getEventTrace(): Array<{ type: string; timestamp: Date; data: any }> {
    return [...this.eventTrace];
  }

  /**
   * Clear event trace
   */
  clearEventTrace(): void {
    this.eventTrace = [];
  }

  /**
   * Remove all listeners and clean up
   */
  dispose(): void {
    if (this.traceEnabled) {
      console.log("[EventBus] Disposing - clearing all listeners");
    }
    this.listeners.clear();
    this.eventTrace = [];
  }

  /**
   * Get total number of active listeners
   */
  getListenerCount(): number {
    let total = 0;
    for (const handlers of this.listeners.values()) {
      total += handlers.length;
    }
    return total;
  }

  getListeners(): Map<string, number> {
    const summary = new Map<string, number>();
    for (const [eventType, handlers] of this.listeners.entries()) {
      summary.set(eventType, handlers.length);
    }
    return summary;
  }

  /**
   * Clear all listeners for a specific event type
   */
  clearListeners(eventType: string): void {
    this.listeners.delete(eventType);
    if (this.traceEnabled) {
      console.log(`[EventBus] Cleared all listeners for ${eventType}`);
    }
  }

  /**
   * Clear ALL listeners from the event bus (use for cleanup between days/scenarios)
   */
  clearAllListeners(): void {
    const count = Array.from(this.listeners.values()).reduce(
      (sum, handlers) => sum + handlers.length,
      0
    );
    this.listeners.clear();
    if (this.traceEnabled) {
      console.log(`[EventBus] Cleared all ${count} listeners`);
    }
  }
}
