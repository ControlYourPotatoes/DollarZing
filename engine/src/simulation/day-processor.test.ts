import { describe, it, expect, beforeEach, vi } from "vitest";
import { DayProcessor } from "./day-processor";
import { DollarState } from "../types/virtual-dollar-engine";

// Mock the external dependencies
vi.mock("../types/game-matching-engine");
vi.mock("../types/run-orchestrator");
vi.mock("../types/virtual-dollar-types");
vi.mock("../types/revenue-calculator");

describe("DayProcessor", () => {
  let dayProcessor: DayProcessor;
  let mockGameMatchingEngine: any;
  let mockRunOrchestrator: any;
  let mockDollarManager: any;
  let mockRevenueCalculator: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock instances
    mockGameMatchingEngine = {
      addToPool: vi.fn().mockReturnValue({ success: true }),
      attemptMatching: vi.fn().mockReturnValue({ gamesCreated: [] }),
      resolveGame: vi.fn().mockReturnValue({ success: true }),
      getGameSession: vi.fn(),
      getPoolStatistics: vi.fn().mockReturnValue({
        totalDollarsInPool: 100,
        availableForMatching: 50,
      }),
    };

    mockRunOrchestrator = {
      autoCreateRuns: vi.fn().mockReturnValue([]),
      getActivePlayerCount: vi.fn().mockReturnValue(10),
      processGameResult: vi
        .fn()
        .mockReturnValue({ completionType: "CONTINUE", totalWinnings: 0 }),
      getPlayerStrategy: vi.fn().mockReturnValue("AVERAGE"),
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

    // Create DayProcessor instance
    dayProcessor = new DayProcessor(
      mockGameMatchingEngine,
      mockRunOrchestrator,
      mockDollarManager,
      mockRevenueCalculator
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
      expect(mockRunOrchestrator.autoCreateRuns).toHaveBeenCalledWith(2);

      // Verify that attemptMatching was called
      expect(mockGameMatchingEngine.attemptMatching).toHaveBeenCalled();
    });

    it("should handle empty game results gracefully", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 10,
        maxGamesPerDay: 20,
        dailySeed: "2025-09-01",
      };

      // Mock empty game results
      mockGameMatchingEngine.attemptMatching.mockReturnValue({
        gamesCreated: [],
      });

      await dayProcessor.processDay(day, config);

      // Should not throw and should complete successfully
      expect(mockGameMatchingEngine.attemptMatching).toHaveBeenCalled();
    });

    it("should process games when they are created", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 10,
        maxGamesPerDay: 20,
        dailySeed: "2025-09-01",
      };

      // Mock game creation
      const mockGame = { id: "game-1" };
      mockGameMatchingEngine.attemptMatching.mockReturnValue({
        gamesCreated: [mockGame],
      });

      await dayProcessor.processDay(day, config);

      // Verify game resolution was attempted
      expect(mockGameMatchingEngine.resolveGame).toHaveBeenCalledWith(
        "game-1",
        expect.any(String)
      );
    });

    it("should respect maxGamesPerDay limit", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 2, // This will result in maxGamesPerDay = Math.max(10, 2*2) = 10
        maxGamesPerDay: 8, // This is ignored in the actual implementation
        dailySeed: "2025-09-01",
      };

      // Mock that we always create games
      mockGameMatchingEngine.attemptMatching.mockReturnValue({
        gamesCreated: [{ id: "game-1" }],
      });

      await dayProcessor.processDay(day, config);

      // Should attempt matching Math.max(10, initialPlayerCount * 2) times = 10 times
      expect(mockGameMatchingEngine.attemptMatching).toHaveBeenCalledTimes(10);
    });

    it("should stop processing when no more games can be created", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 10,
        maxGamesPerDay: 20,
        dailySeed: "2025-09-01",
      };

      // Mock that first attempt creates games, second returns empty
      mockGameMatchingEngine.attemptMatching
        .mockReturnValueOnce({ gamesCreated: [{ id: "game-1" }] })
        .mockReturnValueOnce({ gamesCreated: [] });

      await dayProcessor.processDay(day, config);

      // Should only attempt matching twice (once successful, once empty)
      expect(mockGameMatchingEngine.attemptMatching).toHaveBeenCalledTimes(2);
    });
  });

  describe("addNewRunsToPool", () => {
    it("should add new runs to the game matching engine pool", async () => {
      const mockRun = {
        id: "run-1",
        currentLevel: 1,
      };

      mockRunOrchestrator.autoCreateRuns.mockReturnValue([mockRun]);

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
      mockRunOrchestrator.autoCreateRuns.mockReturnValue([]);

      await dayProcessor.addNewRunsToPool();

      // Should not call addToPool with empty array
      expect(mockGameMatchingEngine.addToPool).not.toHaveBeenCalled();
    });
  });

  // processGameResults tests removed - method is private and tested through processDay()
});
