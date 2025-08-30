// Simple Integration Test Script for 2 Players
// Tests the basic flow without Jest dependencies

const { PlayerBalanceManager } = require('./dist/types/player-balance-manager');
const { VirtualDollarManager } = require('./dist/types/virtual-dollar-types');
const { ScoringEngine } = require('./dist/types/scoring-engine');
const { GameMatchingEngine } = require('./dist/types/game-matching-engine');
const { ProgressionManager } = require('./dist/types/progression-manager');
const { RevenueCalculator } = require('./dist/types/revenue-calculator');
const { CashOutStrategy, DollarState, CashOutDecision } = require('./dist/types/virtual-dollar-engine');

async function runIntegrationTest() {
  console.log('=== Integration Test: 2 Player Independent Run Flow ===\n');
  
  try {
    // Initialize all engine components
    const playerBalanceManager = new PlayerBalanceManager();
    const virtualDollarManager = new VirtualDollarManager();
    const scoringEngine = new ScoringEngine();
    const gameMatchingEngine = new GameMatchingEngine(virtualDollarManager, scoringEngine);
    const progressionManager = new ProgressionManager();
    const revenueCalculator = new RevenueCalculator();

    const PLAYER_1_ID = 'player_001';
    const PLAYER_2_ID = 'player_002';
    const INITIAL_DONATION = 20.00;

    // Create 2 players with different strategies
    const player1 = playerBalanceManager.createPlayer(PLAYER_1_ID, INITIAL_DONATION, CashOutStrategy.BALANCED);
    const player2 = playerBalanceManager.createPlayer(PLAYER_2_ID, INITIAL_DONATION, CashOutStrategy.CONSERVATIVE);

    console.log('=== SETUP ===');
    console.log(`Player 1: ${PLAYER_1_ID} (${CashOutStrategy.BALANCED} strategy)`);
    console.log(`  Donation Balance: $${player1.donationBalance}`);
    console.log(`  Game Credits Available: ${playerBalanceManager.getPlayerGameCredits(PLAYER_1_ID)}`);
    
    console.log(`Player 2: ${PLAYER_2_ID} (${CashOutStrategy.CONSERVATIVE} strategy)`);
    console.log(`  Donation Balance: $${player2.donationBalance}`);
    console.log(`  Game Credits Available: ${playerBalanceManager.getPlayerGameCredits(PLAYER_2_ID)}`);

    // Create virtual dollars for independent runs
    console.log('\n--- Creating Virtual Dollars for Independent Runs ---');
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

    // Add dollars to pool
    virtualDollarManager.updateDollarState(dollar1.id, DollarState.POOLED);
    virtualDollarManager.updateDollarState(dollar2.id, DollarState.POOLED);
    
    gameMatchingEngine.addToPool(dollar1);
    gameMatchingEngine.addToPool(dollar2);

    console.log('\n--- Processing Game Fees ---');
    const fee1Processed = playerBalanceManager.processGameFee(PLAYER_1_ID);
    const fee2Processed = playerBalanceManager.processGameFee(PLAYER_2_ID);

    console.log(`Game fees processed:`);
    console.log(`  Player 1 fee deducted: ${fee1Processed}`);
    console.log(`  Player 2 fee deducted: ${fee2Processed}`);

    // Check balances after fees
    const player1After = playerBalanceManager.getPlayer(PLAYER_1_ID);
    const player2After = playerBalanceManager.getPlayer(PLAYER_2_ID);

    console.log(`Balances after game fees:`);
    console.log(`  Player 1 donation balance: $${player1After.donationBalance}`);
    console.log(`  Player 2 donation balance: $${player2After.donationBalance}`);

    // Execute the game
    console.log('\n--- Executing Game ---');
    const matchResult = gameMatchingEngine.attemptMatching();
    
    if (matchResult.gamesCreated.length > 0) {
      const gameResult = matchResult.gamesCreated[0];
      
      console.log(`Game executed successfully:`);
      console.log(`  Game ID: ${gameResult.id}`);
      console.log(`  Level: ${gameResult.level}`);
      console.log(`  Platform Fee: $${gameResult.platformFee}`);
      console.log(`  Winner: ${gameResult.winner.serialNumber} (${gameResult.winner.ownerId})`);
      console.log(`  Loser: ${gameResult.loser.serialNumber} (${gameResult.loser.ownerId})`);
      console.log(`  Winnings: $${gameResult.winnings}`);

      // Process winnings
      playerBalanceManager.addWinProgression(gameResult.winner.ownerId, gameResult.winnings);
      playerBalanceManager.loseProgression(gameResult.loser.ownerId);

      console.log('\n--- Cash-Out Decision ---');
      const winnerPlayer = playerBalanceManager.getPlayer(gameResult.winner.ownerId);
      const shouldCashOut = progressionManager.makeCashOutDecision(
        gameResult.winner,
        winnerPlayer.cashOutStrategy
      );

      console.log(`Winner's current progression: $${winnerPlayer.currentProgression}`);
      console.log(`Cash-out decision (${winnerPlayer.cashOutStrategy}): ${shouldCashOut}`);

      if (shouldCashOut === CashOutDecision.CASH_OUT) {
        const cashOutResult = playerBalanceManager.processCashOut(gameResult.winner.ownerId, 0.15);
        console.log(`Cash-out processed:`);
        console.log(`  Player receives: $${cashOutResult.playerAmount}`);
        console.log(`  Charity receives: $${cashOutResult.charityAmount}`);
        
        virtualDollarManager.updateDollarState(gameResult.winner.id, DollarState.CASHED_OUT);
      }

      // Final states
      console.log('\n--- Final Player States ---');
      const finalPlayer1 = playerBalanceManager.getPlayer(PLAYER_1_ID);
      const finalPlayer2 = playerBalanceManager.getPlayer(PLAYER_2_ID);

      console.log(`Player 1 (${PLAYER_1_ID}):`);
      console.log(`  Donation Balance: $${finalPlayer1.donationBalance.toFixed(2)}`);
      console.log(`  Winnings Balance: $${finalPlayer1.winningsBalance.toFixed(2)}`);
      console.log(`  Current Progression: $${finalPlayer1.currentProgression.toFixed(2)}`);
      console.log(`  Games Played: ${finalPlayer1.gamesPlayed}`);
      console.log(`  Active: ${finalPlayer1.isActive}`);

      console.log(`Player 2 (${PLAYER_2_ID}):`);
      console.log(`  Donation Balance: $${finalPlayer2.donationBalance.toFixed(2)}`);
      console.log(`  Winnings Balance: $${finalPlayer2.winningsBalance.toFixed(2)}`);
      console.log(`  Current Progression: $${finalPlayer2.currentProgression.toFixed(2)}`);
      console.log(`  Games Played: ${finalPlayer2.gamesPlayed}`);
      console.log(`  Active: ${finalPlayer2.isActive}`);

      console.log('\n✓ Integration test completed successfully');
      
    } else {
      console.log('No games were created - check pool setup');
    }

  } catch (error) {
    console.error('Integration test failed:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
runIntegrationTest();