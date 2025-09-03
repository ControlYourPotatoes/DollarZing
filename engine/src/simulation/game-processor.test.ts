import { describe, it, expect, beforeEach, vi } from "vitest";
import { GameProcessor } from "./game-processor";
import { GameResult, DollarState } from "../types/virtual-dollar-engine";

// Mock the external dependencies
vi.mock("../types/game-matching-engine");
vi.mock("../types/player-run-manager");
vi.mock("../types/revenue-calculator");
vi.mock("../types/virtual-dollar-types");

describe("GameProcessor", () => {
  let gameProcessor: GameProcessor;
  let mockGameMatchingEngine: any;
  let mockRunOrchestrator: any;
  let mockRevenueCalculator: any;
  let mockDollarManager: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock instances
    mockGameMatchingEngine = {
      resolveGame: vi.fn().mockReturnValue({ success: true }),
      getGameSession: vi.fn(),
      addToPool: vi.fn().mockReturnValue({ success: true }),
    };

    mockRunOrchestrator = {
      processGameResult: vi.fn(),
      getPlayerStrategy: vi.fn().mockReturnValue("AVERAGE"),
      createNewRun: vi.fn().mockReturnValue({ id: "new-run-1" }),
    };

    mockRevenueCalculator = {
      processGameRevenue: vi.fn(),
      processCashOut: vi.fn(),
    };

    mockDollarManager = {
      updateDollarState: vi.fn(),
    };

    // Create GameProcessor instance
    gameProcessor = new GameProcessor(
      mockGameMatchingEngine,
      mockRunOrchestrator,
      mockRevenueCalculator,
      mockDollarManager
    );
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
    it("should process game results with winner and loser", async () => {
      const games = [{ id: "game-1" }];
      const resolvedGame = {
        id: "game-1",
        winner: { ownerId: "player-1", currentLevel: 2 },
        loser: { ownerId: "player-2", currentLevel: 1 },
      };

      mockGameMatchingEngine.getGameSession.mockReturnValue(resolvedGame);
      mockRunOrchestrator.processGameResult
        .mockReturnValueOnce({ completionType: "CONTINUE", totalWinnings: 100 })
        .mockReturnValueOnce({ completionType: "CONTINUE", totalWinnings: 0 });

      await gameProcessor.processGameResults(games);

      expect(mockGameMatchingEngine.getGameSession).toHaveBeenCalledWith(
        "game-1"
      );
      expect(mockRunOrchestrator.processGameResult).toHaveBeenCalledWith(
        resolvedGame.winner,
        GameResult.WIN
      );
      expect(mockRunOrchestrator.processGameResult).toHaveBeenCalledWith(
        resolvedGame.loser,
        GameResult.LOSS
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

      // Should not process incomplete games
      expect(mockRunOrchestrator.processGameResult).not.toHaveBeenCalled();
    });

    it("should process cash-outs for revenue tracking", async () => {
      const games = [{ id: "game-1" }];
      const resolvedGame = {
        id: "game-1",
        winner: { ownerId: "player-1", currentLevel: 2 },
        loser: { ownerId: "player-2", currentLevel: 1 },
      };

      mockGameMatchingEngine.getGameSession.mockReturnValue(resolvedGame);
      mockRunOrchestrator.processGameResult
        .mockReturnValueOnce({
          completionType: "CASH_OUT",
          totalWinnings: 500,
          shouldCreateNewRun: false,
        })
        .mockReturnValueOnce({
          completionType: "CONTINUE",
          totalWinnings: 0,
          shouldCreateNewRun: false,
        });

      await gameProcessor.processGameResults(games);

      expect(mockRevenueCalculator.processCashOut).toHaveBeenCalledWith(500);
    });

    it("should create new runs when shouldCreateNewRun is true", async () => {
      const games = [{ id: "game-1" }];
      const resolvedGame = {
        id: "game-1",
        winner: { ownerId: "player-1", currentLevel: 2 },
        loser: { ownerId: "player-2", currentLevel: 1 },
      };

      mockGameMatchingEngine.getGameSession.mockReturnValue(resolvedGame);
      mockRunOrchestrator.processGameResult
        .mockReturnValueOnce({
          completionType: "CASH_OUT",
          totalWinnings: 500,
          shouldCreateNewRun: true,
          playerId: "player-1",
        })
        .mockReturnValueOnce({
          completionType: "CONTINUE",
          totalWinnings: 0,
          shouldCreateNewRun: false,
        });

      await gameProcessor.processGameResults(games);

      expect(mockRunOrchestrator.getPlayerStrategy).toHaveBeenCalledWith(
        "player-1"
      );
      expect(mockRunOrchestrator.createNewRun).toHaveBeenCalledWith({
        playerId: "player-1",
        cashOutStrategy: "AVERAGE",
        fundingSource: "DONATION",
      });
      expect(mockDollarManager.updateDollarState).toHaveBeenCalledWith(
        "new-run-1",
        DollarState.POOLED
      );
      expect(mockGameMatchingEngine.addToPool).toHaveBeenCalledWith({
        id: "new-run-1",
      });
    });

    it("should handle multiple games in batch", async () => {
      const games = [{ id: "game-1" }, { id: "game-2" }];
      const resolvedGame1 = {
        id: "game-1",
        winner: { ownerId: "player-1", currentLevel: 2 },
        loser: { ownerId: "player-2", currentLevel: 1 },
      };
      const resolvedGame2 = {
        id: "game-2",
        winner: { ownerId: "player-3", currentLevel: 3 },
        loser: { ownerId: "player-4", currentLevel: 2 },
      };

      mockGameMatchingEngine.getGameSession
        .mockReturnValueOnce(resolvedGame1)
        .mockReturnValueOnce(resolvedGame2);

      mockRunOrchestrator.processGameResult.mockReturnValue({
        completionType: "CONTINUE",
        totalWinnings: 0,
      });

      await gameProcessor.processGameResults(games);

      expect(mockGameMatchingEngine.getGameSession).toHaveBeenCalledTimes(2);
      expect(mockRunOrchestrator.processGameResult).toHaveBeenCalledTimes(4); // 2 games * 2 players each
    });
  });
});
