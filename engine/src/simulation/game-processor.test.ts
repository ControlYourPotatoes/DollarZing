import { describe, it, expect, beforeEach, vi } from "vitest";
import { GameProcessor } from "./game-processor";
import { EventBus } from "../events/event-bus";

// Mock the external dependencies
vi.mock("../types/game-matching-engine");
vi.mock("../types/revenue-calculator");

describe("GameProcessor", () => {
  let gameProcessor: GameProcessor;
  let mockGameMatchingEngine: any;
  let mockRevenueCalculator: any;
  let mockEventBus: EventBus;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock instances
    mockGameMatchingEngine = {
      resolveGame: vi.fn().mockReturnValue({ success: true }),
      getGameSession: vi.fn(),
    };

    mockRevenueCalculator = {
      processGameRevenue: vi.fn(),
    };

    mockEventBus = {
      emit: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      getEventHistory: vi.fn().mockReturnValue([]),
    } as any;

    // Create GameProcessor instance
    gameProcessor = new GameProcessor(mockGameMatchingEngine, mockEventBus);
  });

  describe("constructor", () => {
    it("should initialize with all required dependencies", () => {
      expect(gameProcessor).toBeDefined();
    });
  });

  describe("resolveGames", () => {
    it("should resolve games with proper daily seed", async () => {
      const games = [{ id: "game-1" }, { id: "game-2" }];
      const dailySeed = "2025-09-01";

      await gameProcessor.resolveGames(games, dailySeed);

      expect(mockGameMatchingEngine.resolveGame).toHaveBeenCalledWith(
        "game-1",
        "2025-09-01"
      );
      expect(mockGameMatchingEngine.resolveGame).toHaveBeenCalledWith(
        "game-2",
        "2025-09-01"
      );
      expect(mockRevenueCalculator.processGameRevenue).toHaveBeenCalledTimes(2);
    });

    it("should use current date when daily seed is invalid", async () => {
      const games = [{ id: "game-1" }];
      const invalidSeed = "invalid-seed";

      await gameProcessor.resolveGames(games, invalidSeed);

      // Should use current date format
      expect(mockGameMatchingEngine.resolveGame).toHaveBeenCalledWith(
        "game-1",
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
      );
    });

    it("should handle game resolution failures gracefully", async () => {
      const games = [{ id: "game-1" }];
      const dailySeed = "2025-09-01";

      mockGameMatchingEngine.resolveGame.mockReturnValue({
        success: false,
        error: "Resolution failed",
      });

      await gameProcessor.resolveGames(games, dailySeed);

      // Should still process game revenue even if resolution fails
      expect(mockRevenueCalculator.processGameRevenue).toHaveBeenCalledWith(
        games[0]
      );
    });
  });

  describe("processGameResults", () => {
    it("should emit GAME_RESOLVED events for games with winner and loser", async () => {
      const games = [{ id: "game-1" }];
      const resolvedGame = {
        id: "game-1",
        winner: { id: "winner-1", ownerId: "player-1", currentLevel: 2 },
        loser: { id: "loser-1", ownerId: "player-2", currentLevel: 1 },
      };

      mockGameMatchingEngine.getGameSession.mockReturnValue(resolvedGame);

      await gameProcessor.processGameResults(games);

      expect(mockGameMatchingEngine.getGameSession).toHaveBeenCalledWith(
        "game-1"
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        "GAME_RESOLVED",
        expect.objectContaining({
          type: "GAME_RESOLVED",
          gameId: "game-1",
          winnerId: "player-1",
          loserId: "player-2",
          winnerLevel: 2,
          loserLevel: 1,
          winnerDollarId: "winner-1",
          loserDollarId: "loser-1",
          winnings: 20, // 2 * 10
          gameResult: "WIN",
        })
      );
    });

    it("should skip games with missing winner/loser data", async () => {
      const games = [{ id: "game-1" }];
      const incompleteGame = {
        id: "game-1",
        winner: null,
        loser: null,
      };

      mockGameMatchingEngine.getGameSession.mockReturnValue(incompleteGame);

      await gameProcessor.processGameResults(games);

      // Should not emit events for incomplete games
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it("should handle multiple games in batch", async () => {
      const games = [{ id: "game-1" }, { id: "game-2" }];
      const resolvedGame1 = {
        id: "game-1",
        winner: { id: "winner-1", ownerId: "player-1", currentLevel: 2 },
        loser: { id: "loser-1", ownerId: "player-2", currentLevel: 1 },
      };
      const resolvedGame2 = {
        id: "game-2",
        winner: { id: "winner-2", ownerId: "player-3", currentLevel: 3 },
        loser: { id: "loser-2", ownerId: "player-4", currentLevel: 2 },
      };

      mockGameMatchingEngine.getGameSession
        .mockReturnValueOnce(resolvedGame1)
        .mockReturnValueOnce(resolvedGame2);

      await gameProcessor.processGameResults(games);

      expect(mockGameMatchingEngine.getGameSession).toHaveBeenCalledTimes(2);
      expect(mockEventBus.emit).toHaveBeenCalledTimes(2);
    });

    it("should handle missing game session data gracefully", async () => {
      const games = [{ id: "game-1" }];

      mockGameMatchingEngine.getGameSession.mockReturnValue(null);

      await gameProcessor.processGameResults(games);

      // Should not emit events for missing game sessions
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });
  });
});
