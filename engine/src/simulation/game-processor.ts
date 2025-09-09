import { GameMatchingEngine } from "../types/game-matching-engine";
import { RevenueCalculator } from "../types/revenue-calculator";
import { EventBus } from "../events/event-bus";
import { EVENT_TYPES, GameResolvedEvent } from "../events/event-types";

/**
 * GameProcessor handles game resolution and result processing
 * Extracted from SimulationController to provide focused game processing logic
 */
export class GameProcessor {
  constructor(
    private gameMatchingEngine: GameMatchingEngine,
    private revenueCalculator: RevenueCalculator,
    private eventBus: EventBus
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
   * Process game results through event system instead of direct orchestration
   */
  async processGameResults(games: any[]): Promise<void> {
    // Process each game and emit events instead of direct processing
    for (const originalGameSession of games) {
      // CRITICAL FIX: Fetch the updated game session from completedGames
      const gameSession = this.gameMatchingEngine.getGameSession(
        originalGameSession.id
      );

      if (!gameSession || !gameSession.winner || !gameSession.loser) {
        console.warn(
          `DEBUG: Skipping game ${originalGameSession.id} - missing winner/loser data`
        );
        continue;
      }

      const winner = gameSession.winner;
      const loser = gameSession.loser;

      console.log(
        `DEBUG: [GameProcessor] Processing game ${gameSession.id} with winner ${winner.ownerId} (Level ${winner.currentLevel}) and loser ${loser.ownerId} (Level ${loser.currentLevel})`
      );

      // Instead of direct processing, emit GAME_RESOLVED event
      // Event handlers will now process the winner and loser progression
      await this.eventBus.emit(EVENT_TYPES.GAME_RESOLVED, {
        type: EVENT_TYPES.GAME_RESOLVED,
        timestamp: new Date(),
        gameId: gameSession.id,
        winnerId: winner.ownerId,
        loserId: loser.ownerId,
        winnerLevel: winner.currentLevel,
        loserLevel: loser.currentLevel,
        winnerDollarId: winner.id,
        loserDollarId: loser.id,
        winnings: winner.currentLevel * 10, // Approximate winnings calculation
        gameResult: "WIN",
      } as GameResolvedEvent);

      console.log(
        `DEBUG: [GameProcessor] Emitted GAME_RESOLVED event for game ${gameSession.id} with winner ${winner.ownerId} and loser ${loser.ownerId}`
      );
    }
  }
}
