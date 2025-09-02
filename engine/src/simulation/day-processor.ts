import { GameMatchingEngine } from "../types/game-matching-engine";
import { RunOrchestrator } from "../types/run-orchestrator";
import { VirtualDollarManager } from "../types/virtual-dollar-types";
import { RevenueCalculator } from "../types/revenue-calculator";
import { DollarState, GameResult } from "../types/virtual-dollar-engine";

/**
 * Configuration for daily processing
 */
export interface DayProcessingConfig {
  initialPlayerCount: number;
  maxGamesPerDay: number;
  dailySeed: string;
}

/**
 * DayProcessor handles the daily simulation processing logic
 * Extracted from SimulationController to provide focused daily operations
 */
export class DayProcessor {
  constructor(
    private gameMatchingEngine: GameMatchingEngine,
    private runOrchestrator: RunOrchestrator,
    private dollarManager: VirtualDollarManager,
    private revenueCalculator: RevenueCalculator
  ) {}

  /**
   * Process a single day of simulation
   */
  async processDay(day: number, config: DayProcessingConfig): Promise<void> {
    // Add new virtual dollars to the pool
    await this.addNewRunsToPool();

    // Process available games for the day
    const maxGamesPerDay = Math.max(10, config.initialPlayerCount * 2);

    const poolStats = this.gameMatchingEngine.getPoolStatistics();
    console.log(
      `DEBUG: Day ${day} - Pool stats - Total: ${poolStats.totalDollarsInPool}, Available: ${poolStats.availableForMatching}`
    );

    for (let gameAttempt = 0; gameAttempt < maxGamesPerDay; gameAttempt++) {
      const matchResult = this.gameMatchingEngine.attemptMatching();
      console.log(
        `DEBUG: Day ${day} - Matching attempt ${
          gameAttempt + 1
        } - Games created: ${matchResult.gamesCreated.length}`
      );

      if (matchResult.gamesCreated.length === 0) {
        break; // No more matches possible
      }

      // Resolve games to determine winners and losers
      await this.resolveGames(matchResult.gamesCreated, config.dailySeed);

      // Process game results through run orchestrator
      await this.processGameResults(matchResult.gamesCreated);

      // Small delay to prevent blocking
      if (gameAttempt % 50 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  /**
   * Add new runs to the game matching engine pool
   */
  async addNewRunsToPool(): Promise<void> {
    // Auto-create new runs for eligible players
    const newRuns = this.runOrchestrator.autoCreateRuns(2); // Max 2 concurrent runs per player

    console.log(`DEBUG: Created ${newRuns.length} new runs`);
    newRuns.forEach((virtualDollar) => {
      // Update state from CREATED to POOLED before adding to matching engine
      this.dollarManager.updateDollarState(
        virtualDollar.id,
        DollarState.POOLED
      );
      const addResult = this.gameMatchingEngine.addToPool(virtualDollar);
      console.log(
        `DEBUG: Added dollar ${virtualDollar.id} to pool - Success: ${addResult.success}, Level: ${virtualDollar.currentLevel}`
      );
    });
  }

  /**
   * Resolve games to determine winners and losers
   */
  private async resolveGames(games: any[], dailySeed: string): Promise<void> {
    games.forEach((gameSession) => {
      // Generate proper daily seed format (YYYY-MM-DD) from config or current date
      const seed = dailySeed.match(/^\d{4}-\d{2}-\d{2}$/)
        ? dailySeed
        : new Date().toISOString().split("T")[0];

      const resolutionResult = this.gameMatchingEngine.resolveGame(
        gameSession.id,
        seed
      );

      if (!resolutionResult.success) {
        console.warn(
          `Failed to resolve game ${gameSession.id}: ${resolutionResult.error}`
        );
      }

      // Process game revenue after resolution
      this.revenueCalculator.processGameRevenue(gameSession);
    });
  }

  /**
   * Process game results through run orchestrator
   */
  private async processGameResults(games: any[]): Promise<void> {
    games.forEach((originalGameSession) => {
      // CRITICAL FIX: Fetch the updated game session from completedGames
      const gameSession = this.gameMatchingEngine.getGameSession(
        originalGameSession.id
      );

      if (!gameSession || !gameSession.winner || !gameSession.loser) {
        console.warn(
          `DEBUG: Skipping game ${originalGameSession.id} - missing winner/loser data`
        );
        return;
      }

      const winner = gameSession.winner;
      const loser = gameSession.loser;

      console.log(
        `DEBUG: Processing game ${gameSession.id} with winner ${winner.ownerId} (Level ${winner.currentLevel}) and loser ${loser.ownerId} (Level ${loser.currentLevel})`
      );

      // Process winner progression
      const winnerResult = this.runOrchestrator.processGameResult(
        winner,
        GameResult.WIN
      );

      if (winnerResult) {
        console.log(
          `DEBUG: Winner result: ${winnerResult.completionType}, Level: ${winner.currentLevel}, Winnings: $${winnerResult.totalWinnings}`
        );
      }

      // Process loser result
      const loserResult = this.runOrchestrator.processGameResult(
        loser,
        GameResult.LOSS
      );

      if (loserResult) {
        console.log(`DEBUG: Loser result: ${loserResult.completionType}`);
      }

      // Process cash-outs for revenue tracking
      [winnerResult, loserResult].forEach((result) => {
        if (result && result.completionType === "CASH_OUT") {
          this.revenueCalculator.processCashOut(result.totalWinnings);
        }
      });

      // Handle run completions and create new runs
      [winnerResult, loserResult].forEach((result) => {
        if (result && result.shouldCreateNewRun) {
          const playerStrategy = this.runOrchestrator.getPlayerStrategy(
            result.playerId
          );
          const newRun = this.runOrchestrator.createNewRun({
            playerId: result.playerId,
            cashOutStrategy: playerStrategy,
            fundingSource: "DONATION",
          });

          if (newRun) {
            // Update state from CREATED to POOLED before adding to matching engine
            this.dollarManager.updateDollarState(newRun.id, DollarState.POOLED);
            this.gameMatchingEngine.addToPool(newRun);
          }
        }
      });
    });
  }
}
