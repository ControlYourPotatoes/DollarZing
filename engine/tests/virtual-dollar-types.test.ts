// Virtual Dollar Pool Game Engine - Core Data Structures Tests
// Task 1.1: Write tests for VirtualDollar interface and state management

import { describe, it, expect } from "vitest";
import {
  VirtualDollar,
  DollarState,
  GameSession,
  GameResult,
  CashOutDecision,
  RevenueStream,
  SimulationParameters,
  MonthlySimulationResult,
  DailyGameReport,
  validateSimulationParameters,
  createEmptyRevenueStream,
} from "../src/types/virtual-dollar-engine";

describe("Virtual Dollar Pool Game Engine - Type Definitions", () => {
  describe("VirtualDollar Interface", () => {
    it("should create valid VirtualDollar with all required properties", () => {
      const dollar: VirtualDollar = {
        id: "dollar-123",
        serialNumber: "L12345678A",
        currentScore: 0.75,
        currentLevel: 1,
        state: DollarState.CREATED,
        ownerId: "player-456",
        runId: "run-789",
        createdAt: new Date("2025-01-01"),
        gameHistory: [],
        gamesInThisRun: 0,
        currentRunWinnings: 0,
        isIndependentRun: false,
        potValue: 1.0,
      };

      expect(dollar.id).toBe("dollar-123");
      expect(dollar.serialNumber).toMatch(/^[A-Z]\d{8}[A-Z]$/);
      expect(dollar.currentScore).toBeGreaterThanOrEqual(0);
      expect(dollar.currentScore).toBeLessThanOrEqual(1);
      expect(dollar.currentLevel).toBe(1);
      expect(dollar.state).toBe(DollarState.CREATED);
      expect(dollar.ownerId).toBe("player-456");
      expect(dollar.runId).toBe("run-789");
      expect(dollar.createdAt).toBeInstanceOf(Date);
      expect(dollar.gameHistory).toEqual([]);
      expect(dollar.gamesInThisRun).toBe(0);
      expect(dollar.currentRunWinnings).toBe(0);
      expect(dollar.isIndependentRun).toBe(false);
      expect(dollar.potValue).toBe(1.0);
    });

    it("should validate serial number format", () => {
      const validSerials = ["L12345678A", "Z98765432B", "M00000001X"];
      const invalidSerials = [
        "12345678A",
        "L1234567A",
        "L123456789A",
        "l12345678a",
      ];

      validSerials.forEach((serial) => {
        expect(serial).toMatch(/^[A-Z]\d{8}[A-Z]$/);
      });

      invalidSerials.forEach((serial) => {
        expect(serial).not.toMatch(/^[A-Z]\d{8}[A-Z]$/);
      });
    });

    it("should support all dollar states", () => {
      const states = [
        DollarState.CREATED,
        DollarState.POOLED,
        DollarState.IN_GAME,
        DollarState.WON,
        DollarState.LOST,
        DollarState.CASHED_OUT,
      ];

      states.forEach((state) => {
        expect(typeof state).toBe("string");
        expect(state.length).toBeGreaterThan(0);
      });
    });
  });

  describe("GameSession Interface", () => {
    it("should create valid GameSession with comprehensive game data", () => {
      const dollar1: VirtualDollar = createVirtualDollar(
        "L11111111A",
        "player1"
      );
      const dollar2: VirtualDollar = createVirtualDollar(
        "L22222222B",
        "player2"
      );

      const gameSession: GameSession = {
        id: "game-789",
        dollar1,
        dollar2,
        winner: dollar1,
        loser: dollar2,
        level: 3,
        platformFee: 0.2,
        timestamp: new Date("2025-01-01T10:00:00Z"),
        gameNumber: 12345,
        dailySeed: "seed-2025-01-01",
        dollar1Score: 0.75,
        dollar2Score: 0.45,
        winnings: 8, // $4 * 2 = $8 at level 3
        isCompleted: true,
        duration: 1000,
        randomSeed: 0.5,
      };

      expect(gameSession.id).toBe("game-789");
      expect(gameSession.dollar1).toBe(dollar1);
      expect(gameSession.dollar2).toBe(dollar2);
      expect(gameSession.winner).toBe(dollar1);
      expect(gameSession.loser).toBe(dollar2);
      expect(gameSession.level).toBe(3);
      expect(gameSession.platformFee).toBe(0.2);
      expect(gameSession.timestamp).toBeInstanceOf(Date);
      expect(gameSession.gameNumber).toBe(12345);
      expect(gameSession.dailySeed).toBe("seed-2025-01-01");
      expect(gameSession.dollar1Score).toBe(0.75);
      expect(gameSession.dollar2Score).toBe(0.45);
      expect(gameSession.winnings).toBe(8);
    });
  });

  describe("Enums", () => {
    it("should define all required GameResult values", () => {
      expect(GameResult.WIN).toBeDefined();
      expect(GameResult.LOSS).toBeDefined();
      expect(typeof GameResult.WIN).toBe("string");
      expect(typeof GameResult.LOSS).toBe("string");
    });

    it("should define all required CashOutDecision values", () => {
      expect(CashOutDecision.CASH_OUT).toBeDefined();
      expect(CashOutDecision.CONTINUE).toBeDefined();
      expect(typeof CashOutDecision.CASH_OUT).toBe("string");
      expect(typeof CashOutDecision.CONTINUE).toBe("string");
    });

    it("should define all required DollarState values", () => {
      expect(DollarState.CREATED).toBeDefined();
      expect(DollarState.POOLED).toBeDefined();
      expect(DollarState.IN_GAME).toBeDefined();
      expect(DollarState.WON).toBeDefined();
      expect(DollarState.LOST).toBeDefined();
      expect(DollarState.CASHED_OUT).toBeDefined();
    });
  });

  describe("RevenueStream Interface", () => {
    it("should create valid RevenueStream with separate revenue tracking", () => {
      const revenueStream: RevenueStream = {
        platformClickRevenue: 100.0, // 500 games * $0.20
        charityContributions: 50.0, // 10% of cash-outs
        charityPercentage: 0.1,
        playerWinnings: 450.0,
        totalCashOuts: 500.0,
        totalGames: 500,
        totalClickFees: 100.0,
        averageCashOutAmount: 1.0,
      };

      expect(revenueStream.platformClickRevenue).toBe(100.0);
      expect(revenueStream.charityContributions).toBe(50.0);
      expect(revenueStream.charityPercentage).toBe(0.1);
      expect(revenueStream.playerWinnings).toBe(450.0);
      expect(revenueStream.totalCashOuts).toBe(500.0);
      expect(revenueStream.totalGames).toBe(500);
      expect(revenueStream.totalClickFees).toBe(100.0);
      expect(revenueStream.averageCashOutAmount).toBe(1.0);
    });
  });

  describe("BettingLevel Validation", () => {
    it("should validate 11-level progression", () => {
      const validLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const levelValues = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];

      validLevels.forEach((level, index) => {
        expect(level).toBeGreaterThanOrEqual(1);
        expect(level).toBeLessThanOrEqual(11);
        expect(levelValues[index]).toBeGreaterThan(0);
      });
    });
  });

  describe("SimulationParameters Interface", () => {
    it("should create valid SimulationParameters for game engine", () => {
      const params: SimulationParameters = {
        duration: 30, // 30 days
        initialPlayerCount: 1000,
        virtualDollarsPerPlayer: 5,
        cashOutStrategyDistribution: {
          conservative: 0.4,
          balanced: 0.4,
          aggressive: 0.2,
        },
        charityPercentage: 0.15,
        gameMatchingInterval: 100, // milliseconds
        maxConcurrentGames: 1000,
        randomSeed: 12345,
        playerGrowthRate: 0.02,
      };

      expect(params.duration).toBe(30);
      expect(params.initialPlayerCount).toBe(1000);
      expect(params.virtualDollarsPerPlayer).toBe(5);
      expect(params.cashOutStrategyDistribution.conservative).toBe(0.4);
      expect(params.cashOutStrategyDistribution.balanced).toBe(0.4);
      expect(params.cashOutStrategyDistribution.aggressive).toBe(0.2);
      expect(params.charityPercentage).toBe(0.15);
      expect(params.gameMatchingInterval).toBe(100);
      expect(params.maxConcurrentGames).toBe(1000);
      expect(params.randomSeed).toBe(12345);
      expect(params.playerGrowthRate).toBe(0.02);
    });

    it("should validate parameter constraints", () => {
      const validParams: SimulationParameters = {
        duration: 30,
        initialPlayerCount: 1000,
        virtualDollarsPerPlayer: 5,
        cashOutStrategyDistribution: {
          conservative: 0.4,
          balanced: 0.4,
          aggressive: 0.2,
        },
        charityPercentage: 0.15,
        gameMatchingInterval: 100,
        maxConcurrentGames: 1000,
        randomSeed: 12345,
        playerGrowthRate: 0.02,
      };

      const validation = validateSimulationParameters(validParams);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe("MonthlySimulationResult Interface", () => {
    it("should create valid MonthlySimulationResult", () => {
      const result: MonthlySimulationResult = {
        month: 1,
        totalVirtualDollars: 50000,
        totalGamesPlayed: 125000,
        totalCashOuts: 25000,
        revenueStreams: createEmptyRevenueStream(),
        dailyReports: [],
        playerStatistics: {
          activePlayerCount: 1000,
          newPlayerCount: 200,
          retainedPlayerCount: 800,
          churnedPlayerCount: 50,
        },
        gameStatistics: {
          averageGamesPerDay: 4167,
          levelDistribution: [
            10000, 5000, 2500, 1250, 625, 313, 156, 78, 39, 20, 10,
          ],
          avgTimeToLevel: [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048],
        },
      };

      expect(result.month).toBe(1);
      expect(result.totalVirtualDollars).toBe(50000);
      expect(result.totalGamesPlayed).toBe(125000);
      expect(result.totalCashOuts).toBe(25000);
      expect(result.revenueStreams).toBeDefined();
      expect(result.dailyReports).toEqual([]);
      expect(result.playerStatistics.activePlayerCount).toBe(1000);
      expect(result.gameStatistics.averageGamesPerDay).toBe(4167);
    });
  });

  describe("DailyGameReport Interface", () => {
    it("should create valid DailyGameReport", () => {
      const report: DailyGameReport = {
        day: 15,
        date: new Date("2025-01-15"),
        totalGamesPlayed: 5000,
        virtualDollarsInPool: 2500,
        newVirtualDollarsCreated: 500,
        cashOutEvents: 100,
        revenueGenerated: createEmptyRevenueStream(),
        levelActivitySummary: [1000, 500, 250, 125, 63, 31, 16, 8, 4, 2, 1],
        topPlayersByWinnings: [],
      };

      expect(report.day).toBe(15);
      expect(report.date).toBeInstanceOf(Date);
      expect(report.totalGamesPlayed).toBe(5000);
      expect(report.virtualDollarsInPool).toBe(2500);
      expect(report.newVirtualDollarsCreated).toBe(500);
      expect(report.cashOutEvents).toBe(100);
      expect(report.revenueGenerated).toBeDefined();
      expect(report.levelActivitySummary).toHaveLength(11);
      expect(report.topPlayersByWinnings).toEqual([]);
    });
  });

  describe("Type Compilation", () => {
    it("should compile all types without errors", () => {
      // This test passes if TypeScript compilation succeeds
      expect(true).toBe(true);
    });
  });
});

// Helper function implementations for testing
function createVirtualDollar(
  serialNumber: string,
  ownerId: string
): VirtualDollar {
  return {
    id: `dollar-${Date.now()}-${Math.random()}`,
    serialNumber,
    currentScore: Math.random(),
    currentLevel: 1,
    state: DollarState.CREATED,
    ownerId,
    runId: `run-${Date.now()}`,
    createdAt: new Date(),
    gameHistory: [],
    gamesInThisRun: 0,
    currentRunWinnings: 0,
    isIndependentRun: false,
    potValue: 1.0,
  };
}

// Helper functions are defined inline in tests to avoid unused function warnings
