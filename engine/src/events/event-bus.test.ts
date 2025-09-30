/**
 * Tests for EventBus class - Core Event System Infrastructure
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { EventBus } from "./event-bus";
import { GameResolvedEvent, EVENT_TYPES } from "./event-types";

describe("EventBus", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus({ enableTracing: true });
  });

  afterEach(() => {
    eventBus.dispose();
  });

  describe("Basic Event Handling", () => {
    it("should subscribe and emit events correctly", async () => {
      const mockHandler = vi.fn();
      const testEvent = {
        type: "TEST_EVENT",
        data: "test data",
        timestamp: new Date(),
      };

      eventBus.on("TEST_EVENT", mockHandler);
      await eventBus.emit("TEST_EVENT", testEvent);

      expect(mockHandler).toHaveBeenCalledOnce();
      expect(mockHandler).toHaveBeenCalledWith(testEvent);
    });

    it("should handle multiple subscribers for the same event", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const testEvent = {
        type: "TEST_EVENT",
        data: "test",
        timestamp: new Date(),
      };

      eventBus.on("TEST_EVENT", handler1);
      eventBus.on("TEST_EVENT", handler2);
      await eventBus.emit("TEST_EVENT", testEvent);

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it("should not call handlers for different event types", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on("EVENT_A", handler1);
      eventBus.on("EVENT_B", handler2);
      await eventBus.emit("EVENT_A", {
        type: "EVENT_A",
        timestamp: new Date(),
      });

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe("Priority Ordering", () => {
    it("should execute handlers in priority order (higher numbers first)", async () => {
      const executionOrder: number[] = [];

      const handler1 = vi.fn(() => {
        executionOrder.push(1);
      });
      const handler2 = vi.fn(() => {
        executionOrder.push(2);
      });
      const handler3 = vi.fn(() => {
        executionOrder.push(3);
      });

      eventBus.on("TEST_EVENT", handler1, 1); // Low priority
      eventBus.on("TEST_EVENT", handler2, 10); // High priority
      eventBus.on("TEST_EVENT", handler3, 5); // Medium priority

      await eventBus.emit("TEST_EVENT", {
        type: "TEST_EVENT",
        timestamp: new Date(),
      });

      expect(executionOrder).toEqual([2, 3, 1]); // Handler2 (10), Handler3 (5), Handler1 (1)
    });

    it("should handle handlers with same priority in registration order", async () => {
      const executionOrder: string[] = [];

      const handler1 = vi.fn(() => {
        executionOrder.push("first");
      });
      const handler2 = vi.fn(() => {
        executionOrder.push("second");
      });

      eventBus.on("TEST_EVENT", handler1, 5);
      eventBus.on("TEST_EVENT", handler2, 5);

      await eventBus.emit("TEST_EVENT", {
        type: "TEST_EVENT",
        timestamp: new Date(),
      });

      expect(executionOrder).toEqual(["first", "second"]);
    });
  });

  describe("Subscription Management", () => {
    it("should return subscription object with unsubscribe method", () => {
      const handler = vi.fn();
      const subscription = eventBus.on("TEST_EVENT", handler);

      expect(subscription).toHaveProperty("eventType", "TEST_EVENT");
      expect(subscription).toHaveProperty("unsubscribe");
      expect(typeof subscription.unsubscribe).toBe("function");
    });

    it("should unsubscribe handlers correctly", async () => {
      const handler = vi.fn();
      const subscription = eventBus.on("TEST_EVENT", handler);

      subscription.unsubscribe();
      await eventBus.emit("TEST_EVENT", {
        type: "TEST_EVENT",
        timestamp: new Date(),
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it("should clean up empty listener arrays after unsubscribing", () => {
      const handler = vi.fn();
      eventBus.on("TEST_EVENT", handler);

      expect(eventBus.getListeners().get("TEST_EVENT")).toBe(1);

      eventBus.off("TEST_EVENT", handler);

      expect(eventBus.getListeners().has("TEST_EVENT")).toBe(false);
    });

    it("should handle unsubscribing non-existent handlers gracefully", () => {
      const handler = vi.fn();

      // Should not throw
      expect(() => eventBus.off("NON_EXISTENT", handler)).not.toThrow();
    });
  });

  describe("Once Subscription", () => {
    it("should execute handler only once then automatically unsubscribe", async () => {
      const handler = vi.fn();
      eventBus.once("TEST_EVENT", handler);

      await eventBus.emit("TEST_EVENT", {
        type: "TEST_EVENT",
        timestamp: new Date(),
      });
      await eventBus.emit("TEST_EVENT", {
        type: "TEST_EVENT",
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalledOnce();
      expect(eventBus.getListeners().has("TEST_EVENT")).toBe(false);
    });
  });

  describe("Async Handler Support", () => {
    it("should handle async handlers correctly", async () => {
      const asyncHandler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      eventBus.on("TEST_EVENT", asyncHandler);
      await eventBus.emit("TEST_EVENT", {
        type: "TEST_EVENT",
        timestamp: new Date(),
      });

      expect(asyncHandler).toHaveBeenCalledOnce();
    });

    it("should wait for all async handlers to complete", async () => {
      let completed = 0;
      const createAsyncHandler = (delay: number) =>
        vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          completed++;
        });

      const handler1 = createAsyncHandler(20);
      const handler2 = createAsyncHandler(10);

      eventBus.on("TEST_EVENT", handler1);
      eventBus.on("TEST_EVENT", handler2);

      await eventBus.emit("TEST_EVENT", {
        type: "TEST_EVENT",
        timestamp: new Date(),
      });

      expect(completed).toBe(2);
    });

    it("should process re-entrant emissions without stack overflow", async () => {
      let remaining = 5;
      const handler = vi.fn(() => {
        remaining--;
        if (remaining > 0) {
          void eventBus.emit("TEST_EVENT", {
            type: "TEST_EVENT",
            timestamp: new Date(),
          });
        }
      });

      eventBus.on("TEST_EVENT", handler);

      await eventBus.emit("TEST_EVENT", {
        type: "TEST_EVENT",
        timestamp: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(handler).toHaveBeenCalledTimes(5);
      expect(remaining).toBe(0);
    });
  });

  describe("Error Handling", () => {
    it("should catch and log handler errors without stopping other handlers", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const errorHandler = vi.fn(() => {
        throw new Error("Test error");
      });
      const normalHandler = vi.fn();

      eventBus.on("TEST_EVENT", errorHandler);
      eventBus.on("TEST_EVENT", normalHandler);

      await eventBus.emit("TEST_EVENT", {
        type: "TEST_EVENT",
        timestamp: new Date(),
      });

      expect(errorHandler).toHaveBeenCalledOnce();
      expect(normalHandler).toHaveBeenCalledOnce();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should emit EVENT_ERROR when handler throws", async () => {
      const errorHandler = vi.fn(() => {
        throw new Error("Test error");
      });
      const eventErrorHandler = vi.fn();

      eventBus.on("EVENT_ERROR", eventErrorHandler);
      eventBus.on("TEST_EVENT", errorHandler);

      await eventBus.emit("TEST_EVENT", {
        type: "TEST_EVENT",
        timestamp: new Date(),
      });

      expect(eventErrorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "TEST_EVENT",
          error: "Test error",
        })
      );
    });

    it("should handle async handler errors", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const asyncErrorHandler = vi.fn(async () => {
        throw new Error("Async test error");
      });

      eventBus.on("TEST_EVENT", asyncErrorHandler);
      await eventBus.emit("TEST_EVENT", {
        type: "TEST_EVENT",
        timestamp: new Date(),
      });

      expect(asyncErrorHandler).toHaveBeenCalledOnce();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Event Tracing", () => {
    it("should trace events when tracing is enabled", async () => {
      const testEvent = {
        type: "TEST_EVENT",
        data: "trace test",
        timestamp: new Date(),
      };

      await eventBus.emit("TEST_EVENT", testEvent);

      const trace = eventBus.getEventTrace();
      expect(trace).toHaveLength(1);
      expect(trace[0]).toMatchObject({
        type: "TEST_EVENT",
        data: testEvent,
      });
      expect(trace[0].timestamp).toBeInstanceOf(Date);
    });

    it("should clear event trace", async () => {
      await eventBus.emit("TEST_EVENT", {
        type: "TEST_EVENT",
        timestamp: new Date(),
      });
      expect(eventBus.getEventTrace()).toHaveLength(1);

      eventBus.clearEventTrace();
      expect(eventBus.getEventTrace()).toHaveLength(0);
    });

    it("should not trace events when tracing is disabled", async () => {
      const noTraceEventBus = new EventBus({ enableTracing: false });

      await noTraceEventBus.emit("TEST_EVENT", {
        type: "TEST_EVENT",
        timestamp: new Date(),
      });

      expect(noTraceEventBus.getEventTrace()).toHaveLength(0);
      noTraceEventBus.dispose();
    });
  });

  describe("Listener Limits", () => {
    it("should enforce maximum listener limit", () => {
      const limitedEventBus = new EventBus({ maxListeners: 2 });

      limitedEventBus.on("TEST_EVENT", vi.fn());
      limitedEventBus.on("TEST_EVENT", vi.fn());

      expect(() => limitedEventBus.on("TEST_EVENT", vi.fn())).toThrow(
        "Maximum listener limit (2) reached for event type: TEST_EVENT"
      );

      limitedEventBus.dispose();
    });
  });

  describe("Memory Management", () => {
    it("should dispose all listeners and traces", () => {
      const handler = vi.fn();
      eventBus.on("TEST_EVENT", handler);
      eventBus.emit("TEST_EVENT", {
        type: "TEST_EVENT",
        timestamp: new Date(),
      });

      expect(eventBus.getListenerCount()).toBeGreaterThan(0);
      expect(eventBus.getEventTrace().length).toBeGreaterThan(0);

      eventBus.dispose();

      expect(eventBus.getListenerCount()).toBe(0);
      expect(eventBus.getEventTrace()).toHaveLength(0);
    });

    it("should provide listener count information", () => {
      expect(eventBus.getListenerCount()).toBe(0);

      eventBus.on("EVENT_A", vi.fn());
      eventBus.on("EVENT_A", vi.fn());
      eventBus.on("EVENT_B", vi.fn());

      expect(eventBus.getListenerCount()).toBe(3);

      const listeners = eventBus.getListeners();
      expect(listeners.get("EVENT_A")).toBe(2);
      expect(listeners.get("EVENT_B")).toBe(1);
    });
  });

  describe("Type Safety with Simulation Events", () => {
    it("should work with typed simulation events", async () => {
      const handler = vi.fn();

      eventBus.on<GameResolvedEvent>(EVENT_TYPES.GAME_RESOLVED, handler);

      const gameEvent: GameResolvedEvent = {
        type: EVENT_TYPES.GAME_RESOLVED,
        timestamp: new Date(),
        gameId: "game-123",
        winnerId: "player-1",
        loserId: "player-2",
        winnerLevel: 3,
        loserLevel: 2,
        winnerDollarId: "dollar-1",
        loserDollarId: "dollar-2",
        winnings: 100,
        gameResult: "WIN",
      };

      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameEvent);

      expect(handler).toHaveBeenCalledWith(gameEvent);
    });
  });
});
