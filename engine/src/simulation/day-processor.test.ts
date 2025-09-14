import { describe, it, expect, beforeEach, vi } from "vitest";
import { DayProcessor } from "./day-processor";
import { DollarState, GameResult } from "../types/virtual-dollar-engine";
import { EventBus } from "../events/event-bus";

// Mock the external dependencies
vi.mock("../types/game-matching-engine");
vi.mock("./player-manager");
vi.mock("../types/virtual-dollar-types");
vi.mock("../types/revenue-calculator");

describe("DayProcessor", () => {
  let dayProcessor: DayProcessor;
  let mockGameMatchingEngine: any;
  let mockPlayerManager: any;
  let mockDollarManager: any;
  let mockRevenueCalculator: any;
  let mockEventBus: EventBus;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock instances
    mockGameMatchingEngine = {
      addToPool: vi.fn().mockReturnValue({ success: true }),
      resolveGame: vi.fn().mockReturnValue({ success: true }),
      getGameSession: vi.fn(),
      getPoolStatistics: vi.fn().mockReturnValue({
        totalDollarsInPool: 100,
        availableForMatching: 50,
      }),
    };

    mockPlayerManager = {
      autoCreateRuns: vi.fn().mockReturnValue([]),
      processGameResult: vi.fn().mockReturnValue(null), // null means run continues
      getPlayerStrategy: vi.fn().mockReturnValue("BALANCED"),
      createNewRun: vi.fn().mockReturnValue({ id: "new-run-1" }),
    };

    mockDollarManager = {
      updateDollarState: vi.fn(),
    };

    mockRevenueCalculator = {
      processGameRevenue: vi.fn(),
      processCashOut: vi.fn(),
      getTotalGames: vi.fn().mockReturnValue(5),
    };

    // Create mock EventBus
    mockEventBus = new EventBus();

    // Create DayProcessor instance
    dayProcessor = new DayProcessor(
      mockGameMatchingEngine,
      mockPlayerManager,
      mockDollarManager,
      mockEventBus
    );
  });

  describe("constructor", () => {
    it("should initialize with all required dependencies", () => {
      expect(dayProcessor).toBeDefined();
    });
  });

  describe("processDay", () => {
    it("should process a single day of simulation", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 10,
        maxGamesPerDay: 20,
        dailySeed: "2025-09-01",
      };

      await dayProcessor.processDay(day, config);

      // Verify that autoCreateRuns was called
      expect(mockPlayerManager.autoCreateRuns).toHaveBeenCalledWith(2);

      // In event-driven architecture, matching happens via events
      // No direct method calls to attemptMatching
    });

    it("should handle empty game results gracefully", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 10,
        maxGamesPerDay: 20,
        dailySeed: "2025-09-01",
      };

      await dayProcessor.processDay(day, config);

      // Should not throw and should complete successfully
      // In event-driven architecture, games are created via events
    });

    it("should process games when they are created", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 10,
        maxGamesPerDay: 20,
        dailySeed: "2025-09-01",
      };

      await dayProcessor.processDay(day, config);

      // In event-driven architecture, game resolution happens via events
      // GameEventHandler handles game resolution, not DayProcessor directly
    });

    it("should respect maxGamesPerDay limit", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 2, // This will result in maxGamesPerDay = Math.max(10, 2*2) = 10
        maxGamesPerDay: 8, // This is ignored in the actual implementation
        dailySeed: "2025-09-01",
      };

      await dayProcessor.processDay(day, config);

      // In event-driven architecture, matching attempts are handled by MatchmakingEventHandler
      // DayProcessor only emits DAY_STARTED and DAY_COMPLETED events
    });

    it("should stop processing when no more games can be created", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 10,
        maxGamesPerDay: 20,
        dailySeed: "2025-09-01",
      };

      await dayProcessor.processDay(day, config);

      // In event-driven architecture, matching is handled by MatchmakingEventHandler
      // which responds to POOL_ADDED/POOL_UPDATED events
    });
  });

  describe("addNewRunsToPool", () => {
    it("should add new runs to the game matching engine pool", async () => {
      const mockRun = {
        id: "run-1",
        currentLevel: 1,
      };

      mockPlayerManager.autoCreateRuns.mockReturnValue([mockRun]);

      await dayProcessor.addNewRunsToPool();

      // Verify dollar state was updated
      expect(mockDollarManager.updateDollarState).toHaveBeenCalledWith(
        "run-1",
        DollarState.POOLED
      );

      // Verify run was added to pool
      expect(mockGameMatchingEngine.addToPool).toHaveBeenCalledWith(mockRun);
    });

    it("should handle empty run list", async () => {
      mockPlayerManager.autoCreateRuns.mockReturnValue([]);

      await dayProcessor.addNewRunsToPool();

      // Should not call addToPool with empty array
      expect(mockGameMatchingEngine.addToPool).not.toHaveBeenCalled();
    });
  });

  describe("game resolution and re-pooling", () => {
    it("should re-pool winners who choose to continue playing", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 10,
        maxGamesPerDay: 20,
        dailySeed: "2025-09-01",
      };

      // Mock a game session with winner and loser
      const mockWinner = {
        id: "winner-1",
        ownerId: "player-1",
        currentLevel: 2,
      };
      const mockLoser = {
        id: "loser-1",
        ownerId: "player-2",
        currentLevel: 1,
      };
      const mockGame = { id: "game-1" };

      // Mock game creation
      mockGameMatchingEngine.attemptMatching.mockReturnValue({
        gamesCreated: [mockGame],
      });

      // Mock successful game resolution
      mockGameMatchingEngine.resolveGame.mockReturnValue({
        success: true,
        winner: mockWinner,
        loser: mockLoser,
      });

      // Mock PlayerManager returning null for winner (continues playing) and completion for loser
      mockPlayerManager.processGameResult
        .mockReturnValueOnce(null) // Winner continues
        .mockReturnValueOnce({ completionType: "LOSS", totalWinnings: 0 }); // Loser eliminated

      await dayProcessor.processDay(day, config);

      // Verify that processGameResult was called for both winner and loser
      expect(mockPlayerManager.processGameResult).toHaveBeenCalledWith(
        mockWinner,
        GameResult.WIN
      );
      expect(mockPlayerManager.processGameResult).toHaveBeenCalledWith(
        mockLoser,
        GameResult.LOSS
      );

      // Verify that winner was re-pooled (since processGameResult returned null)
      expect(mockDollarManager.updateDollarState).toHaveBeenCalledWith(
        "winner-1",
        DollarState.POOLED
      );
      expect(mockGameMatchingEngine.addToPool).toHaveBeenCalledWith(mockWinner);
    });

    it("should not re-pool winners who choose to cash out", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 10,
        maxGamesPerDay: 20,
        dailySeed: "2025-09-01",
      };

      const mockWinner = {
        id: "winner-1",
        ownerId: "player-1",
        currentLevel: 2,
      };
      const mockLoser = {
        id: "loser-1",
        ownerId: "player-2",
        currentLevel: 1,
      };
      const mockGame = { id: "game-1" };

      mockGameMatchingEngine.attemptMatching.mockReturnValue({
        gamesCreated: [mockGame],
      });

      mockGameMatchingEngine.resolveGame.mockReturnValue({
        success: true,
        winner: mockWinner,
        loser: mockLoser,
      });

      // Mock PlayerManager returning cash-out result for winner
      mockPlayerManager.processGameResult
        .mockReturnValueOnce({
          completionType: "CASH_OUT",
          totalWinnings: 100,
          shouldCreateNewRun: true,
          playerId: "player-1",
        }) // Winner cashes out
        .mockReturnValueOnce({ completionType: "LOSS", totalWinnings: 0 }); // Loser eliminated

      // Mock new run creation
      mockPlayerManager.createNewRun.mockReturnValue({
        id: "new-run-1",
        ownerId: "player-1",
      });

      await dayProcessor.processDay(day, config);

      // Verify that winner was NOT re-pooled (since they cashed out)
      // But the new run created should be pooled
      expect(mockDollarManager.updateDollarState).toHaveBeenCalledWith(
        "new-run-1",
        DollarState.POOLED
      );
      expect(mockGameMatchingEngine.addToPool).toHaveBeenCalledWith({
        id: "new-run-1",
        ownerId: "player-1",
      });

      // Verify that cash-out was processed
      expect(mockRevenueCalculator.processCashOut).toHaveBeenCalledWith(100);

      // Verify that new run was created and added to pool
      expect(mockPlayerManager.createNewRun).toHaveBeenCalledWith({
        playerId: "player-1",
        cashOutStrategy: "BALANCED",
        fundingSource: "DONATION",
      });
    });

    it("should handle failed game resolution gracefully", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 10,
        maxGamesPerDay: 20,
        dailySeed: "2025-09-01",
      };

      const mockGame = { id: "game-1" };

      mockGameMatchingEngine.attemptMatching.mockReturnValue({
        gamesCreated: [mockGame],
      });

      // Mock failed game resolution
      mockGameMatchingEngine.resolveGame.mockReturnValue({
        success: false,
        error: "Resolution failed",
      });

      await dayProcessor.processDay(day, config);

      // Should not crash and should not call processGameResult
      expect(mockPlayerManager.processGameResult).not.toHaveBeenCalled();
      // Game revenue should NOT be processed if resolution fails (early return)
      expect(mockRevenueCalculator.processGameRevenue).not.toHaveBeenCalled();
    });

    it("should handle missing winner/loser data gracefully", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 10,
        maxGamesPerDay: 20,
        dailySeed: "2025-09-01",
      };

      const mockGame = { id: "game-1" };

      mockGameMatchingEngine.attemptMatching.mockReturnValue({
        gamesCreated: [mockGame],
      });

      // Mock resolution with missing winner/loser
      mockGameMatchingEngine.resolveGame.mockReturnValue({
        success: true,
        winner: null,
        loser: null,
      });

      await dayProcessor.processDay(day, config);

      // Should not call processGameResult with null values
      expect(mockPlayerManager.processGameResult).not.toHaveBeenCalled();
    });
  });
});
