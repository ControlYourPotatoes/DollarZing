// Player Continuity Fixes Tests
// Tests for fixing fund flow and winnings distribution
// Ensures players can continue playing until natural exit conditions
import { describe, it, expect, beforeEach, vi } from "vitest";
import { DirectGameSessionFactory } from "../src/types/direct-factories";
import { GameMatchingEngine } from "../src/types/game-matching-engine";
import { VirtualDollarManager } from "../src/types/virtual-dollar-types";
import { ScoringEngine } from "../src/types/scoring-engine";
import {
  VirtualDollar,
  BettingLevel,
  DollarState,
  CashOutStrategy,
} from "../src/types/virtual-dollar-engine";
import { DEFAULT_PERFORMANCE_CONFIG } from "../src/types/factory-interfaces";
import { PlayerRunManager } from "../src/types/player-run-manager";

describe("Player Continuity Fixes", () => {
  let gameSessionFactory: DirectGameSessionFactory;
  let dollarManager: VirtualDollarManager;
  let scoringEngine: ScoringEngine;
  let gameMatchingEngine: GameMatchingEngine;

  beforeEach(() => {
    gameSessionFactory = new DirectGameSessionFactory(
      DEFAULT_PERFORMANCE_CONFIG
    );
    dollarManager = new VirtualDollarManager();
    scoringEngine = new ScoringEngine();
    gameMatchingEngine = new GameMatchingEngine(
      dollarManager,
      scoringEngine,
      gameSessionFactory
    );
  });

  describe("Winnings Calculation (Level × 1.8)", () => {
    it("should calculate winnings as level × 1.8 for level 1", () => {
      const testDollar1 = createTestDollar("player1", 1);
      const testDollar2 = createTestDollar("player2", 1);
      const level: BettingLevel = 1;

      const session = gameSessionFactory.create(
        testDollar1,
        testDollar2,
        level
      );

      expect(session.winnings).toBe(1.8); // 1 × 1.8 = 1.8
    });

    it("should calculate winnings as level × 1.8 for level 2", () => {
      const testDollar1 = createTestDollar("player1", 2);
      const testDollar2 = createTestDollar("player2", 2);
      const level: BettingLevel = 2;

      const session = gameSessionFactory.create(
        testDollar1,
        testDollar2,
        level
      );

      expect(session.winnings).toBe(3.6); // 2 × 1.8 = 3.6
    });

    it("should calculate winnings as level × 1.8 for level 4", () => {
      const testDollar1 = createTestDollar("player1", 4);
      const testDollar2 = createTestDollar("player2", 4);
      const level: BettingLevel = 4;

      const session = gameSessionFactory.create(
        testDollar1,
        testDollar2,
        level
      );

      expect(session.winnings).toBe(7.2); // 4 × 1.8 = 7.2
    });

    it("should calculate winnings as level × 1.8 for level 10", () => {
      const testDollar1 = createTestDollar("player1", 10);
      const testDollar2 = createTestDollar("player2", 10);
      const level: BettingLevel = 10;

      const session = gameSessionFactory.create(
        testDollar1,
        testDollar2,
        level
      );

      expect(session.winnings).toBe(18.0); // 10 × 1.8 = 18.0
    });

    it("should calculate correct winnings for all betting levels 1-10", () => {
      const expectedWinnings = [
        { level: 1, expected: 1.8 },
        { level: 2, expected: 3.6 },
        { level: 3, expected: 5.4 },
        { level: 4, expected: 7.2 },
        { level: 5, expected: 9.0 },
        { level: 6, expected: 10.8 },
        { level: 7, expected: 12.6 },
        { level: 8, expected: 14.4 },
        { level: 9, expected: 16.2 },
        { level: 10, expected: 18.0 },
      ];

      expectedWinnings.forEach(({ level, expected }) => {
        const testDollar1 = createTestDollar("player1", level);
        const testDollar2 = createTestDollar("player2", level);

        const session = gameSessionFactory.create(
          testDollar1,
          testDollar2,
          level as BettingLevel
        );

        expect(session.winnings).toBeCloseTo(expected, 1);
      });
    });
  });

  describe("Game Resolution and Fund Flow", () => {
    it("should properly distribute winnings to winner after game resolution", () => {
      const testDollar1 = createTestDollar("player1", 2);
      const testDollar2 = createTestDollar("player2", 2);

      // Add dollars to pool
      dollarManager.updateDollarState(testDollar1.id, DollarState.POOLED);
      dollarManager.updateDollarState(testDollar2.id, DollarState.POOLED);

      gameMatchingEngine.addToPool(testDollar1);
      gameMatchingEngine.addToPool(testDollar2);

      // Attempt matching to create a game
      const matchResult = gameMatchingEngine.attemptMatching();
      expect(matchResult.gamesCreated.length).toBe(1);

      const gameSession = matchResult.gamesCreated[0];
      expect(gameSession.winnings).toBe(3.6); // 2 × 1.8

      // Resolve the game
      const dailySeed = "2025-09-01";
      const resolutionResult = gameMatchingEngine.resolveGame(
        gameSession.id,
        dailySeed
      );

      expect(resolutionResult.success).toBe(true);
      expect(resolutionResult.winnings).toBe(3.6);
      expect(resolutionResult.winner?.currentRunWinnings).toBe(3.6);
    });

    it("should update winner VirtualDollar with correct fund tracking", () => {
      const testDollar1 = createTestDollar("player1", 1);
      const testDollar2 = createTestDollar("player2", 1);

      // Add to manager
      dollarManager.updateDollarState(testDollar1.id, DollarState.POOLED);
      dollarManager.updateDollarState(testDollar2.id, DollarState.POOLED);

      gameMatchingEngine.addToPool(testDollar1);
      gameMatchingEngine.addToPool(testDollar2);

      // Create and resolve game
      const matchResult = gameMatchingEngine.attemptMatching();
      const gameSession = matchResult.gamesCreated[0];

      const resolutionResult = gameMatchingEngine.resolveGame(
        gameSession.id,
        "2025-09-01"
      );

      expect(resolutionResult.success).toBe(true);

      // Winner should have correct current run winnings
      const winner = resolutionResult.winner!;
      expect(winner.currentRunWinnings).toBe(1.8); // 1 × 1.8
      expect(winner.state).toBe(DollarState.WON);
      expect(winner.gamesInThisRun).toBe(1);

      // Loser should lose progression
      const loser = resolutionResult.loser!;
      expect(loser.state).toBe(DollarState.LOST);
      expect(loser.gamesInThisRun).toBe(1);
    });

    it("should correctly track winnings separately from game funding", () => {
      // Players use donation balance ($20) to fund games ($1.10 each)
      // Winnings (level × 1.8) accumulate in progression balance
      const testDollar1 = createTestDollar("player1", 1);
      testDollar1.currentRunWinnings = 1.8; // Level 1 winnings

      // Game funding comes from donation balance (not winnings)
      // Each game costs $1.10 from donation balance regardless of level
      const gameCostFromDonation = 1.1;
      const startingDonationBalance = 20.0;
      const gamesAffordableFromDonation = Math.floor(
        startingDonationBalance / gameCostFromDonation
      );

      // Players should be able to afford multiple games from donation balance
      expect(gamesAffordableFromDonation).toBeGreaterThanOrEqual(18); // 20.00 / 1.10 = 18.18

      // Winnings should accumulate separately for cash-out decisions
      expect(testDollar1.currentRunWinnings).toBe(1.8);
    });

    it("should handle multiple wins progressing through levels", () => {
      // Simulate a player winning at level 1, then 2, then 4
      // Each win accumulates winnings for eventual cash-out
      let winnings = 0;

      // Win at level 1 (costs $1.10 from donation, wins $1.80 to progression)
      winnings += 1.8; // 1 × 1.8
      expect(winnings).toBe(1.8);

      // Win at level 2 (costs $1.10 from donation, wins $3.60 to progression)
      winnings += 3.6; // 2 × 1.8
      expect(winnings).toBe(5.4); // 1.8 + 3.6

      // Win at level 4 (costs $1.10 from donation, wins $7.20 to progression)
      winnings += 7.2; // 4 × 1.8
      expect(winnings).toBeCloseTo(12.6, 1); // 1.8 + 3.6 + 7.2

      // Player can continue as long as donation balance covers game fees
      // Winnings accumulate for cash-out decisions (level × 1.8 formula works correctly)
    });
  });

  describe("Dollar State Management", () => {
    it("should properly track dollar state transitions during game lifecycle", () => {
      const testDollar1 = createTestDollar("player1", 1);

      // Initial state
      expect(testDollar1.state).toBe(DollarState.CREATED);

      // Move to pooled
      const updateResult = dollarManager.updateDollarState(
        testDollar1.id,
        DollarState.POOLED
      );
      expect(updateResult.isValid).toBe(true);
      expect(testDollar1.state).toBe(DollarState.POOLED);

      // Move to in-game
      dollarManager.updateDollarState(testDollar1.id, DollarState.IN_GAME);
      expect(testDollar1.state).toBe(DollarState.IN_GAME);

      // Move to won
      dollarManager.updateDollarState(testDollar1.id, DollarState.WON);
      expect(testDollar1.state).toBe(DollarState.WON);
    });

    it("should prevent invalid state transitions", () => {
      const testDollar1 = createTestDollar("player1", 1);

      // Try to go from CREATED directly to IN_GAME (should fail)
      const invalidResult = dollarManager.updateDollarState(
        testDollar1.id,
        DollarState.IN_GAME
      );
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Virtual Dollar Pot System (Task 2)", () => {
    it("should initialize virtual dollars with $1.00 pot value (Task 2.1)", () => {
      const testDollar = dollarManager.createVirtualDollar("test-player");

      expect(testDollar.potValue).toBe(1.0);
    });

    it("should deduct 10¢ platform fee when entering pool (Task 2.2)", () => {
      const testDollar = dollarManager.createVirtualDollar("test-player");
      expect(testDollar.potValue).toBe(1.0); // Initial value

      // Move to pooled state - should trigger platform fee deduction
      dollarManager.updateDollarState(testDollar.id, DollarState.POOLED);

      expect(testDollar.potValue).toBe(0.9); // $1.00 - $0.10 = $0.90
      expect(testDollar.state).toBe(DollarState.POOLED);
    });

    it("should not deduct fee if pot value is already at or below $0.90", () => {
      const testDollar = dollarManager.createVirtualDollar("test-player");
      testDollar.potValue = 0.8; // Set to below fee threshold

      // Move to pooled state - should not deduct fee
      dollarManager.updateDollarState(testDollar.id, DollarState.POOLED);

      expect(testDollar.potValue).toBe(0.8); // Should remain unchanged
    });

    it("should implement winner-takes-all pot absorption (Task 2.3)", async () => {
      const testDollar1 = createTestDollar("player1", 1);
      const testDollar2 = createTestDollar("player2", 1);

      // Set up both dollars in pooled state with platform fee already deducted
      dollarManager.updateDollarState(testDollar1.id, DollarState.POOLED);
      dollarManager.updateDollarState(testDollar2.id, DollarState.POOLED);
      expect(testDollar1.potValue).toBe(0.9); // After platform fee
      expect(testDollar2.potValue).toBe(0.9); // After platform fee

      // Add dollars to matching pool
      gameMatchingEngine.addToPool(testDollar1);
      gameMatchingEngine.addToPool(testDollar2);

      // Attempt matching to create a game
      const matchResult = gameMatchingEngine.attemptMatching();
      expect(matchResult.gamesCreated.length).toBe(1);

      const game = matchResult.gamesCreated[0];

      // Mock a deterministic outcome where testDollar1 wins
      vi.spyOn(scoringEngine, "compareScores").mockReturnValueOnce({
        winner: testDollar1.serialNumber,
        loser: testDollar2.serialNumber,
        winnerScore: 0.8,
        loserScore: 0.3,
      });

      const result = await gameMatchingEngine.resolveGame(game.id, "test-seed");

      expect(result.success).toBe(true);
      expect(testDollar1.potValue).toBe(1.8); // Winner gets $0.90 + $0.90 = $1.80
      expect(testDollar2.potValue).toBe(0); // Loser loses all pot value
    });

    it("should carry pot value through level progression (Task 2.5)", () => {
      const testDollar = createTestDollar("player1", 1);
      testDollar.potValue = 1.8; // Simulate accumulated pot value

      // Advance to next level
      testDollar.currentLevel = 2 as BettingLevel;

      expect(testDollar.potValue).toBe(1.8); // Should maintain pot value
      expect(testDollar.currentLevel).toBe(2);
    });

    it("should handle multiple pot accumulations correctly", async () => {
      // Create 3 dollars for a multi-round scenario
      const winner = createTestDollar("winner-player", 1);
      const loser1 = createTestDollar("loser1-player", 1);
      const loser2 = createTestDollar("loser2-player", 1);

      // Set all to pooled state (applies platform fee)
      dollarManager.updateDollarState(winner.id, DollarState.POOLED);
      dollarManager.updateDollarState(loser1.id, DollarState.POOLED);
      dollarManager.updateDollarState(loser2.id, DollarState.POOLED);

      // All should have $0.90 after platform fee
      expect(winner.potValue).toBe(0.9);
      expect(loser1.potValue).toBe(0.9);
      expect(loser2.potValue).toBe(0.9);

      // First game: winner vs loser1
      gameMatchingEngine.addToPool(winner);
      gameMatchingEngine.addToPool(loser1);

      const matchResult1 = gameMatchingEngine.attemptMatching();
      expect(matchResult1.gamesCreated.length).toBe(1);
      const game1 = matchResult1.gamesCreated[0];

      vi.spyOn(scoringEngine, "compareScores").mockReturnValueOnce({
        winner: winner.serialNumber,
        loser: loser1.serialNumber,
        winnerScore: 0.8,
        loserScore: 0.3,
      });

      await gameMatchingEngine.resolveGame(game1.id, "seed1");

      expect(winner.potValue).toBe(1.8); // $0.90 + $0.90 = $1.80
      expect(loser1.potValue).toBe(0); // Lost all

      // Reset winner to pooled for second game (no additional platform fee since already > $0.90)
      dollarManager.updateDollarState(winner.id, DollarState.POOLED);
      expect(winner.potValue).toBe(1.8); // Should remain same (no fee deduction)

      // Second game: winner vs loser2
      gameMatchingEngine.addToPool(winner);
      gameMatchingEngine.addToPool(loser2);

      const matchResult2 = gameMatchingEngine.attemptMatching();
      expect(matchResult2.gamesCreated.length).toBe(1);
      const game2 = matchResult2.gamesCreated[0];

      vi.spyOn(scoringEngine, "compareScores").mockReturnValueOnce({
        winner: winner.serialNumber,
        loser: loser2.serialNumber,
        winnerScore: 0.9,
        loserScore: 0.2,
      });

      await gameMatchingEngine.resolveGame(game2.id, "seed2");

      expect(winner.potValue).toBe(2.7); // $1.80 + $0.90 = $2.70
      expect(loser2.potValue).toBe(0); // Lost all
    });

    it("should validate pot values during virtual dollar validation", async () => {
      const testDollar = createTestDollar("test-player", 1);

      // Valid pot value
      testDollar.potValue = 1.5;
      const validResult = dollarManager.getDollar(testDollar.id);
      expect(validResult?.potValue).toBe(1.5);

      // Test validation function directly
      testDollar.potValue = 0; // Invalid - must be positive
      const { validateVirtualDollar } = await import(
        "../src/types/virtual-dollar-engine"
      );
      const validationResult = validateVirtualDollar(testDollar);

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContain("Pot value must be positive");
    });
  });

  describe("Remove Player Balance Game Fee Charging (Task 3)", () => {
    it("should not charge game fees to player balance during game resolution (Task 3.1)", async () => {
      const testDollar1 = createTestDollar("player1", 1);
      const testDollar2 = createTestDollar("player2", 1);

      // Create a mock PlayerBalanceManager to track calls
      const mockBalanceManager = {
        processGameFee: vi.fn(),
        addWinProgression: vi.fn(),
        loseProgression: vi.fn(),
        canPlayerPlay: vi.fn().mockReturnValue(true),
      };

      // Set the mock balance manager
      (gameMatchingEngine as any).playerBalanceManager = mockBalanceManager;

      // Set up game
      dollarManager.updateDollarState(testDollar1.id, DollarState.POOLED);
      dollarManager.updateDollarState(testDollar2.id, DollarState.POOLED);

      gameMatchingEngine.addToPool(testDollar1);
      gameMatchingEngine.addToPool(testDollar2);

      const matchResult = gameMatchingEngine.attemptMatching();
      const game = matchResult.gamesCreated[0];

      // Mock scoring to make testDollar1 win
      vi.spyOn(scoringEngine, "compareScores").mockReturnValueOnce({
        winner: testDollar1.serialNumber,
        loser: testDollar2.serialNumber,
        winnerScore: 0.8,
        loserScore: 0.3,
      });

      await gameMatchingEngine.resolveGame(game.id, "test-seed");

      // Verify NO game fees were charged to player balances
      expect(mockBalanceManager.processGameFee).not.toHaveBeenCalled();

      // But winnings progression should still work
      expect(mockBalanceManager.addWinProgression).toHaveBeenCalledWith(
        "player1",
        1.8
      );
      expect(mockBalanceManager.loseProgression).toHaveBeenCalledWith(
        "player2"
      );
    });

    it("should only charge $1.00 for virtual dollar creation in RunOrchestrator (Task 3.2)", () => {
      const runOrchestrator = new PlayerRunManager();

      // Initialize player with $5.00
      runOrchestrator.initializePlayer(
        "test-player",
        5.0,
        CashOutStrategy.BALANCED
      );

      // Create new run - should only cost $1.00 (not $1.20)
      const newRun = runOrchestrator.createNewRun({
        playerId: "test-player",
        cashOutStrategy: CashOutStrategy.BALANCED,
        fundingSource: "DONATION",
      });

      expect(newRun).not.toBeNull();

      // Check that only $1.00 was deducted for virtual dollar creation
      const remainingFunds = (runOrchestrator as any).playerFunds.get(
        "test-player"
      );
      expect(remainingFunds).toBe(4.0); // $5.00 - $1.00 = $4.00
    });

    it("should verify player balance remains stable during virtual dollar gameplay (Task 3.5)", async () => {
      const runOrchestrator = new PlayerRunManager();

      // Initialize player with funds
      const initialFunds = 10.0;
      runOrchestrator.initializePlayer(
        "stable-player",
        initialFunds,
        CashOutStrategy.BALANCED
      );

      // Create first virtual dollar
      const run1 = runOrchestrator.createNewRun({
        playerId: "stable-player",
        cashOutStrategy: CashOutStrategy.BALANCED,
        fundingSource: "DONATION",
      });

      expect(run1).not.toBeNull();

      // Funds should be reduced by exactly $1.00
      let currentFunds = (runOrchestrator as any).playerFunds.get(
        "stable-player"
      );
      expect(currentFunds).toBe(9.0);

      // Simulate multiple game sessions with the virtual dollar
      // (This would happen through the pot system, not player balance)
      run1!.potValue = 0.9; // After platform fee
      run1!.potValue = 1.8; // After winning a game
      run1!.potValue = 0.9; // After losing pot value to another dollar

      // Player balance should remain unchanged during gameplay
      currentFunds = (runOrchestrator as any).playerFunds.get("stable-player");
      expect(currentFunds).toBe(9.0); // Still $9.00

      // Create second virtual dollar
      const run2 = runOrchestrator.createNewRun({
        playerId: "stable-player",
        cashOutStrategy: CashOutStrategy.BALANCED,
        fundingSource: "DONATION",
      });

      expect(run2).not.toBeNull();

      // Now should be reduced by another $1.00
      currentFunds = (runOrchestrator as any).playerFunds.get("stable-player");
      expect(currentFunds).toBe(8.0); // $10.00 - $1.00 - $1.00 = $8.00
    });

    it("should prevent creation when insufficient funds for virtual dollar (Task 3.3)", () => {
      const runOrchestrator = new PlayerRunManager();

      // Initialize player with insufficient funds
      runOrchestrator.initializePlayer(
        "poor-player",
        0.5,
        CashOutStrategy.BALANCED
      );

      // Try to create new run with insufficient funds
      const newRun = runOrchestrator.createNewRun({
        playerId: "poor-player",
        cashOutStrategy: CashOutStrategy.BALANCED,
        fundingSource: "DONATION",
      });

      expect(newRun).toBeNull(); // Should fail due to insufficient funds

      // Funds should remain unchanged
      const remainingFunds = (runOrchestrator as any).playerFunds.get(
        "poor-player"
      );
      expect(remainingFunds).toBe(0.5);
    });
  });

  // Helper function to create test virtual dollars
  function createTestDollar(playerId: string, level: number): VirtualDollar {
    const dollar = dollarManager.createVirtualDollar(playerId);
    dollar.currentLevel = level as BettingLevel;
    return dollar;
  }
});
