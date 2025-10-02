import { describe, it, expect, beforeEach, vi } from "vitest";
import { PlayerManager } from "./player-manager";
import { CashOutStrategy } from "../types/virtual-dollar-engine";

// Mock the external dependencies
vi.mock("../types/player-balance-manager");
vi.mock("../types/player-run-manager");

describe("PlayerManager", () => {
  let playerManager: PlayerManager;
  let mockPlayerBalanceManager: any;
  let mockRunOrchestrator: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock instances
    mockPlayerBalanceManager = {
      createPlayer: vi.fn(),
      getTotalDonations: vi.fn().mockReturnValue(1000),
      getTotalWinnings: vi.fn().mockReturnValue(500),
    };

    mockRunOrchestrator = {
      initializePlayer: vi.fn(),
      getActivePlayerCount: vi.fn().mockReturnValue(10),
      getAllActiveRuns: vi.fn().mockReturnValue([]),
    };

    // Create PlayerManager instance
    playerManager = new PlayerManager(
      mockPlayerBalanceManager,
      mockRunOrchestrator
    );
  });

  describe("constructor", () => {
    it("should initialize with all required dependencies", () => {
      expect(playerManager).toBeDefined();
    });
  });

  describe("initializePlayers", () => {
    it("should initialize players with correct strategy distribution", () => {
      const config = {
        initialPlayerCount: 10,
        initialDonationAmount: 100,
        playerStrategies: {
          [CashOutStrategy.CONSERVATIVE]: 0.3,
          [CashOutStrategy.BALANCED]: 0.4,
          [CashOutStrategy.AGGRESSIVE]: 0.3,
        },
      };

      const playerCount = playerManager.initializePlayers(config);

      expect(playerCount).toBe(10);
      expect(mockPlayerBalanceManager.createPlayer).toHaveBeenCalledTimes(10);
      expect(mockRunOrchestrator.initializePlayer).toHaveBeenCalledTimes(10);
    });

    it("should handle single strategy distribution", () => {
      const config = {
        initialPlayerCount: 5,
        initialDonationAmount: 50,
        playerStrategies: {
          [CashOutStrategy.BALANCED]: 1.0,
        },
      };

      const playerCount = playerManager.initializePlayers(config);

      expect(playerCount).toBe(5);
      expect(mockPlayerBalanceManager.createPlayer).toHaveBeenCalledTimes(5);
    });

    it("should adjust strategy counts to match exact player count", () => {
      const config = {
        initialPlayerCount: 7, // Odd number to test adjustment
        initialDonationAmount: 100,
        playerStrategies: {
          [CashOutStrategy.CONSERVATIVE]: 0.33,
          [CashOutStrategy.BALANCED]: 0.43,
          [CashOutStrategy.AGGRESSIVE]: 0.34,
        },
      };

      const playerCount = playerManager.initializePlayers(config);

      expect(playerCount).toBe(7);
      expect(mockPlayerBalanceManager.createPlayer).toHaveBeenCalledTimes(7);
    });

    it("should create players with correct parameters", () => {
      const config = {
        initialPlayerCount: 3,
        initialDonationAmount: 200,
        playerStrategies: {
          [CashOutStrategy.BALANCED]: 1.0,
        },
      };

      playerManager.initializePlayers(config);

      // Check that players are created with correct parameters
      expect(mockPlayerBalanceManager.createPlayer).toHaveBeenCalledWith(
        "player-0",
        200,
        "balanced"
      );
      expect(mockPlayerBalanceManager.createPlayer).toHaveBeenCalledWith(
        "player-1",
        200,
        "balanced"
      );
      expect(mockPlayerBalanceManager.createPlayer).toHaveBeenCalledWith(
        "player-2",
        200,
        "balanced"
      );
    });
  });

  describe("addNewPlayersForDay", () => {
    it("should add new players based on growth model", () => {
      const day = 5;
      const config = {
        initialPlayerCount: 10,
        initialDonationAmount: 100,
        playerStrategies: {
          [CashOutStrategy.BALANCED]: 1.0,
        },
      };

      // Mock that we need to add players
      mockRunOrchestrator.getActivePlayerCount.mockReturnValue(5);

      playerManager.addNewPlayersForDay(day, config);

      // Should attempt to add new players
      expect(mockPlayerBalanceManager.createPlayer).toHaveBeenCalled();
      expect(mockRunOrchestrator.initializePlayer).toHaveBeenCalled();
    });

    it("should not add players if target is already reached", () => {
      const day = 5;
      const config = {
        initialPlayerCount: 10,
        initialDonationAmount: 100,
        playerStrategies: {
          [CashOutStrategy.BALANCED]: 1.0,
        },
      };

      // Mock that we already have enough players
      mockRunOrchestrator.getActivePlayerCount.mockReturnValue(100);

      playerManager.addNewPlayersForDay(day, config);

      // Should not add any new players
      expect(mockPlayerBalanceManager.createPlayer).not.toHaveBeenCalled();
    });

    it("should assign random strategies to new players", () => {
      const day = 10;
      const config = {
        initialPlayerCount: 10,
        initialDonationAmount: 100,
        playerStrategies: {
          [CashOutStrategy.CONSERVATIVE]: 0.5,
          [CashOutStrategy.AGGRESSIVE]: 0.5,
        },
      };

      // Mock that we need to add players
      mockRunOrchestrator.getActivePlayerCount.mockReturnValue(5);

      playerManager.addNewPlayersForDay(day, config);

      // Should create players with strategies
      expect(mockPlayerBalanceManager.createPlayer).toHaveBeenCalledWith(
        expect.any(String),
        100,
        expect.any(String)
      );
    });
  });

  describe("getPlayerStatistics", () => {
    it("should return correct player statistics", () => {
      const config = {
        initialPlayerCount: 20,
        initialDonationAmount: 100,
        playerStrategies: {
          [CashOutStrategy.BALANCED]: 1.0,
        },
      };

      mockRunOrchestrator.getActivePlayerCount.mockReturnValue(15);

      const stats = playerManager.getPlayerStatistics(config);

      expect(stats.totalPlayers).toBe(20);
      expect(stats.activePlayers).toBe(15);
      expect(stats.retiredPlayers).toBe(5);
      expect(stats.totalCharityContributions).toBe(1000);
      expect(stats.totalPlayerPayouts).toBe(500);
    });

    it("should calculate retirement rate correctly", () => {
      const config = {
        initialPlayerCount: 10,
        initialDonationAmount: 100,
        playerStrategies: {
          [CashOutStrategy.BALANCED]: 1.0,
        },
      };

      mockRunOrchestrator.getActivePlayerCount.mockReturnValue(7);

      const stats = playerManager.getPlayerStatistics(config);

      expect(stats.playerRetirementRate).toBe(0.3); // 3 retired out of 10
    });
  });
});
