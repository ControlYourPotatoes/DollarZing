// Virtual Dollar Pooling Integration Tests
// Tests real VirtualDollarManager and PooledVirtualDollarFactory integration
// Follows integration test philosophy: real core functionality, mock external dependencies

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  VirtualDollar,
  DollarState,
  BettingLevel,
} from "../src/types/virtual-dollar-engine";
import { VirtualDollarManager } from "../src/types/virtual-dollar-types";
import { PooledVirtualDollarFactory } from "../src/types/pooled-factories";
import { PerformanceConfig } from "../src/types/factory-interfaces";

// Mock only the environment check to enable object pooling for testing
vi.mock("../src/types/object-pool", async () => {
  const actual = await vi.importActual("../src/types/object-pool");
  return {
    ...actual,
    isObjectPoolingEnabled: vi.fn(() => true), // Enable pooling for tests
  };
});

describe("Virtual Dollar Pooling Integration", () => {
  let dollarManager: VirtualDollarManager;
  let pooledFactory: PooledVirtualDollarFactory;
  let config: PerformanceConfig;

  beforeEach(() => {
    // Create real instances
    dollarManager = new VirtualDollarManager();

    config = {
      enableObjectPooling: true,
      poolSizes: { virtualDollar: 1000, gameSession: 1000 },
      prewarmCounts: { virtualDollar: 100, gameSession: 100 },
      enableBatchOptimizations: true,
      enablePerformanceMetrics: true,
    };

    pooledFactory = new PooledVirtualDollarFactory(config);
  });

  describe("VirtualDollarManager with Object Pooling", () => {
    it("should create virtual dollars using object pooling", () => {
      const playerId = "test-player-1";

      // Create virtual dollar through manager (uses pooling internally)
      const dollar = dollarManager.createVirtualDollar(playerId);

      // Verify real dollar properties
      expect(dollar.id).toBeDefined();
      expect(dollar.serialNumber).toMatch(/^[A-Z]\d{8}[A-Z]$/);
      expect(dollar.ownerId).toBe(playerId);
      expect(dollar.state).toBe(DollarState.CREATED);
      expect(dollar.currentLevel).toBe(1);
      expect(dollar.potValue).toBe(1.0);

      // Verify real dollar creation worked
      expect(dollar.id).toMatch(/^vd_\d+_\w+$/);
      expect(dollar.runId).toMatch(/^run_\d+_\w+$/);
    });

    it("should manage dollar lifecycle with real state transitions", () => {
      const dollar = dollarManager.createVirtualDollar("player-1");

      // Test real state transitions
      const result1 = dollarManager.updateDollarState(
        dollar.id,
        DollarState.POOLED
      );
      expect(result1.isValid).toBe(true);
      expect(dollar.state).toBe(DollarState.POOLED);

      const result2 = dollarManager.updateDollarState(
        dollar.id,
        DollarState.IN_GAME
      );
      expect(result2.isValid).toBe(true);
      expect(dollar.state).toBe(DollarState.IN_GAME);

      const result3 = dollarManager.updateDollarState(
        dollar.id,
        DollarState.LOST
      );
      expect(result3.isValid).toBe(true);
      expect(dollar.state).toBe(DollarState.LOST);
    });

    it("should release dollars back to pool when in final state", () => {
      const dollar = dollarManager.createVirtualDollar("player-1");

      // Follow proper state transition: CREATED → POOLED → IN_GAME → LOST
      const pooledResult = dollarManager.updateDollarState(
        dollar.id,
        DollarState.POOLED
      );
      expect(pooledResult.isValid).toBe(true);

      const inGameResult = dollarManager.updateDollarState(
        dollar.id,
        DollarState.IN_GAME
      );
      expect(inGameResult.isValid).toBe(true);

      const lostResult = dollarManager.updateDollarState(
        dollar.id,
        DollarState.LOST
      );
      expect(lostResult.isValid).toBe(true);

      // Verify the dollar is in the correct final state
      const dollarAfterUpdate = dollarManager.getDollar(dollar.id);
      expect(dollarAfterUpdate?.state).toBe(DollarState.LOST);

      // Release back to pool
      dollarManager.releaseDollar(dollar.id);

      // Verify that the dollar was removed from the manager's tracking
      const retrievedDollar = dollarManager.getDollar(dollar.id);
      expect(retrievedDollar).toBeNull();
    });
  });

  describe("PooledVirtualDollarFactory Integration", () => {
    it("should create dollars through pooled factory", () => {
      const playerId = "factory-player-1";

      // Create through pooled factory
      const dollar = pooledFactory.create(playerId);

      // Verify real dollar properties
      expect(dollar.id).toBeDefined();
      expect(dollar.serialNumber).toMatch(/^[A-Z]\d{8}[A-Z]$/);
      expect(dollar.ownerId).toBe(playerId);
      expect(dollar.state).toBe(DollarState.CREATED);

      // Verify real dollar creation worked
      expect(dollar.id).toMatch(/^vd_\d+_\w+$/);
      expect(dollar.runId).toMatch(/^run_\d+_\w+$/);
    });

    it("should track factory statistics accurately", () => {
      const initialStats = pooledFactory.getStatistics();

      // Create some dollars
      const dollar1 = pooledFactory.create("player-1");
      const dollar2 = pooledFactory.create("player-2");

      const afterCreateStats = pooledFactory.getStatistics();
      expect(afterCreateStats.objectsCreated).toBe(
        initialStats.objectsCreated + 2
      );
      expect(afterCreateStats.objectsInUse).toBe(initialStats.objectsInUse + 2);

      // Release dollars
      pooledFactory.release(dollar1);
      pooledFactory.release(dollar2);

      const afterReleaseStats = pooledFactory.getStatistics();
      expect(afterReleaseStats.objectsReleased).toBe(
        initialStats.objectsReleased + 2
      );
      expect(afterReleaseStats.objectsInUse).toBe(initialStats.objectsInUse);
    });

    it("should handle batch operations efficiently", () => {
      const playerIds = ["batch-1", "batch-2", "batch-3", "batch-4", "batch-5"];

      const startTime = performance.now();
      const dollars = pooledFactory.createBatch(playerIds);
      const endTime = performance.now();

      expect(dollars).toHaveLength(5);

      // Should be reasonably fast with pooling
      expect(endTime - startTime).toBeLessThan(50); // Less than 50ms for 5 objects

      // Clean up
      dollars.forEach((dollar) => pooledFactory.release(dollar));
    });
  });

  describe("Pool Performance Integration", () => {
    it("should demonstrate pool hit rate improvements", () => {
      // Create and release multiple dollars to build up pool hit rate
      const dollars = [];

      // First batch - should miss pool
      for (let i = 0; i < 10; i++) {
        const dollar = pooledFactory.create(`player-${i}`);
        dollars.push(dollar);
      }

      // Release all to pool
      dollars.forEach((dollar) => pooledFactory.release(dollar));

      // Second batch - should hit pool
      const secondBatch = [];
      for (let i = 10; i < 20; i++) {
        const dollar = pooledFactory.create(`player-${i}`);
        secondBatch.push(dollar);
      }

      // Verify pool statistics show improvement
      const stats = pooledFactory.getStatistics();
      expect(stats.poolHitRate).toBeGreaterThan(0);

      // Clean up
      secondBatch.forEach((dollar) => pooledFactory.release(dollar));
    });

    it("should handle large batch operations efficiently", () => {
      // Test with a larger batch to verify performance
      const largeBatch = Array.from({ length: 50 }, (_, i) => `large-${i}`);

      const startTime = performance.now();
      const dollars = pooledFactory.createBatch(largeBatch);
      const endTime = performance.now();

      expect(dollars).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(200); // Should be fast with pooling

      // Clean up
      dollars.forEach((dollar) => pooledFactory.release(dollar));
    });
  });

  describe("Memory Management Integration", () => {
    it("should properly manage memory with large batches", () => {
      const initialStats = pooledFactory.getStatistics();

      // Create large batch
      const playerIds = Array.from({ length: 100 }, (_, i) => `bulk-${i}`);
      const dollars = pooledFactory.createBatch(playerIds);

      const afterCreateStats = pooledFactory.getStatistics();
      expect(afterCreateStats.objectsCreated).toBe(
        initialStats.objectsCreated + 100
      );
      expect(afterCreateStats.memoryUsageMB).toBeGreaterThan(
        initialStats.memoryUsageMB
      );

      // Release all
      dollars.forEach((dollar) => pooledFactory.release(dollar));

      const afterReleaseStats = pooledFactory.getStatistics();
      expect(afterReleaseStats.objectsInUse).toBe(initialStats.objectsInUse);
    });
  });
});
