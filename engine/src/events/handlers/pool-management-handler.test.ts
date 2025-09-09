import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventBus } from "../event-bus";
import { PoolManagementHandler } from "./pool-management-handler";
import { 
  ContinuePlayEvent, 
  CashOutCompletedEvent,
  EVENT_TYPES 
} from "../event-types";
import { DollarState } from "../../types/virtual-dollar-engine";

describe("PoolManagementHandler", () => {
  let eventBus: EventBus;
  let handler: PoolManagementHandler;
  let mockGameMatchingEngine: any;
  let mockDollarManager: any;

  beforeEach(() => {
    eventBus = new EventBus();

    // Mock GameMatchingEngine for pool operations
    mockGameMatchingEngine = {
      addToPool: vi.fn().mockReturnValue({ success: true }),
      getPoolStatistics: vi.fn().mockReturnValue({
        totalDollarsInPool: 0,
        availableForMatching: 0,
        dollarsInGame: 0,
      }),
      removeFromPool: vi.fn().mockReturnValue({ success: true }),
    };

    // Mock VirtualDollarManager for state management
    mockDollarManager = {
      updateDollarState: vi.fn(),
      getDollar: vi.fn(),
      createVirtualDollar: vi.fn(),
    };

    handler = new PoolManagementHandler(
      eventBus,
      mockGameMatchingEngine,
      mockDollarManager
    );
  });

  afterEach(() => {
    handler.dispose();
    eventBus.dispose();
  });

  describe("Re-pooling Scenarios", () => {
    it("should re-pool player who chooses to continue playing", async () => {
      const continueEvent: ContinuePlayEvent = {
        type: "CONTINUE_PLAY",
        timestamp: new Date(),
        playerId: "continue-player",
        virtualDollarId: "dollar-continue",
        currentLevel: 3,
        potentialWinnings: 7.2,
        nextLevel: 4,
        nextPotentialWinnings: 14.4,
      };

      // Mock getting the virtual dollar for re-pooling
      const mockVirtualDollar = {
        id: "dollar-continue",
        ownerId: "continue-player",
        currentLevel: 3,
        state: DollarState.WON,
      };
      mockDollarManager.getDollar.mockReturnValue(mockVirtualDollar);

      await eventBus.emit(EVENT_TYPES.CONTINUE_PLAY, continueEvent);

      // Verify dollar state was updated to POOLED
      expect(mockDollarManager.updateDollarState).toHaveBeenCalledWith(
        "dollar-continue",
        DollarState.POOLED
      );

      // Verify dollar was added back to the pool
      expect(mockGameMatchingEngine.addToPool).toHaveBeenCalledWith(
        mockVirtualDollar
      );
    });

    it("should handle multiple continue play events concurrently", async () => {
      const continueEvents = [
        {
          type: "CONTINUE_PLAY" as const,
          timestamp: new Date(),
          playerId: "player-1",
          virtualDollarId: "dollar-1",
          currentLevel: 2,
          potentialWinnings: 3.6,
          nextLevel: 3,
          nextPotentialWinnings: 7.2,
        },
        {
          type: "CONTINUE_PLAY" as const,
          timestamp: new Date(),
          playerId: "player-2",
          virtualDollarId: "dollar-2",
          currentLevel: 4,
          potentialWinnings: 14.4,
          nextLevel: 5,
          nextPotentialWinnings: 28.8,
        },
      ];

      // Mock virtual dollars
      mockDollarManager.getDollar
        .mockReturnValueOnce({
          id: "dollar-1",
          ownerId: "player-1",
          currentLevel: 2,
          state: DollarState.WON,
        })
        .mockReturnValueOnce({
          id: "dollar-2",
          ownerId: "player-2",
          currentLevel: 4,
          state: DollarState.WON,
        });

      // Emit both events
      await Promise.all([
        eventBus.emit(EVENT_TYPES.CONTINUE_PLAY, continueEvents[0]),
        eventBus.emit(EVENT_TYPES.CONTINUE_PLAY, continueEvents[1]),
      ]);

      // Verify both dollars were processed
      expect(mockDollarManager.updateDollarState).toHaveBeenCalledTimes(2);
      expect(mockGameMatchingEngine.addToPool).toHaveBeenCalledTimes(2);
    });

    it("should handle new run creation after cash-out", async () => {
      const cashOutEvent: CashOutCompletedEvent = {
        type: "CASH_OUT_COMPLETED",
        timestamp: new Date(),
        playerId: "cashout-player",
        virtualDollarId: "dollar-old",
        finalLevel: 5,
        totalWinnings: 28.8,
        cashOutAmount: 25.92,
        runCompleted: true,
        wasJackpot: false,
      };

      // Mock new run creation
      const mockNewRun = {
        id: "dollar-new",
        ownerId: "cashout-player",
        currentLevel: 1,
        state: DollarState.CREATED,
      };
      mockDollarManager.createVirtualDollar.mockReturnValue(mockNewRun);

      // Create spy for new run pooled event
      const newRunPooledSpy = vi.fn();
      const subscription = eventBus.on(EVENT_TYPES.NEW_RUN_POOLED, newRunPooledSpy);

      await eventBus.emit(EVENT_TYPES.CASH_OUT_COMPLETED, cashOutEvent);

      // Verify new run was created and added to pool
      expect(mockDollarManager.createVirtualDollar).toHaveBeenCalledWith(
        "cashout-player"
      );

      expect(mockDollarManager.updateDollarState).toHaveBeenCalledWith(
        "dollar-new",
        DollarState.POOLED
      );

      expect(mockGameMatchingEngine.addToPool).toHaveBeenCalledWith(mockNewRun);

      subscription.unsubscribe();
    });
  });

  describe("Pool State Management", () => {
    it("should handle pool capacity constraints", async () => {
      // Mock pool at capacity
      mockGameMatchingEngine.getPoolStatistics.mockReturnValue({
        totalDollarsInPool: 1000,
        availableForMatching: 1000,
        dollarsInGame: 0,
      });
      mockGameMatchingEngine.addToPool.mockReturnValue({
        success: false,
        error: "Pool at capacity",
      });

      const continueEvent: ContinuePlayEvent = {
        type: "CONTINUE_PLAY",
        timestamp: new Date(),
        playerId: "continue-player",
        virtualDollarId: "dollar-continue",
        currentLevel: 3,
        potentialWinnings: 7.2,
        nextLevel: 4,
        nextPotentialWinnings: 14.4,
      };

      const mockVirtualDollar = {
        id: "dollar-continue",
        ownerId: "continue-player",
        currentLevel: 3,
        state: DollarState.WON,
      };
      mockDollarManager.getDollar.mockReturnValue(mockVirtualDollar);

      // Create spy for pool capacity reached event
      const poolCapacitySpy = vi.fn();
      const subscription = eventBus.on(
        EVENT_TYPES.POOL_CAPACITY_REACHED,
        poolCapacitySpy
      );

      await eventBus.emit(EVENT_TYPES.CONTINUE_PLAY, continueEvent);

      // Verify error event was emitted
      expect(poolCapacitySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "POOL_CAPACITY_REACHED",
          reason: "Pool at capacity",
          currentPoolSize: 1000,
        })
      );

      subscription.unsubscribe();
    });

    it("should handle pool state synchronization errors", async () => {
      // Mock dollar manager error
      mockDollarManager.updateDollarState.mockImplementation(() => {
        throw new Error("State update failed");
      });

      const continueEvent: ContinuePlayEvent = {
        type: "CONTINUE_PLAY",
        timestamp: new Date(),
        playerId: "continue-player",
        virtualDollarId: "dollar-continue",
        currentLevel: 3,
        potentialWinnings: 7.2,
        nextLevel: 4,
        nextPotentialWinnings: 14.4,
      };

      const mockVirtualDollar = {
        id: "dollar-continue",
        ownerId: "continue-player",
        currentLevel: 3,
        state: DollarState.WON,
      };
      mockDollarManager.getDollar.mockReturnValue(mockVirtualDollar);

      // Create spy for pool management error event
      const errorSpy = vi.fn();
      const subscription = eventBus.on(
        EVENT_TYPES.POOL_MANAGEMENT_ERROR,
        errorSpy
      );

      await eventBus.emit(EVENT_TYPES.CONTINUE_PLAY, continueEvent);

      // Verify error event was emitted
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "POOL_MANAGEMENT_ERROR",
          virtualDollarId: "dollar-continue",
          error: "State update failed",
          operation: "RE_POOL_WINNER",
        })
      );

      subscription.unsubscribe();
    });
  });

  describe("Integration with GameMatchingEngine", () => {
    it("should successfully integrate with pool statistics tracking", async () => {
      // Mock initial pool stats
      mockGameMatchingEngine.getPoolStatistics.mockReturnValue({
        totalDollarsInPool: 50,
        availableForMatching: 45,
        dollarsInGame: 5,
      });

      const continueEvent: ContinuePlayEvent = {
        type: "CONTINUE_PLAY",
        timestamp: new Date(),
        playerId: "continue-player",
        virtualDollarId: "dollar-continue",
        currentLevel: 3,
        potentialWinnings: 7.2,
        nextLevel: 4,
        nextPotentialWinnings: 14.4,
      };

      const mockVirtualDollar = {
        id: "dollar-continue",
        ownerId: "continue-player",
        currentLevel: 3,
        state: DollarState.WON,
      };
      mockDollarManager.getDollar.mockReturnValue(mockVirtualDollar);

      // Mock updated pool stats after addition
      mockGameMatchingEngine.getPoolStatistics
        .mockReturnValueOnce({
          totalDollarsInPool: 50,
          availableForMatching: 45,
          dollarsInGame: 5,
        })
        .mockReturnValueOnce({
          totalDollarsInPool: 51,
          availableForMatching: 46,
          dollarsInGame: 5,
        });

      // Create spy for pool stats updated event
      const statsSpy = vi.fn();
      const subscription = eventBus.on(
        EVENT_TYPES.POOL_STATS_UPDATED,
        statsSpy
      );

      await eventBus.emit(EVENT_TYPES.CONTINUE_PLAY, continueEvent);

      // Verify pool stats were tracked and updated
      expect(mockGameMatchingEngine.getPoolStatistics).toHaveBeenCalledTimes(2);
      expect(statsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "POOL_STATS_UPDATED",
          previousStats: {
            totalDollarsInPool: 50,
            availableForMatching: 45,
            dollarsInGame: 5,
          },
          currentStats: {
            totalDollarsInPool: 51,
            availableForMatching: 46,
            dollarsInGame: 5,
          },
        })
      );

      subscription.unsubscribe();
    });

    it("should handle GameMatchingEngine integration failures", async () => {
      // Mock GameMatchingEngine failure
      mockGameMatchingEngine.addToPool.mockReturnValue({
        success: false,
        error: "Pool validation failed",
      });

      const continueEvent: ContinuePlayEvent = {
        type: "CONTINUE_PLAY",
        timestamp: new Date(),
        playerId: "continue-player",
        virtualDollarId: "dollar-continue",
        currentLevel: 3,
        potentialWinnings: 7.2,
        nextLevel: 4,
        nextPotentialWinnings: 14.4,
      };

      const mockVirtualDollar = {
        id: "dollar-continue",
        ownerId: "continue-player",
        currentLevel: 3,
        state: DollarState.WON,
      };
      mockDollarManager.getDollar.mockReturnValue(mockVirtualDollar);

      // Create spy for integration error event
      const errorSpy = vi.fn();
      const subscription = eventBus.on(
        EVENT_TYPES.POOL_MANAGEMENT_ERROR,
        errorSpy
      );

      await eventBus.emit(EVENT_TYPES.CONTINUE_PLAY, continueEvent);

      // Verify error event was emitted with integration details
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "POOL_MANAGEMENT_ERROR",
          virtualDollarId: "dollar-continue",
          error: "Pool validation failed",
          operation: "ADD_TO_POOL",
          integrationComponent: "GameMatchingEngine",
        })
      );

      subscription.unsubscribe();
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle missing virtual dollar gracefully", async () => {
      // Mock dollar not found
      mockDollarManager.getDollar.mockReturnValue(null);

      const continueEvent: ContinuePlayEvent = {
        type: "CONTINUE_PLAY",
        timestamp: new Date(),
        playerId: "continue-player",
        virtualDollarId: "missing-dollar",
        currentLevel: 3,
        potentialWinnings: 7.2,
        nextLevel: 4,
        nextPotentialWinnings: 14.4,
      };

      // Create spy for error event
      const errorSpy = vi.fn();
      const subscription = eventBus.on(
        EVENT_TYPES.POOL_MANAGEMENT_ERROR,
        errorSpy
      );

      await eventBus.emit(EVENT_TYPES.CONTINUE_PLAY, continueEvent);

      // Verify error was handled gracefully
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "POOL_MANAGEMENT_ERROR",
          virtualDollarId: "missing-dollar",
          error: "Virtual dollar not found",
          operation: "RE_POOL_WINNER",
        })
      );

      // Should not attempt to add to pool
      expect(mockGameMatchingEngine.addToPool).not.toHaveBeenCalled();

      subscription.unsubscribe();
    });

    it("should handle invalid dollar state for pooling", async () => {
      const continueEvent: ContinuePlayEvent = {
        type: "CONTINUE_PLAY",
        timestamp: new Date(),
        playerId: "continue-player",
        virtualDollarId: "dollar-continue",
        currentLevel: 3,
        potentialWinnings: 7.2,
        nextLevel: 4,
        nextPotentialWinnings: 14.4,
      };

      // Mock virtual dollar in invalid state for pooling
      const mockVirtualDollar = {
        id: "dollar-continue",
        ownerId: "continue-player",
        currentLevel: 3,
        state: DollarState.LOST, // Invalid state for re-pooling
      };
      mockDollarManager.getDollar.mockReturnValue(mockVirtualDollar);

      // Create spy for validation error event
      const errorSpy = vi.fn();
      const subscription = eventBus.on(
        EVENT_TYPES.POOL_MANAGEMENT_ERROR,
        errorSpy
      );

      await eventBus.emit(EVENT_TYPES.CONTINUE_PLAY, continueEvent);

      // Verify validation error was handled
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "POOL_MANAGEMENT_ERROR",
          virtualDollarId: "dollar-continue",
          error: "Invalid dollar state for pooling: lost",
          operation: "STATE_VALIDATION",
        })
      );

      // Should not attempt to update state or add to pool
      expect(mockDollarManager.updateDollarState).not.toHaveBeenCalled();
      expect(mockGameMatchingEngine.addToPool).not.toHaveBeenCalled();

      subscription.unsubscribe();
    });
  });
});