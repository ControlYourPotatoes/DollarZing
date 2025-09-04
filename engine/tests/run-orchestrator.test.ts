// Run Orchestrator Tests - Tests for run completion and new run initiation logic
// Tests coordination between progression management and player funding

import {
  PlayerRunManager,
  NewRunRequest,
  RunCompletionEvent,
} from "../src/types/player-run-manager";

import {
  VirtualDollar,
  GameResult,
  CashOutStrategy,
} from "../src/types/virtual-dollar-engine";

describe("PlayerRunManager - Run Completion and New Run Logic Tests", () => {
  let orchestrator: PlayerRunManager;

  beforeEach(() => {
    orchestrator = new PlayerRunManager(undefined, undefined, 0.15); // 15% charity
  });

  describe("Player Initialization and Fund Management", () => {
    test("should initialize player with funds and strategy", () => {
      orchestrator.initializePlayer("player-1", 20.0, CashOutStrategy.BALANCED);

      expect(orchestrator.getPlayerFunds("player-1")).toBe(20.0);
      expect(orchestrator.getPlayerStrategy("player-1")).toBe(
        CashOutStrategy.BALANCED
      );
    });

    test("should track multiple players independently", () => {
      orchestrator.initializePlayer(
        "player-1",
        20.0,
        CashOutStrategy.CONSERVATIVE
      );
      orchestrator.initializePlayer(
        "player-2",
        50.0,
        CashOutStrategy.AGGRESSIVE
      );
      orchestrator.initializePlayer("player-3", 5.0, CashOutStrategy.BALANCED);

      expect(orchestrator.getPlayerFunds("player-1")).toBe(20.0);
      expect(orchestrator.getPlayerFunds("player-2")).toBe(50.0);
      expect(orchestrator.getPlayerFunds("player-3")).toBe(5.0);

      expect(orchestrator.getPlayerStrategy("player-1")).toBe(
        CashOutStrategy.CONSERVATIVE
      );
      expect(orchestrator.getPlayerStrategy("player-2")).toBe(
        CashOutStrategy.AGGRESSIVE
      );
      expect(orchestrator.getPlayerStrategy("player-3")).toBe(
        CashOutStrategy.BALANCED
      );
    });

    test("should allow fund additions", () => {
      orchestrator.initializePlayer("player-1", 10.0, CashOutStrategy.BALANCED);
      orchestrator.addPlayerFunds("player-1", 15.0);

      expect(orchestrator.getPlayerFunds("player-1")).toBe(25.0);
    });
  });

  describe("New Run Creation", () => {
    beforeEach(() => {
      orchestrator.initializePlayer("player-1", 20.0, CashOutStrategy.BALANCED);
    });

    test("should create new run when player has sufficient funds", () => {
      const request: NewRunRequest = {
        playerId: "player-1",
        cashOutStrategy: CashOutStrategy.CONSERVATIVE,
        fundingSource: "DONATION",
      };

      const newRun = orchestrator.createNewRun(request);

      expect(newRun).not.toBeNull();
      expect(newRun!.ownerId).toBe("player-1");
      expect(newRun!.isIndependentRun).toBe(true);
      expect(newRun!.currentLevel).toBe(1);

      // Should deduct game fee ($1.10)
      expect(orchestrator.getPlayerFunds("player-1")).toBe(18.9);
    });

    test("should reject new run when player has insufficient funds", () => {
      orchestrator.initializePlayer(
        "broke-player",
        0.5,
        CashOutStrategy.BALANCED
      );

      const request: NewRunRequest = {
        playerId: "broke-player",
        cashOutStrategy: CashOutStrategy.BALANCED,
        fundingSource: "DONATION",
      };

      const newRun = orchestrator.createNewRun(request);

      expect(newRun).toBeNull();
      expect(orchestrator.getPlayerFunds("broke-player")).toBe(0.5); // No funds deducted
    });

    test("should update player strategy when creating new run", () => {
      const request: NewRunRequest = {
        playerId: "player-1",
        cashOutStrategy: CashOutStrategy.AGGRESSIVE,
        fundingSource: "DONATION",
      };

      orchestrator.createNewRun(request);

      expect(orchestrator.getPlayerStrategy("player-1")).toBe(
        CashOutStrategy.AGGRESSIVE
      );
    });
  });

  describe("Game Result Processing and Run Completion", () => {
    let testRun: VirtualDollar;

    beforeEach(() => {
      orchestrator.initializePlayer(
        "player-1",
        20.0,
        CashOutStrategy.AGGRESSIVE
      ); // Use aggressive for jackpot test
      testRun = orchestrator.createNewRun({
        playerId: "player-1",
        cashOutStrategy: CashOutStrategy.AGGRESSIVE,
        fundingSource: "DONATION",
      })!;
    });

    test("should handle run completion on loss", () => {
      const completionEvent = orchestrator.processGameResult(
        testRun,
        GameResult.LOSS
      );

      expect(completionEvent).not.toBeNull();
      expect(completionEvent!.completionType).toBe("LOSS");
      expect(completionEvent!.totalWinnings).toBe(0);
      expect(completionEvent!.playerPayout).toBe(0);
      expect(completionEvent!.charityContribution).toBe(0);

      // Player funds unchanged (no winnings)
      expect(orchestrator.getPlayerFunds("player-1")).toBe(18.9);

      // Should still be able to create new run since funds > $1.10
      expect(completionEvent!.shouldCreateNewRun).toBe(true);
    });

    test("should handle run completion on jackpot", () => {
      // Simulate jackpot run (win 10 games)
      let completionEvent: RunCompletionEvent | null = null;

      for (let level = 1; level <= 10; level++) {
        completionEvent = orchestrator.processGameResult(
          testRun,
          GameResult.WIN
        );

        if (level < 10) {
          expect(completionEvent).toBeNull(); // Run continues
        }
      }

      expect(completionEvent).not.toBeNull();
      expect(completionEvent!.completionType).toBe("JACKPOT");
      expect(completionEvent!.totalWinnings).toBe(1024); // Level 10 jackpot
      expect(completionEvent!.charityContribution).toBe(1024 * 0.15); // 15% charity
      expect(completionEvent!.playerPayout).toBe(1024 * 0.85); // 85% to player

      // Player should have original funds minus game fee plus winnings
      const expectedFunds = 18.9 + 1024 * 0.85;
      expect(orchestrator.getPlayerFunds("player-1")).toBe(expectedFunds);
      expect(completionEvent!.shouldCreateNewRun).toBe(true);
    });

    test("should handle cash-out completion", () => {
      // For this test, create a new conservative player since testRun uses aggressive
      orchestrator.initializePlayer(
        "cash-out-player",
        20.0,
        CashOutStrategy.CONSERVATIVE
      );
      const cashOutRun = orchestrator.createNewRun({
        playerId: "cash-out-player",
        cashOutStrategy: CashOutStrategy.CONSERVATIVE,
        fundingSource: "DONATION",
      })!;

      // Win a few games with conservative strategy (should cash out early)
      orchestrator.processGameResult(cashOutRun, GameResult.WIN); // Level 1 → 2, $2
      orchestrator.processGameResult(cashOutRun, GameResult.WIN); // Level 2 → 3, $4

      // Conservative strategy should cash out at Level 4 with $8 winnings
      const completionEvent = orchestrator.processGameResult(
        cashOutRun,
        GameResult.WIN
      ); // Level 3 → 4, $8

      expect(completionEvent).not.toBeNull();
      expect(completionEvent!.completionType).toBe("CASH_OUT");
      expect(completionEvent!.totalWinnings).toBe(8); // Level 4 winnings
      expect(completionEvent!.charityContribution).toBe(8 * 0.15);
      expect(completionEvent!.playerPayout).toBe(8 * 0.85);

      const expectedFunds = 18.9 + 8 * 0.85;
      expect(orchestrator.getPlayerFunds("cash-out-player")).toBe(
        expectedFunds
      );
    });

    test("should continue run when no cash-out decision is made", () => {
      orchestrator.updatePlayerStrategy("player-1", CashOutStrategy.AGGRESSIVE); // Less likely to cash out

      // Win first game
      const result1 = orchestrator.processGameResult(testRun, GameResult.WIN);
      expect(result1).toBeNull(); // Run should continue

      // Win second game
      const result2 = orchestrator.processGameResult(testRun, GameResult.WIN);
      expect(result2).toBeNull(); // Run should still continue with aggressive strategy
    });
  });

  describe("Player Run Context", () => {
    beforeEach(() => {
      orchestrator.initializePlayer("player-1", 20.0, CashOutStrategy.BALANCED);
    });

    test("should provide accurate player run context with no runs", () => {
      const context = orchestrator.getPlayerRunContext("player-1");

      expect(context.playerId).toBe("player-1");
      expect(context.activeRuns).toHaveLength(0);
      expect(context.completedRuns).toHaveLength(0);
      expect(context.totalEarnings).toBe(0);
      expect(context.availableFunds).toBe(20.0);
      expect(context.canCreateNewRun).toBe(true);
    });

    test("should track active runs in context", () => {
      const run1 = orchestrator.createNewRun({
        playerId: "player-1",
        cashOutStrategy: CashOutStrategy.BALANCED,
        fundingSource: "DONATION",
      })!;

      const context = orchestrator.getPlayerRunContext("player-1");

      expect(context.activeRuns).toHaveLength(1);
      expect(context.activeRuns[0].id).toBe(run1.id);
      expect(context.availableFunds).toBe(18.9);
      expect(context.canCreateNewRun).toBe(true);
    });

    test("should track completed runs and earnings", () => {
      // Initialize a new player with conservative strategy for this test
      orchestrator.initializePlayer(
        "conservative-player",
        20.0,
        CashOutStrategy.CONSERVATIVE
      );

      const run1 = orchestrator.createNewRun({
        playerId: "conservative-player",
        cashOutStrategy: CashOutStrategy.CONSERVATIVE,
        fundingSource: "DONATION",
      })!;

      // Complete run with cash-out
      orchestrator.processGameResult(run1, GameResult.WIN); // Level 1→2: $2
      orchestrator.processGameResult(run1, GameResult.WIN); // Level 2→3: $4
      const completion = orchestrator.processGameResult(run1, GameResult.WIN); // Level 3→4: $8 - should cash out

      expect(completion).not.toBeNull();
      expect(completion!.completionType).toBe("CASH_OUT");

      const context = orchestrator.getPlayerRunContext("conservative-player");

      // Debug the issue by looking at all dollars for this player
      // The test is failing because context.activeRuns shows the dollar as 'created' instead of 'cashed_out'
      // This suggests the dollar state update isn't taking effect on the reference we have

      expect(context.activeRuns).toHaveLength(0);
      expect(context.completedRuns).toHaveLength(1);
      expect(context.completedRuns[0].wasCashedOut).toBe(true);
      expect(context.totalEarnings).toBe(8 * 0.85); // 85% of $8
      expect(context.canCreateNewRun).toBe(true);
    });

    test("should correctly determine when player cannot create new run", () => {
      orchestrator.initializePlayer(
        "poor-player",
        1.0,
        CashOutStrategy.BALANCED
      );

      const context = orchestrator.getPlayerRunContext("poor-player");
      expect(context.canCreateNewRun).toBe(false); // $1.00 < $1.10 required
    });
  });

  describe("Multiple Player Management", () => {
    beforeEach(() => {
      orchestrator.initializePlayer(
        "player-1",
        20.0,
        CashOutStrategy.CONSERVATIVE
      );
      orchestrator.initializePlayer(
        "player-2",
        50.0,
        CashOutStrategy.AGGRESSIVE
      );
      orchestrator.initializePlayer("player-3", 5.0, CashOutStrategy.BALANCED);
    });

    test("should track total funds across all players", () => {
      expect(orchestrator.getTotalPlayerFunds()).toBe(75.0);

      // Create some runs
      orchestrator.createNewRun({
        playerId: "player-1",
        cashOutStrategy: CashOutStrategy.CONSERVATIVE,
        fundingSource: "DONATION",
      });

      orchestrator.createNewRun({
        playerId: "player-2",
        cashOutStrategy: CashOutStrategy.AGGRESSIVE,
        fundingSource: "DONATION",
      });

      // Should be reduced by 2 * $1.10
      expect(orchestrator.getTotalPlayerFunds()).toBe(72.8);
    });

    test("should count active players correctly", () => {
      expect(orchestrator.getActivePlayerCount()).toBe(3);

      // Create runs for some players
      orchestrator.createNewRun({
        playerId: "player-1",
        cashOutStrategy: CashOutStrategy.CONSERVATIVE,
        fundingSource: "DONATION",
      });

      expect(orchestrator.getActivePlayerCount()).toBe(3); // Still 3 active players
    });

    test("should auto-create runs for eligible players", () => {
      const newRuns = orchestrator.autoCreateRuns(1);

      expect(newRuns).toHaveLength(3); // All 3 players have sufficient funds

      // Verify each player has a run
      const player1Context = orchestrator.getPlayerRunContext("player-1");
      const player2Context = orchestrator.getPlayerRunContext("player-2");
      const player3Context = orchestrator.getPlayerRunContext("player-3");

      expect(player1Context.activeRuns).toHaveLength(1);
      expect(player2Context.activeRuns).toHaveLength(1);
      expect(player3Context.activeRuns).toHaveLength(1);
    });

    test("should respect max runs per player in auto-creation", () => {
      // Create initial runs
      orchestrator.autoCreateRuns(1);

      // Try to create more runs - should be limited
      const additionalRuns = orchestrator.autoCreateRuns(1);
      expect(additionalRuns).toHaveLength(0); // No new runs since each player already has 1
    });
  });

  describe("Run Completion and Fund Validation for New Runs", () => {
    test("should handle player becoming unable to create new runs after losses", () => {
      orchestrator.initializePlayer("player-1", 2.2, CashOutStrategy.BALANCED); // Exactly 2 games worth

      // Create first run
      const run1 = orchestrator.createNewRun({
        playerId: "player-1",
        cashOutStrategy: CashOutStrategy.BALANCED,
        fundingSource: "DONATION",
      })!;

      expect(orchestrator.getPlayerFunds("player-1")).toBe(1.1); // One game left

      // Lose first run
      const completion1 = orchestrator.processGameResult(run1, GameResult.LOSS);
      expect(completion1!.shouldCreateNewRun).toBe(true); // Still has $1.10

      // Create second run
      const run2 = orchestrator.createNewRun({
        playerId: "player-1",
        cashOutStrategy: CashOutStrategy.BALANCED,
        fundingSource: "DONATION",
      })!;

      expect(orchestrator.getPlayerFunds("player-1")).toBe(0.0); // No funds left

      // Lose second run
      const completion2 = orchestrator.processGameResult(run2, GameResult.LOSS);
      expect(completion2!.shouldCreateNewRun).toBe(false); // No funds for new run
    });

    test("should enable new runs after successful cash-out provides funds", () => {
      orchestrator.initializePlayer(
        "limited-player",
        1.1,
        CashOutStrategy.CONSERVATIVE
      ); // Just enough for 1 game

      const run = orchestrator.createNewRun({
        playerId: "limited-player",
        cashOutStrategy: CashOutStrategy.CONSERVATIVE,
        fundingSource: "DONATION",
      })!;

      expect(orchestrator.getPlayerFunds("limited-player")).toBe(0.0);

      // Win two games to get to level where conservative will cash out
      orchestrator.processGameResult(run, GameResult.WIN); // Level 1→2: $2 potential
      orchestrator.processGameResult(run, GameResult.WIN); // Level 2→3: $4 potential
      const completion = orchestrator.processGameResult(run, GameResult.WIN); // Level 3→4: $8 - conservative should cash out

      expect(completion).not.toBeNull();
      expect(completion!.completionType).toBe("CASH_OUT");

      // Player should now have funds from winnings
      const expectedFunds = 8 * 0.85; // 85% of $8 winnings
      expect(orchestrator.getPlayerFunds("limited-player")).toBe(expectedFunds);
      expect(completion!.shouldCreateNewRun).toBe(true); // Has funds for new run
    });
  });
});
