import { GameMatchingEngine } from "../types/game-matching-engine";
import { PlayerRunManager } from "../types/player-run-manager";
import { RevenueCalculator } from "../types/revenue-calculator";
import { VirtualDollarManager } from "../types/virtual-dollar-types";
import { GameResult, DollarState } from "../types/virtual-dollar-engine";

/**
 * GameProcessor handles game resolution and result processing
 * Extracted from SimulationController to provide focused game processing logic
 */
export class GameProcessor {
  constructor(
    private gameMatchingEngine: GameMatchingEngine,
    private runOrchestrator: PlayerRunManager,
    private revenueCalculator: RevenueCalculator,
    private dollarManager: VirtualDollarManager
  ) {}

  /**
   * Resolve games to determine winners and losers
   */
  async resolveGames(games: any[], dailySeed: string): Promise<void> {
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
  async processGameResults(games: any[]): Promise<void> {
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
