import { GameMatchingEngine } from "../core/game-matching-engine";
import { EventBus } from "../events/event-bus";
import { EVENT_TYPES, GameCreatedEvent } from "../events/event-types";

/**
 * GameProcessor handles game creation and emits events for event-driven processing
 * Refactored to work with event-driven architecture:
 * - Emits GAME_CREATED events instead of directly resolving games
 * - GameEventHandler listens to GAME_CREATED and handles resolution
 * - PlayerProgressionHandler handles the progression logic
 */
export class GameProcessor {
  constructor(
    _gameMatchingEngine: GameMatchingEngine,
    private eventBus: EventBus
  ) {}

  /**
   * Create games and emit GAME_CREATED events for event-driven processing
   * GameEventHandler will listen to these events and handle resolution
   */
  async createGames(games: any[], dailySeed: string): Promise<void> {
    console.log(
      `[GameProcessor] Creating ${games.length} games and emitting GAME_CREATED events`
    );

    // Generate proper daily seed format (YYYY-MM-DD) from config or current date
    // Note: seed validation is done but not used in current implementation
    dailySeed.match(/^\d{4}-\d{2}-\d{2}$/)
      ? dailySeed
      : new Date().toISOString().split("T")[0];

    // Emit GAME_CREATED events for each game - let GameEventHandler handle resolution
    for (const gameSession of games) {
      const gameCreatedEvent: GameCreatedEvent = {
        type: EVENT_TYPES.GAME_CREATED,
        timestamp: new Date(),
        gameId: gameSession.id,
        player1Id: gameSession.dollar1?.ownerId || "",
        player2Id: gameSession.dollar2?.ownerId || "",
        player1Level: gameSession.level,
        player2Level: gameSession.level,
        virtualDollar1Id: gameSession.dollar1?.id || "",
        virtualDollar2Id: gameSession.dollar2?.id || "",
      };

      console.log(
        `[GameProcessor] Emitting GAME_CREATED for game ${gameSession.id}`
      );
      await this.eventBus.emit(EVENT_TYPES.GAME_CREATED, gameCreatedEvent);
    }
  }

  /**
   * Legacy method for backward compatibility - redirects to createGames
   * @deprecated Use createGames instead
   */
  async resolveGames(games: any[], dailySeed: string): Promise<void> {
    console.warn(
      `[GameProcessor] resolveGames is deprecated - use createGames instead`
    );
    await this.createGames(games, dailySeed);
  }

  /**
   * Process newly created games by emitting GAME_CREATED events
   * This method should be called with fresh games that need to be processed
   */
  async processGameResults(games: any[]): Promise<void> {
    console.log(
      `[GameProcessor] Processing ${games.length} newly created games via GAME_CREATED events`
    );

    // Use today's date as default seed
    const dailySeed = new Date().toISOString().split("T")[0];

    // Emit GAME_CREATED events for each newly created game
    // GameEventHandler will handle resolution and emit GAME_RESOLVED events
    await this.createGames(games, dailySeed);
  }
}
