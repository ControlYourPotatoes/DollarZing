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
  private maxDispatchDepth = 1000;

  constructor(options: EventBusOptions = {}) {
    this.traceEnabled = options.enableTracing ?? false;
    this.maxListeners = options.maxListeners ?? 100;
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

      if (!this.isDispatching) {
        this.isDispatching = true;
        this.processQueue();
      }
    });
  }

  private processQueue(): void {
    const next = (): void => {
      if (this.dispatchQueue.length === 0) {
        this.isDispatching = false;
        return;
      }

      const { type, data, resolve, reject } = this.dispatchQueue.shift()!;

      try {
        const task = this.dispatchEvent(type, data);
        task
          .then(() => {
            resolve();
            next();
          })
          .catch((error) => {
            reject(error);
            next();
          });
      } catch (error) {
        reject(error);
        next();
      }
    };

    next();
  }

  private async dispatchEvent<T>(eventType: string, data: T): Promise<void> {
    if (this.activeDispatchDepth > this.maxDispatchDepth) {
      throw new Error(
        `Max event dispatch depth (${this.maxDispatchDepth}) exceeded for ${eventType}`
      );
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
      const promises: Promise<void>[] = [];

      for (const { handler } of settledHandlers) {
        try {
          const result = handler(data);
          if (result instanceof Promise) {
            promises.push(result);
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

      if (promises.length > 0) {
        try {
          await Promise.all(promises);
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
      }
    } finally {
      this.activeDispatchDepth--;
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
}
