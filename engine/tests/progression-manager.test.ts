// ProgressionManager Tests - Comprehensive test suite for independent run logic
// Tests exponential betting progression, cash-out strategies, and run completion

import { describe, test, expect, beforeEach } from "vitest";
import {
  ProgressionManager,
  RunProgressionState,
} from "../src/types/progression-manager";

import {
  VirtualDollar,
  BettingLevel,
  DollarState,
  GameResult,
  CashOutStrategy,
  CashOutDecision,
  getBettingLevelValue,
  getBettingLevelWinnings,
} from "../src/types/virtual-dollar-engine";

describe("ProgressionManager - Exponential Betting Progression Tests", () => {
  let progressionManager: ProgressionManager;
  let testVirtualDollar: VirtualDollar;

  beforeEach(() => {
    progressionManager = new ProgressionManager(0.15); // 15% charity

    testVirtualDollar = {
      id: "test-dollar-1",
      serialNumber: "A12345678B",
      currentScore: 0.5,
      currentLevel: 1,
      state: DollarState.POOLED,
      ownerId: "test-player-1",
      runId: "test-run-1",
      createdAt: new Date(),
      gameHistory: [],
      gamesInThisRun: 0,
      currentRunWinnings: 0,
      isIndependentRun: true,
      potValue: 1.0,
    };
  });

  describe("Exponential Betting Level Values", () => {
    test("should calculate correct betting values for each level", () => {
      // Level 1: $1 bet
      expect(getBettingLevelValue(1)).toBe(1);

      // Level 2: $2 bet
      expect(getBettingLevelValue(2)).toBe(2);

      // Level 3: $4 bet
      expect(getBettingLevelValue(3)).toBe(4);

      // Level 4: $8 bet
      expect(getBettingLevelValue(4)).toBe(8);

      // Level 5: $16 bet
      expect(getBettingLevelValue(5)).toBe(16);

      // Level 6: $32 bet
      expect(getBettingLevelValue(6)).toBe(32);

      // Level 7: $64 bet
      expect(getBettingLevelValue(7)).toBe(64);

      // Level 8: $128 bet
      expect(getBettingLevelValue(8)).toBe(128);

      // Level 9: $256 bet
      expect(getBettingLevelValue(9)).toBe(256);

      // Level 10: $512 bet (maximum level)
      expect(getBettingLevelValue(10)).toBe(512);
    });

    test("should calculate correct winning amounts for each level (level × 1.8)", () => {
      // Level 1: $1 bet → $1.80 win
      expect(getBettingLevelWinnings(1)).toBe(1.8);

      // Level 2: $2 bet → $3.60 win
      expect(getBettingLevelWinnings(2)).toBe(3.6);

      // Level 3: $4 bet → $5.40 win
      expect(getBettingLevelWinnings(3)).toBe(5.4);

      // Level 4: $8 bet → $7.20 win
      expect(getBettingLevelWinnings(4)).toBe(7.2);

      // Level 5: $16 bet → $9.00 win
      expect(getBettingLevelWinnings(5)).toBe(9.0);

      // Level 6: $32 bet → $10.80 win
      expect(getBettingLevelWinnings(6)).toBe(10.8);

      // Level 7: $64 bet → $12.60 win
      expect(getBettingLevelWinnings(7)).toBe(12.6);

      // Level 8: $128 bet → $14.40 win
      expect(getBettingLevelWinnings(8)).toBe(14.4);

      // Level 9: $256 bet → $16.20 win
      expect(getBettingLevelWinnings(9)).toBe(16.2);

      // Level 10: $512 bet → $18.00 win
      expect(getBettingLevelWinnings(10)).toBe(18.0);
    });

    test("should verify exponential progression pattern (2^(level-1))", () => {
      for (let level = 1; level <= 10; level++) {
        const expected = Math.pow(2, level - 1);
        expect(getBettingLevelValue(level as BettingLevel)).toBe(expected);
      }
    });

    test("should verify winning amounts follow level × 1.8 formula", () => {
      for (let level = 1; level <= 10; level++) {
        const winnings = getBettingLevelWinnings(level as BettingLevel);
        expect(winnings).toBe(level * 1.8);
      }
    });
  });

  describe("Independent Run Initialization", () => {
    test("should initialize a new run at Level 1 with zero winnings", () => {
      const progression = progressionManager.initializeRun(testVirtualDollar);

      expect(progression.runId).toBe("test-run-1");
      expect(progression.currentLevel).toBe(1);
      expect(progression.gamesWonInRun).toBe(0);
      expect(progression.currentWinnings).toBe(0);
      expect(progression.isComplete).toBe(false);
      expect(progression.completionReason).toBe(null);
      expect(progression.completedAt).toBe(null);
    });

    test("should throw error when initializing duplicate run", () => {
      progressionManager.initializeRun(testVirtualDollar);

      expect(() => {
        progressionManager.initializeRun(testVirtualDollar);
      }).toThrow("Run test-run-1 already exists");
    });

    test("should track multiple independent runs separately", () => {
      const dollar2: VirtualDollar = {
        ...testVirtualDollar,
        id: "test-dollar-2",
        runId: "test-run-2",
      };

      const progression1 = progressionManager.initializeRun(testVirtualDollar);
      const progression2 = progressionManager.initializeRun(dollar2);

      expect(progression1.runId).toBe("test-run-1");
      expect(progression2.runId).toBe("test-run-2");
      expect(progressionManager.getActiveRuns()).toHaveLength(2);
    });
  });

  describe("Game Result Processing", () => {
    beforeEach(() => {
      progressionManager.initializeRun(testVirtualDollar);
    });

    test("should advance level and calculate winnings on win", () => {
      // Win at Level 1
      const progression = progressionManager.processGameResult(
        testVirtualDollar,
        GameResult.WIN
      );

      expect(progression.gamesWonInRun).toBe(1);
      expect(progression.currentWinnings).toBe(1.8); // $1.80 for Level 1 win
      expect(progression.currentLevel).toBe(2); // Advanced to Level 2
      expect(progression.isComplete).toBe(false);
    });

    test("should complete run immediately on loss", () => {
      const progression = progressionManager.processGameResult(
        testVirtualDollar,
        GameResult.LOSS
      );

      expect(progression.isComplete).toBe(true);
      expect(progression.completionReason).toBe("LOSS");
      expect(progression.currentWinnings).toBe(0);
      expect(progression.gamesWonInRun).toBe(0);
      expect(progression.completedAt).not.toBe(null);
    });

    test("should progress through multiple levels correctly", () => {
      // Win at Level 1: $1 bet → $1.80 win → advance to Level 2
      let progression = progressionManager.processGameResult(
        testVirtualDollar,
        GameResult.WIN
      );
      expect(progression.currentLevel).toBe(2);
      expect(progression.currentWinnings).toBe(1.8);

      // Win at Level 2: $2 bet → $3.60 win → advance to Level 3 (cumulative: $5.40)
      progression = progressionManager.processGameResult(
        testVirtualDollar,
        GameResult.WIN
      );
      expect(progression.currentLevel).toBe(3);
      expect(progression.currentWinnings).toBe(5.4);

      // Win at Level 3: $4 bet → $5.40 win → advance to Level 4 (cumulative: $10.80)
      progression = progressionManager.processGameResult(
        testVirtualDollar,
        GameResult.WIN
      );
      expect(progression.currentLevel).toBe(4);
      expect(progression.currentWinnings).toBe(10.8);

      expect(progression.gamesWonInRun).toBe(3);
    });

    test("should complete run automatically at Level 10 (jackpot)", () => {
      // Simulate progression to Level 10
      for (let level = 1; level < 10; level++) {
        progressionManager.processGameResult(testVirtualDollar, GameResult.WIN);
      }

      // Win at Level 10 should trigger jackpot completion
      const progression = progressionManager.processGameResult(
        testVirtualDollar,
        GameResult.WIN
      );

      expect(progression.isComplete).toBe(true);
      expect(progression.completionReason).toBe("JACKPOT");
      expect(progression.currentWinnings).toBe(921.6); // Level 10: 512 × 1.8 = $921.60
      expect(progression.gamesWonInRun).toBe(10);

      const completedRun = progressionManager.getCompletedRun("test-run-1");
      expect(completedRun).not.toBe(null);
      expect(completedRun!.wasJackpot).toBe(true);
      expect(completedRun!.totalWinnings).toBe(921.6);
    });

    test("should throw error when processing result for non-existent run", () => {
      const unknownDollar: VirtualDollar = {
        ...testVirtualDollar,
        runId: "unknown-run",
      };

      expect(() => {
        progressionManager.processGameResult(unknownDollar, GameResult.WIN);
      }).toThrow("No active run found for unknown-run");
    });

    test("should throw error when processing result for completed run", () => {
      // Complete the run first
      progressionManager.processGameResult(testVirtualDollar, GameResult.LOSS);

      // Once completed, the run is moved to completed runs and is no longer active
      expect(() => {
        progressionManager.processGameResult(testVirtualDollar, GameResult.WIN);
      }).toThrow("No active run found for test-run-1");
    });
  });

  describe("Current Bet and Potential Winnings", () => {
    beforeEach(() => {
      progressionManager.initializeRun(testVirtualDollar);
    });

    test("should return correct current bet for each level", () => {
      expect(progressionManager.getCurrentBet("test-run-1")).toBe(1); // Level 1

      progressionManager.processGameResult(testVirtualDollar, GameResult.WIN);
      expect(progressionManager.getCurrentBet("test-run-1")).toBe(2); // Level 2

      progressionManager.processGameResult(testVirtualDollar, GameResult.WIN);
      expect(progressionManager.getCurrentBet("test-run-1")).toBe(4); // Level 3
    });

    test("should return correct potential winnings for each level", () => {
      expect(progressionManager.getPotentialWinnings("test-run-1")).toBe(1.8); // Level 1 → $1.80

      progressionManager.processGameResult(testVirtualDollar, GameResult.WIN);
      expect(progressionManager.getPotentialWinnings("test-run-1")).toBe(3.6); // Level 2 → $3.60

      progressionManager.processGameResult(testVirtualDollar, GameResult.WIN);
      expect(progressionManager.getPotentialWinnings("test-run-1")).toBe(5.4); // Level 3 → $5.40
    });

    test("should throw error for non-existent run", () => {
      expect(() => {
        progressionManager.getCurrentBet("unknown-run");
      }).toThrow("No active run found for unknown-run");

      expect(() => {
        progressionManager.getPotentialWinnings("unknown-run");
      }).toThrow("No active run found for unknown-run");
    });
  });

  describe("Run State Management", () => {
    test("should retrieve active run state", () => {
      const progression = progressionManager.initializeRun(testVirtualDollar);
      const retrieved = progressionManager.getRunState("test-run-1");

      expect(retrieved).not.toBe(null);
      expect(retrieved!.runId).toBe(progression.runId);
      expect(retrieved!.currentLevel).toBe(progression.currentLevel);
    });

    test("should return null for non-existent run state", () => {
      const retrieved = progressionManager.getRunState("unknown-run");
      expect(retrieved).toBe(null);
    });

    test("should track multiple active runs", () => {
      const dollar2: VirtualDollar = {
        ...testVirtualDollar,
        id: "dollar-2",
        runId: "run-2",
      };
      const dollar3: VirtualDollar = {
        ...testVirtualDollar,
        id: "dollar-3",
        runId: "run-3",
      };

      progressionManager.initializeRun(testVirtualDollar);
      progressionManager.initializeRun(dollar2);
      progressionManager.initializeRun(dollar3);

      const activeRuns = progressionManager.getActiveRuns();
      expect(activeRuns).toHaveLength(3);

      const runIds = activeRuns.map((run) => run.runId);
      expect(runIds).toContain("test-run-1");
      expect(runIds).toContain("run-2");
      expect(runIds).toContain("run-3");
    });

    test("should move runs from active to completed on completion", () => {
      progressionManager.initializeRun(testVirtualDollar);
      expect(progressionManager.getActiveRuns()).toHaveLength(1);
      expect(progressionManager.getCompletedRuns()).toHaveLength(0);

      // Complete the run
      progressionManager.processGameResult(testVirtualDollar, GameResult.LOSS);

      expect(progressionManager.getActiveRuns()).toHaveLength(0);
      expect(progressionManager.getCompletedRuns()).toHaveLength(1);
    });
  });

  describe("Progression Validation", () => {
    test("should validate correct progression state", () => {
      const progression: RunProgressionState = {
        runId: "test-run",
        currentLevel: 5,
        gamesWonInRun: 4,
        currentWinnings: 32,
        isComplete: false,
        completionReason: null,
        completedAt: null,
      };

      const result = progressionManager.validateProgression(progression);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should detect invalid progression state", () => {
      const progression: RunProgressionState = {
        runId: "",
        currentLevel: 0 as BettingLevel,
        gamesWonInRun: -1,
        currentWinnings: -10,
        isComplete: true,
        completionReason: null,
        completedAt: null,
      };

      const result = progressionManager.validateProgression(progression);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain("Run ID is required");
      expect(result.errors).toContain("Current level must be between 1 and 10");
      expect(result.errors).toContain("Games won in run cannot be negative");
      expect(result.errors).toContain("Current winnings cannot be negative");
    });
  });

  describe("Independent Run Integration Tests", () => {
    test("should simulate complete independent run from Level 1 to jackpot", () => {
      progressionManager.initializeRun(testVirtualDollar);

      let progression = progressionManager.getRunState("test-run-1")!;
      expect(progression.currentLevel).toBe(1);

      // Win 10 games in a row to reach jackpot
      for (let level = 1; level <= 10; level++) {
        progression = progressionManager.processGameResult(
          testVirtualDollar,
          GameResult.WIN
        );

        if (level < 10) {
          expect(progression.isComplete).toBe(false);
          expect(progression.currentLevel).toBe(level + 1);
        } else {
          // Level 10 win triggers jackpot completion
          expect(progression.isComplete).toBe(true);
          expect(progression.completionReason).toBe("JACKPOT");
          expect(progression.currentWinnings).toBe(921.6);
        }
      }

      const completedRun = progressionManager.getCompletedRun("test-run-1")!;
      expect(completedRun.wasJackpot).toBe(true);
      expect(completedRun.totalWinnings).toBe(921.6);
      expect(completedRun.gamesPlayedInRun).toBe(10);
    });

    test("should simulate independent run ending in loss at various levels", () => {
      const levels = [1, 3, 7];

      for (const lossLevel of levels) {
        const dollar: VirtualDollar = {
          ...testVirtualDollar,
          id: `dollar-loss-${lossLevel}`,
          runId: `run-loss-${lossLevel}`,
        };

        progressionManager.initializeRun(dollar);

        // Win up to the loss level - 1
        for (let level = 1; level < lossLevel; level++) {
          progressionManager.processGameResult(dollar, GameResult.WIN);
        }

        // Lose at the target level
        const progression = progressionManager.processGameResult(
          dollar,
          GameResult.LOSS
        );

        expect(progression.isComplete).toBe(true);
        expect(progression.completionReason).toBe("LOSS");
        expect(progression.currentWinnings).toBe(0);

        const completedRun = progressionManager.getCompletedRun(
          `run-loss-${lossLevel}`
        )!;
        expect(completedRun.wasJackpot).toBe(false);
        expect(completedRun.wasCashedOut).toBe(false);
        expect(completedRun.totalWinnings).toBe(0);
        expect(completedRun.playerPayout).toBe(0);
      }
    });
  });

  describe("Cash-Out Decision Logic Tests", () => {
    beforeEach(() => {
      progressionManager.initializeRun(testVirtualDollar);
    });

    test("should require at least one win before allowing cash-out", () => {
      const decision = progressionManager.makeCashOutDecision(
        testVirtualDollar,
        CashOutStrategy.CONSERVATIVE
      );
      expect(decision).toBe(CashOutDecision.CONTINUE);
    });

    test("should test conservative cash-out strategy", () => {
      // Win a few games to get to Level 4 (cumulative: $10.80 winnings)
      progressionManager.processGameResult(testVirtualDollar, GameResult.WIN); // Level 1 → 2, $1.80 winnings
      progressionManager.processGameResult(testVirtualDollar, GameResult.WIN); // Level 2 → 3, cumulative: $5.40 winnings
      progressionManager.processGameResult(testVirtualDollar, GameResult.WIN); // Level 3 → 4, cumulative: $10.80 winnings

      // Conservative strategy should cash out at Level 4 with $10.80 winnings
      const decision = progressionManager.makeCashOutDecision(
        testVirtualDollar,
        CashOutStrategy.CONSERVATIVE
      );
      expect(decision).toBe(CashOutDecision.CASH_OUT);
    });

    test("should test balanced cash-out strategy", () => {
      // Win games to get to Level 7 (cumulative: $75.60 winnings)
      for (let i = 0; i < 6; i++) {
        progressionManager.processGameResult(testVirtualDollar, GameResult.WIN);
      }

      // Balanced strategy should cash out at Level 7 with $75.60 winnings
      const decision = progressionManager.makeCashOutDecision(
        testVirtualDollar,
        CashOutStrategy.BALANCED
      );
      expect(decision).toBe(CashOutDecision.CASH_OUT);
    });

    test("should test aggressive cash-out strategy", () => {
      // Win games to get to Level 8 (cumulative: $100.80 winnings)
      for (let i = 0; i < 7; i++) {
        progressionManager.processGameResult(testVirtualDollar, GameResult.WIN);
      }

      // Aggressive strategy should continue at Level 8
      const decision = progressionManager.makeCashOutDecision(
        testVirtualDollar,
        CashOutStrategy.AGGRESSIVE
      );
      expect(decision).toBe(CashOutDecision.CONTINUE);
    });

    test("should process cash-out correctly", () => {
      // Win a few games first
      progressionManager.processGameResult(testVirtualDollar, GameResult.WIN); // Level 1 → 2, $1.80
      progressionManager.processGameResult(testVirtualDollar, GameResult.WIN); // Level 2 → 3, cumulative: $5.40

      // Cash out at Level 3
      const result = progressionManager.processCashOut("test-run-1");

      expect(result.runId).toBe("test-run-1");
      expect(result.wasCashedOut).toBe(true);
      expect(result.wasJackpot).toBe(false);
      expect(result.totalWinnings).toBe(5.4);
      expect(result.charityContribution).toBe(5.4 * 0.15); // 15% charity
      expect(result.playerPayout).toBe(5.4 * 0.85); // 85% to player
    });
  });

  describe("New Dollar Creation After Run Completion", () => {
    test("should allow new run creation after loss", () => {
      // Initialize and complete a run with loss
      progressionManager.initializeRun(testVirtualDollar);
      const lostRun = progressionManager.processGameResult(
        testVirtualDollar,
        GameResult.LOSS
      );

      expect(lostRun.isComplete).toBe(true);
      expect(lostRun.completionReason).toBe("LOSS");

      // Create a new dollar for another run
      const newDollar: VirtualDollar = {
        ...testVirtualDollar,
        id: "test-dollar-2",
        runId: "test-run-2",
        createdAt: new Date(),
      };

      // Should be able to initialize a new run
      const newRunProgression = progressionManager.initializeRun(newDollar);
      expect(newRunProgression.runId).toBe("test-run-2");
      expect(newRunProgression.currentLevel).toBe(1);
      expect(newRunProgression.gamesWonInRun).toBe(0);
      expect(newRunProgression.currentWinnings).toBe(0);
      expect(newRunProgression.isComplete).toBe(false);

      // Should have one completed run and one active run
      expect(progressionManager.getCompletedRuns()).toHaveLength(1);
      expect(progressionManager.getActiveRuns()).toHaveLength(1);
    });

    test("should allow new run creation after cash-out", () => {
      // Initialize and win some games
      progressionManager.initializeRun(testVirtualDollar);
      progressionManager.processGameResult(testVirtualDollar, GameResult.WIN); // Level 1 → 2
      progressionManager.processGameResult(testVirtualDollar, GameResult.WIN); // Level 2 → 3

      // Cash out
      const cashOutResult = progressionManager.processCashOut("test-run-1");
      expect(cashOutResult.wasCashedOut).toBe(true);

      // Create a new dollar for another run
      const newDollar: VirtualDollar = {
        ...testVirtualDollar,
        id: "test-dollar-2",
        runId: "test-run-2",
        createdAt: new Date(),
      };

      // Should be able to initialize a new run
      const newRunProgression = progressionManager.initializeRun(newDollar);
      expect(newRunProgression.runId).toBe("test-run-2");
      expect(newRunProgression.currentLevel).toBe(1);

      // Should have one completed run and one active run
      expect(progressionManager.getCompletedRuns()).toHaveLength(1);
      expect(progressionManager.getActiveRuns()).toHaveLength(1);
    });

    test("should allow new run creation after jackpot", () => {
      // Initialize and simulate jackpot run
      progressionManager.initializeRun(testVirtualDollar);

      // Win all 10 games to reach jackpot
      for (let level = 1; level <= 10; level++) {
        const result = progressionManager.processGameResult(
          testVirtualDollar,
          GameResult.WIN
        );
        if (level === 10) {
          expect(result.completionReason).toBe("JACKPOT");
        }
      }

      // Create a new dollar for another run
      const newDollar: VirtualDollar = {
        ...testVirtualDollar,
        id: "test-dollar-2",
        runId: "test-run-2",
        createdAt: new Date(),
      };

      // Should be able to initialize a new run
      const newRunProgression = progressionManager.initializeRun(newDollar);
      expect(newRunProgression.runId).toBe("test-run-2");
      expect(newRunProgression.currentLevel).toBe(1);

      // Should have one completed jackpot run and one active run
      expect(progressionManager.getCompletedRuns()).toHaveLength(1);
      expect(progressionManager.getActiveRuns()).toHaveLength(1);

      const jackpotRun = progressionManager.getCompletedRun("test-run-1");
      expect(jackpotRun!.wasJackpot).toBe(true);
      expect(jackpotRun!.totalWinnings).toBe(921.6);
    });

    test("should track multiple independent runs per player", () => {
      const playerId = "multi-run-player";
      const runs: VirtualDollar[] = [];

      // Create 3 independent runs for the same player
      for (let i = 1; i <= 3; i++) {
        const dollar: VirtualDollar = {
          ...testVirtualDollar,
          id: `dollar-${i}`,
          runId: `run-${i}`,
          ownerId: playerId,
        };
        runs.push(dollar);
        progressionManager.initializeRun(dollar);
      }

      // All runs should be active
      expect(progressionManager.getActiveRuns()).toHaveLength(3);

      // Complete first run with loss
      progressionManager.processGameResult(runs[0], GameResult.LOSS);

      // Complete second run with cash-out
      progressionManager.processGameResult(runs[1], GameResult.WIN); // Level 1 → 2, $1.80 winnings
      progressionManager.processCashOut("run-2");

      // Third run still active
      expect(progressionManager.getActiveRuns()).toHaveLength(1);
      expect(progressionManager.getCompletedRuns()).toHaveLength(2);

      // Verify different completion types
      const lossRun = progressionManager.getCompletedRun("run-1");
      const cashOutRun = progressionManager.getCompletedRun("run-2");

      expect(lossRun!.wasJackpot).toBe(false);
      expect(lossRun!.wasCashedOut).toBe(false);
      expect(lossRun!.totalWinnings).toBe(0);

      expect(cashOutRun!.wasJackpot).toBe(false);
      expect(cashOutRun!.wasCashedOut).toBe(true);
      expect(cashOutRun!.totalWinnings).toBe(1.8);
    });
  });
});
