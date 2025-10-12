/**
 * GameEventHandler - Event-driven game resolution with CryptoZing Game Rules
 * Replaces GameProcessor game resolution logic with clean event-driven architecture
 */

import { EventBus, EventSubscription } from "../event-bus";
import { GameMatchingEngine } from "../../core/game-matching-engine";
import {
  GameCreatedEvent,
  GameResolvedEvent,
  ErrorEvent,
  EVENT_TYPES,
} from "../event-types";
import {
  BettingLevel,
  getBettingLevelValue,
} from "../../types/virtual-dollar-engine";
import type { EventDebugInterface } from "../debug";

/**
 * Game Rules Constants - Matching CryptoZing Specifications
 */
const BETTING_LEVELS: BettingLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // BettingLevel 1-10
const WINNINGS_MULTIPLIER = 1.8; // CryptoZing winnings formula
const JACKPOT_LEVEL: BettingLevel = 10; // Level 10 (value = $512)
const JACKPOT_AMOUNT =
  getBettingLevelValue(JACKPOT_LEVEL) * WINNINGS_MULTIPLIER;

/**
 * GameEventHandler - Handles game resolution through event-driven architecture
 *
 * Responsibilities:
 * - Listen for GAME_CREATED events from GameMatchingEngine
 * - Process game resolution with deterministic daily seed
 * - Emit GAME_RESOLVED events with winner/loser data
 * - Handle special jackpot level (512) logic
 * - Provide comprehensive error handling and event tracing
 */
export class GameEventHandler {
  private subscription: EventSubscription | null = null;

  constructor(
    private eventBus: EventBus,
    private gameMatchingEngine: GameMatchingEngine,
    private debugInterface?: EventDebugInterface,
    private verbose?: boolean
  ) {
    // Suppress unused variable warning - verbose parameter kept for consistency
    void this.verbose;
    this.initialize();
  }

  /**
   * Initialize event subscriptions
   */
  private initialize(): void {
    // Subscribe to GAME_CREATED events with high priority
    this.subscription = this.eventBus.on<GameCreatedEvent>(
      EVENT_TYPES.GAME_CREATED,
      this.handleGameCreated.bind(this),
      10 // High priority - game resolution should happen first
    );
  }

  /**
   * Handle GAME_CREATED event - Core game resolution logic
   */
  private async handleGameCreated(event: GameCreatedEvent): Promise<void> {
    try {
      if (this.debugInterface) {
        console.log(
          `[GameEventHandler] Resolving game ${event.gameId} at level ${event.player1Level}`
        );
      }
      // Generate daily seed in proper format (YYYY-MM-DD)
      const dailySeed = this.generateDailySeed();

      // Resolve game through GameMatchingEngine
      if (this.debugInterface) {
        console.log(
          `[GameEventHandler] Resolving game ${event.gameId} at level ${event.player1Level}`
        );
      }

      const resolutionResult = this.gameMatchingEngine.resolveGame(
        event.gameId,
        dailySeed
      );

      if (!resolutionResult.success) {
        await this.emitGameResolutionError(
          event.gameId,
          resolutionResult.error || "Unknown resolution error"
        );
        return;
      }

      // Fetch the updated game session with winner/loser data
      const gameSession = this.gameMatchingEngine.getGameSession(event.gameId);

      if (!gameSession) {
        await this.emitGameResolutionError(
          event.gameId,
          `Game session ${event.gameId} missing after resolution`
        );
        return;
      }

      const winnerDollar =
        resolutionResult.winner ?? gameSession.winner ?? gameSession.dollar1;
      const loserDollar =
        resolutionResult.loser ?? gameSession.loser ?? gameSession.dollar2;

      if (!winnerDollar?.id || !loserDollar?.id) {
        await this.emitGameResolutionError(
          event.gameId,
          `Game session ${event.gameId} missing winner/loser data after resolution`
        );
        return;
      }

      // Calculate winnings based on CryptoZing game rules
      const winnings = this.calculateWinnings(gameSession.level);

      // Emit GAME_RESOLVED event
      const gameResolvedEvent: GameResolvedEvent = {
        type: EVENT_TYPES.GAME_RESOLVED,
        timestamp: new Date(),
        gameId: event.gameId,
        winnerId: winnerDollar.ownerId,
        loserId: loserDollar.ownerId,
        winnerLevel: winnerDollar.currentLevel,
        loserLevel: loserDollar.currentLevel,
        winnerDollarId: winnerDollar.id,
        loserDollarId: loserDollar.id,
        winnings,
        gameResult: "WIN",
      };

      if (this.debugInterface) {
        console.log(
          `[GameEventHandler] Emitting GAME_RESOLVED for ${event.gameId} winner ${winnerDollar.id} at level ${winnerDollar.currentLevel}`
        );
      }
      void this.eventBus
        .emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent)
        .catch((error) =>
          console.error(
            `[GameEventHandler] Failed to emit GAME_RESOLVED for ${event.gameId}:`,
            error
          )
        );

      // Release session after handlers complete
      this.gameMatchingEngine.finalizeGameSession(event.gameId);
    } catch (error) {
      await this.emitGameResolutionError(
        event.gameId,
        `Unexpected error during game resolution: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      this.gameMatchingEngine.finalizeGameSession(event.gameId);
    }
  }

  /**
   * Calculate winnings based on CryptoZing game rules
   */
  private calculateWinnings(level: BettingLevel): number {
    // All levels, including jackpot, follow the standard winnings multiplier
    return getBettingLevelValue(level) * WINNINGS_MULTIPLIER;
  }

  /**
   * Generate deterministic daily seed in YYYY-MM-DD format
   */
  private generateDailySeed(): string {
    const today = new Date();
    return today.toISOString().split("T")[0]; // YYYY-MM-DD format
  }

  /**
   * Emit game resolution error event
   */
  private async emitGameResolutionError(
    gameId: string,
    errorMessage: string
  ): Promise<void> {
    const errorEvent: ErrorEvent = {
      type: "EVENT_ERROR",
      timestamp: new Date(),
      eventType: "GAME_RESOLUTION_ERROR",
      error: errorMessage,
      context: { gameId },
    };

    void this.eventBus
      .emit("EVENT_ERROR", errorEvent)
      .catch((error) =>
        console.error(
          `[GameEventHandler] Failed to emit EVENT_ERROR for ${gameId}:`,
          error
        )
      );
  }

  /**
   * Get handler statistics for debugging
   */
  getHandlerStats(): {
    isActive: boolean;
    subscriptionCount: number;
    supportedLevels: BettingLevel[];
    winningsMultiplier: number;
    jackpotLevel: number;
    jackpotAmount: number;
  } {
    return {
      isActive: this.subscription !== null,
      subscriptionCount: this.subscription ? 1 : 0,
      supportedLevels: [...BETTING_LEVELS], // [1,2,3,4,5,6,7,8,9,10] -> values [1,2,4,8,16,32,64,128,256,512]
      winningsMultiplier: WINNINGS_MULTIPLIER,
      jackpotLevel: JACKPOT_LEVEL,
      jackpotAmount: JACKPOT_AMOUNT,
    };
  }

  /**
   * Clean up subscriptions and resources
   */
  dispose(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }
}
