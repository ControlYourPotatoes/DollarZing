// Integration Test - Task 8.1: Complete Independent Run Flow with 2 Players
// Tests the full integration of all engine components with minimal data for output analysis

import { PlayerBalanceManager } from "../src/types/player-balance-manager";
import { GameMatchingEngine } from "../src/types/game-matching-engine";
import { VirtualDollarManager } from "../src/types/virtual-dollar-types";
import { ScoringEngine } from "../src/types/scoring-engine";
import { ProgressionManager } from "../src/types/progression-manager";
import {
  CashOutStrategy,
  CashOutDecision,
  DollarState,
  BettingLevel,
} from "../src/types/virtual-dollar-engine";
import { DirectGameSessionFactory } from "../src/test-utils";
import { PRODUCTION_PERFORMANCE_CONFIG } from "../src/types/factory-interfaces";

describe("Integration Test: 2 Player Independent Run Flow", () => {
  let playerBalanceManager: PlayerBalanceManager;
  let virtualDollarManager: VirtualDollarManager;
  let scoringEngine: ScoringEngine;
  let gameMatchingEngine: GameMatchingEngine;
  let progressionManager: ProgressionManager;

  const PLAYER_1_ID = "player_001";
  const PLAYER_2_ID = "player_002";
  const INITIAL_DONATION = 20.0; // $20 starting balance

  beforeEach(() => {
    // Initialize all engine components
    playerBalanceManager = new PlayerBalanceManager();
    virtualDollarManager = new VirtualDollarManager();
    scoringEngine = new ScoringEngine();
    const gameSessionFactory = new DirectGameSessionFactory(
      PRODUCTION_PERFORMANCE_CONFIG
    );
    gameMatchingEngine = new GameMatchingEngine(
      virtualDollarManager,
      scoringEngine,
      gameSessionFactory
    );
    progressionManager = new ProgressionManager();

    // Create 2 players with different strategies
    const player1 = playerBalanceManager.createPlayer(
      PLAYER_1_ID,
      INITIAL_DONATION,
      CashOutStrategy.BALANCED
    );
    const player2 = playerBalanceManager.createPlayer(
      PLAYER_2_ID,
      INITIAL_DONATION,
      CashOutStrategy.CONSERVATIVE
    );

    console.log("\n=== INTEGRATION TEST SETUP ===");
    console.log(
      `Player 1: ${PLAYER_1_ID} (${CashOutStrategy.BALANCED} strategy)`
    );
    console.log(`  Donation Balance: $${player1.donationBalance}`);
    console.log(
      `  Game Credits Available: ${playerBalanceManager.getPlayerGameCredits(
        PLAYER_1_ID
      )}`
    );

    console.log(
      `Player 2: ${PLAYER_2_ID} (${CashOutStrategy.CONSERVATIVE} strategy)`
    );
    console.log(`  Donation Balance: $${player2.donationBalance}`);
    console.log(
      `  Game Credits Available: ${playerBalanceManager.getPlayerGameCredits(
        PLAYER_2_ID
      )}`
    );
  });

  afterEach(() => {
    console.log("\n=== TEST CLEANUP ===");
  });

  describe("Task 8.1: Complete Independent Run Flow", () => {
    test("should create virtual dollars for 2 players and track independent runs", () => {
      console.log("\n--- Creating Virtual Dollars for Independent Runs ---");

      // Create one virtual dollar for each player (each represents one jackpot attempt)
      const dollar1 = virtualDollarManager.createVirtualDollar(PLAYER_1_ID);
      const dollar2 = virtualDollarManager.createVirtualDollar(PLAYER_2_ID);

      console.log(`Dollar 1 (${PLAYER_1_ID}):`);
      console.log(`  ID: ${dollar1.id}`);
      console.log(`  Serial: ${dollar1.serialNumber}`);
      console.log(`  Run ID: ${dollar1.runId}`);
      console.log(`  Level: ${dollar1.currentLevel}`);
      console.log(`  State: ${dollar1.state}`);
      console.log(`  Independent Run: ${dollar1.isIndependentRun}`);

      console.log(`Dollar 2 (${PLAYER_2_ID}):`);
      console.log(`  ID: ${dollar2.id}`);
      console.log(`  Serial: ${dollar2.serialNumber}`);
      console.log(`  Run ID: ${dollar2.runId}`);
      console.log(`  Level: ${dollar2.currentLevel}`);
      console.log(`  State: ${dollar2.state}`);
      console.log(`  Independent Run: ${dollar2.isIndependentRun}`);

      // Verify independent run setup
      expect(dollar1.runId).not.toBe(dollar2.runId);
      expect(dollar1.isIndependentRun).toBe(true);
      expect(dollar2.isIndependentRun).toBe(true);
      expect(dollar1.currentLevel).toBe(1);
      expect(dollar2.currentLevel).toBe(1);
      expect(dollar1.gamesInThisRun).toBe(0);
      expect(dollar2.gamesInThisRun).toBe(0);
      expect(dollar1.currentRunWinnings).toBe(0);
      expect(dollar2.currentRunWinnings).toBe(0);
      expect(dollar1.state).toBe(DollarState.CREATED);
      expect(dollar2.state).toBe(DollarState.CREATED);

      console.log(
        "\n✓ Virtual dollars created with proper independent run setup"
      );
    });

    test("should process first level game between 2 players", async () => {
      console.log("\n--- Processing Level 1 Game Between Players ---");

      // Create virtual dollars and prepare for game
      const dollar1 = virtualDollarManager.createVirtualDollar(PLAYER_1_ID);
      const dollar2 = virtualDollarManager.createVirtualDollar(PLAYER_2_ID);

      // Add dollars to pool
      virtualDollarManager.updateDollarState(dollar1.id, DollarState.POOLED);
      virtualDollarManager.updateDollarState(dollar2.id, DollarState.POOLED);

      // Add to matching engine pool
      gameMatchingEngine.addToPool(dollar1);
      gameMatchingEngine.addToPool(dollar2);

      console.log("Dollars added to matching pool:");
      console.log(`  Dollar 1 state: ${dollar1.state} → ${DollarState.POOLED}`);
      console.log(`  Dollar 2 state: ${dollar2.state} → ${DollarState.POOLED}`);

      // Process game fees
      const player1CanPlay = playerBalanceManager.canPlayerPlay(PLAYER_1_ID);
      const player2CanPlay = playerBalanceManager.canPlayerPlay(PLAYER_2_ID);

      console.log(`Player payment eligibility:`);
      console.log(`  Player 1 can play: ${player1CanPlay}`);
      console.log(`  Player 2 can play: ${player2CanPlay}`);

      expect(player1CanPlay).toBe(true);
      expect(player2CanPlay).toBe(true);

      // Deduct game fees ($1.10 per player = $2.20 total per game)
      const fee1Processed = playerBalanceManager.processGameFee(PLAYER_1_ID);
      const fee2Processed = playerBalanceManager.processGameFee(PLAYER_2_ID);

      console.log(`Game fees processed:`);
      console.log(`  Player 1 fee deducted: ${fee1Processed}`);
      console.log(`  Player 2 fee deducted: ${fee2Processed}`);

      expect(fee1Processed).toBe(true);
      expect(fee2Processed).toBe(true);

      // Check remaining balances after fees
      const player1After = playerBalanceManager.getPlayer(PLAYER_1_ID)!;
      const player2After = playerBalanceManager.getPlayer(PLAYER_2_ID)!;

      console.log(`Balances after game fees:`);
      console.log(
        `  Player 1 donation balance: $${player1After.donationBalance}`
      );
      console.log(
        `  Player 2 donation balance: $${player2After.donationBalance}`
      );

      expect(player1After.donationBalance).toBe(18.9); // $20 - $1.10
      expect(player2After.donationBalance).toBe(18.9); // $20 - $1.10

      // Execute the game
      const matchResult = gameMatchingEngine.attemptMatching();
      const game = matchResult.gamesCreated[0];

      expect(game).toBeDefined();
      if (game) {
        console.log(`Game created with ID: ${game.id}`);
        console.log(`Game level: ${game.level}`);
        console.log(
          `Game dollar1: ${game.dollar1.id} (${game.dollar1.ownerId})`
        );
        console.log(
          `Game dollar2: ${game.dollar2.id} (${game.dollar2.ownerId})`
        );

        // Resolve the game to determine winner/loser
        const gameResult = gameMatchingEngine.resolveGame(
          game.id,
          "2024-01-15"
        );

        console.log(`Game resolution result:`, gameResult);

        expect(gameResult.success).toBe(true);
        expect(gameResult.winner).toBeDefined();
        expect(gameResult.loser).toBeDefined();

        console.log(`\nGame executed successfully:`);
        console.log(`  Game ID: ${game.id}`);
        console.log(`  Level: ${game.level}`);
        console.log(`  Platform Fee: $${game.platformFee}`);
        console.log(
          `  Winner: ${gameResult.winner!.serialNumber} (${
            gameResult.winner!.ownerId
          })`
        );
        console.log(
          `  Loser: ${gameResult.loser!.serialNumber} (${
            gameResult.loser!.ownerId
          })`
        );
        console.log(
          `  Winner Score: ${gameResult.winner!.currentScore.toFixed(6)}`
        );
        console.log(
          `  Loser Score: ${gameResult.loser!.currentScore.toFixed(6)}`
        );
        console.log(`  Winnings: $${gameResult.winnings}`);

        // Verify game details
        expect(game.level).toBe(1); // First level
        expect(game.platformFee).toBe(0.2); // 20 cents platform fee
        expect(gameResult.winnings).toBe(1.8); // Level 1 winnings = $1.8 (1 * 1.8)
        expect([PLAYER_1_ID, PLAYER_2_ID]).toContain(
          gameResult.winner!.ownerId
        );
        expect([PLAYER_1_ID, PLAYER_2_ID]).toContain(gameResult.loser!.ownerId);
        expect(gameResult.winner!.ownerId).not.toBe(gameResult.loser!.ownerId);
      }

      console.log("\n✓ Level 1 game processed successfully");
    });

    test("should track progression through multiple levels or cash-out decision", async () => {
      console.log("\n--- Testing Level Progression and Cash-Out Decisions ---");

      // Create dollars and process initial game
      const dollar1 = virtualDollarManager.createVirtualDollar(PLAYER_1_ID);
      const dollar2 = virtualDollarManager.createVirtualDollar(PLAYER_2_ID);

      // Add to pool and process fees
      virtualDollarManager.updateDollarState(dollar1.id, DollarState.POOLED);
      virtualDollarManager.updateDollarState(dollar2.id, DollarState.POOLED);

      // Add to matching engine pool
      gameMatchingEngine.addToPool(dollar1);
      gameMatchingEngine.addToPool(dollar2);

      playerBalanceManager.processGameFee(PLAYER_1_ID);
      playerBalanceManager.processGameFee(PLAYER_2_ID);

      // Track progression through multiple potential games
      let currentLevel = 1;
      let gameCount = 0;
      const maxGames = 5; // Limit to prevent infinite loops in test

      console.log("Starting progression simulation...");

      while (gameCount < maxGames) {
        const matchResult = gameMatchingEngine.attemptMatching();
        const game = matchResult.gamesCreated[0];

        if (!game) {
          console.log("No more matches available");
          break;
        }

        // Resolve the game to determine winner/loser
        const gameResult = gameMatchingEngine.resolveGame(
          game.id,
          "2024-01-15"
        );

        if (!gameResult.success || !gameResult.winner || !gameResult.loser) {
          console.log("Game resolution failed");
          break;
        }

        gameCount++;
        console.log(`\n--- Game ${gameCount} (Level ${game.level}) ---`);
        console.log(`Winner: ${gameResult.winner.ownerId}`);
        console.log(`Loser: ${gameResult.loser.ownerId}`);
        console.log(`Winnings: $${gameResult.winnings}`);

        // Process winnings for winner
        playerBalanceManager.addWinProgression(
          gameResult.winner.ownerId,
          gameResult.winnings
        );

        // Clear progression for loser (they lost this run)
        const lostAmount = playerBalanceManager.loseProgression(
          gameResult.loser.ownerId
        );
        console.log(`Loser lost progression: $${lostAmount}`);

        // Check winner's progression and cash-out decision
        const winnerPlayer = playerBalanceManager.getPlayer(
          gameResult.winner.ownerId
        )!;
        console.log(
          `Winner's current progression: $${winnerPlayer.currentProgression}`
        );

        // Simulate cash-out decision based on strategy
        const shouldCashOut = progressionManager.makeCashOutDecision(
          gameResult.winner,
          winnerPlayer.cashOutStrategy
        );

        console.log(
          `Cash-out decision (${winnerPlayer.cashOutStrategy}): ${shouldCashOut}`
        );

        if (shouldCashOut === CashOutDecision.CASH_OUT) {
          // Process cash-out
          const cashOutResult = playerBalanceManager.processCashOut(
            gameResult.winner.ownerId,
            0.15
          );
          console.log(`Cash-out processed:`);
          console.log(`  Player receives: $${cashOutResult.playerAmount}`);
          console.log(`  Charity receives: $${cashOutResult.charityAmount}`);

          virtualDollarManager.updateDollarState(
            gameResult.winner.id,
            DollarState.CASHED_OUT
          );
          break;
        } else {
          // Continue to next level
          currentLevel++;
          if (currentLevel <= 10) {
            gameResult.winner.currentLevel = currentLevel as BettingLevel;
            virtualDollarManager.updateDollarState(
              gameResult.winner.id,
              DollarState.POOLED
            );
            console.log(`Winner continues to level ${currentLevel}`);
          } else {
            console.log("Winner reached maximum level (jackpot!)");
            break;
          }
        }
      }

      expect(gameCount).toBeGreaterThan(0);
      console.log(
        `\n✓ Processed ${gameCount} games with proper progression tracking`
      );
    });

    test("should generate complete output summary for 2-player integration", async () => {
      console.log("\n--- Complete Integration Output Summary ---");

      // Track all metrics during full simulation
      const startTime = Date.now();

      // Create multiple virtual dollars for more interesting output
      const player1Dollars = [
        virtualDollarManager.createVirtualDollar(PLAYER_1_ID),
        virtualDollarManager.createVirtualDollar(PLAYER_1_ID),
      ];
      const player2Dollars = [
        virtualDollarManager.createVirtualDollar(PLAYER_2_ID),
      ];

      console.log(
        `Created ${
          player1Dollars.length + player2Dollars.length
        } virtual dollars:`
      );
      console.log(`  Player 1: ${player1Dollars.length} runs`);
      console.log(`  Player 2: ${player2Dollars.length} runs`);

      // Process all dollars through pool
      const allDollars = [...player1Dollars, ...player2Dollars];
      for (const dollar of allDollars) {
        virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
        playerBalanceManager.processGameFee(dollar.ownerId);
      }

      // Process games until no more matches or timeout
      let totalGames = 0;
      let totalRevenue = 0;
      let totalWinnings = 0;
      let totalCharityContributions = 0;

      const maxProcessingTime = 5000; // 5 second limit
      const startProcessing = Date.now();

      while (Date.now() - startProcessing < maxProcessingTime) {
        const matchResult = gameMatchingEngine.attemptMatching();
        const game = matchResult.gamesCreated[0];

        if (!game) break;

        // Resolve the game to determine winner/loser
        const gameResult = gameMatchingEngine.resolveGame(
          game.id,
          "2024-01-15"
        );

        if (!gameResult.success || !gameResult.winner || !gameResult.loser) {
          break;
        }

        totalGames++;
        totalRevenue += game.platformFee;
        totalWinnings += gameResult.winnings;

        // Process game outcome
        playerBalanceManager.addWinProgression(
          gameResult.winner.ownerId,
          gameResult.winnings
        );
        playerBalanceManager.loseProgression(gameResult.loser.ownerId);

        // Check for cash-out
        const winnerPlayer = playerBalanceManager.getPlayer(
          gameResult.winner.ownerId
        )!;
        const shouldCashOut = progressionManager.makeCashOutDecision(
          gameResult.winner,
          winnerPlayer.cashOutStrategy
        );

        if (shouldCashOut === CashOutDecision.CASH_OUT) {
          const cashOut = playerBalanceManager.processCashOut(
            gameResult.winner.ownerId,
            0.15
          );
          totalCharityContributions += cashOut.charityAmount;
          virtualDollarManager.updateDollarState(
            gameResult.winner.id,
            DollarState.CASHED_OUT
          );
        }

        // Mark loser as lost
        virtualDollarManager.updateDollarState(
          gameResult.loser.id,
          DollarState.LOST
        );
      }

      const endTime = Date.now();
      const processingTimeMs = endTime - startTime;

      // Generate comprehensive output
      console.log("\n=== INTEGRATION TEST RESULTS ===");
      console.log(`Processing Time: ${processingTimeMs}ms`);
      console.log(`Total Games Processed: ${totalGames}`);
      console.log(`Platform Revenue: $${totalRevenue.toFixed(2)}`);
      console.log(`Total Winnings Distributed: $${totalWinnings.toFixed(2)}`);
      console.log(
        `Charity Contributions: $${totalCharityContributions.toFixed(2)}`
      );

      // Player final states
      const finalPlayer1 = playerBalanceManager.getPlayer(PLAYER_1_ID)!;
      const finalPlayer2 = playerBalanceManager.getPlayer(PLAYER_2_ID)!;

      console.log(`\n--- Final Player States ---`);
      console.log(`Player 1 (${PLAYER_1_ID}):`);
      console.log(
        `  Donation Balance: $${finalPlayer1.donationBalance.toFixed(2)}`
      );
      console.log(
        `  Winnings Balance: $${finalPlayer1.winningsBalance.toFixed(2)}`
      );
      console.log(
        `  Current Progression: $${finalPlayer1.currentProgression.toFixed(2)}`
      );
      console.log(`  Games Played: ${finalPlayer1.gamesPlayed}`);
      console.log(`  Active: ${finalPlayer1.isActive}`);

      console.log(`Player 2 (${PLAYER_2_ID}):`);
      console.log(
        `  Donation Balance: $${finalPlayer2.donationBalance.toFixed(2)}`
      );
      console.log(
        `  Winnings Balance: $${finalPlayer2.winningsBalance.toFixed(2)}`
      );
      console.log(
        `  Current Progression: $${finalPlayer2.currentProgression.toFixed(2)}`
      );
      console.log(`  Games Played: ${finalPlayer2.gamesPlayed}`);
      console.log(`  Active: ${finalPlayer2.isActive}`);

      // Virtual dollar final states
      const poolStats = virtualDollarManager.getPoolStatistics();
      console.log(`\n--- Virtual Dollar Statistics ---`);
      console.log(`Total Virtual Dollars: ${poolStats.totalDollars}`);
      console.log(`Pooled (waiting for games): ${poolStats.pooledDollars}`);
      console.log(`In Game (currently playing): ${poolStats.inGameDollars}`);
      console.log(
        `Completed (won/lost/cashed-out): ${poolStats.completedDollars}`
      );

      // Verify test completed successfully
      expect(totalGames).toBeGreaterThan(0);
      expect(totalRevenue).toBeGreaterThan(0);
      expect(processingTimeMs).toBeLessThan(10000); // Should complete in under 10 seconds

      console.log(
        "\n✓ Integration test completed with comprehensive output tracking"
      );
    });
  });
});
