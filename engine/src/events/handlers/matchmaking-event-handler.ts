/**
 * MatchmakingEventHandler - Event-driven matchmaking logic
 * Handles pool updates and attempts to match players for games
 */

import { EventBus, EventSubscription } from "../event-bus";
import { GameMatchingEngine } from "../../core/game-matching-engine";
import { VirtualDollarFactory } from "../../types/factory-interfaces";
import { GameSessionFactory } from "../../types/factory-interfaces";
// ScoringEngine removed - not used in matchmaking, only in game resolution
import {
  PoolAddedEvent,
  PoolUpdatedEvent,
  MatchmakingAttemptedEvent,
  PlayerWaitingEvent,
  MatchFoundEvent,
  FifoQueueUpdatedEvent,
  GameCreatedEvent,
  ErrorEvent,
  EVENT_TYPES,
} from "../event-types";
import { BettingLevel, DollarState } from "../../types/virtual-dollar-engine";

/**
 * MatchmakingEventHandler - Handles matchmaking logic through event-driven architecture
 *
 * Responsibilities:
 * - Listen for POOL_ADDED and POOL_UPDATED events
 * - Attempt to match players at each level using FIFO ordering
 * - Emit detailed matchmaking events (MATCHMAKING_ATTEMPTED, PLAYER_WAITING, MATCH_FOUND, FIFO_QUEUE_UPDATED)
 * - Handle concurrent game limits and pool capacity constraints
 * - Provide comprehensive error handling and event tracing
 */
export class MatchmakingEventHandler {
  private poolSubscription: EventSubscription | null = null;
  private poolUpdateSubscription: EventSubscription | null = null;

  constructor(
    private eventBus: EventBus,
    private gameMatchingEngine: GameMatchingEngine,
    private virtualDollarFactory: VirtualDollarFactory,
    private gameSessionFactory: GameSessionFactory
  ) {
    this.initialize();
  }

  /**
   * Initialize event subscriptions
   */
  private initialize(): void {
    // Subscribe to POOL_ADDED events with high priority
    this.poolSubscription = this.eventBus.on<PoolAddedEvent>(
      EVENT_TYPES.POOL_ADDED,
      this.handlePoolAdded.bind(this),
      10 // High priority - matchmaking should happen quickly
    );

    // Subscribe to POOL_UPDATED events with medium priority
    this.poolUpdateSubscription = this.eventBus.on<PoolUpdatedEvent>(
      EVENT_TYPES.POOL_UPDATED,
      this.handlePoolUpdated.bind(this),
      5 // Medium priority - less urgent than new additions
    );
  }

  /**
   * Handle POOL_ADDED event - Trigger matchmaking attempt
   */
  private async handlePoolAdded(event: PoolAddedEvent): Promise<void> {
    try {
      // Emit FIFO queue updated event for the specific level
      await this.emitFifoQueueUpdated(event.currentLevel);

      // Attempt matching at all levels
      await this.attemptMatching();
    } catch (error) {
      await this.emitMatchmakingError(
        "POOL_ADDED",
        `Failed to handle pool addition: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Handle POOL_UPDATED event - Trigger matchmaking attempt
   */
  private async handlePoolUpdated(event: PoolUpdatedEvent): Promise<void> {
    try {
      // Emit FIFO queue updated events for all levels with changes
      for (const [level, count] of Object.entries(event.levelDistribution)) {
        if (count > 0) {
          await this.emitFifoQueueUpdated(parseInt(level));
        }
      }

      // Attempt matching at all levels
      await this.attemptMatching();
    } catch (error) {
      await this.emitMatchmakingError(
        "POOL_UPDATED",
        `Failed to handle pool update: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Core matchmaking logic - moved from GameMatchingEngine
   */
  private async attemptMatching(): Promise<void> {
    try {
      // Get current pool state
      const poolStats = this.gameMatchingEngine.getPoolStatistics();
      const activeGamesCount = this.gameMatchingEngine.getActiveGamesCount();
      const maxConcurrentGames =
        this.gameMatchingEngine.getMaxConcurrentGames();

      // Emit matchmaking attempted event
      await this.emitMatchmakingAttempted(
        poolStats,
        activeGamesCount,
        maxConcurrentGames
      );

      // Check concurrent game limit
      if (activeGamesCount >= maxConcurrentGames) {
        return; // Cannot create more games
      }

      // Try to match at each level
      for (let level = 1; level <= 10; level++) {
        const bettingLevel = level as BettingLevel;
        const levelDollars =
          this.gameMatchingEngine.getDollarsAtLevel(bettingLevel);

        if (!levelDollars || levelDollars.length < 2) {
          // Not enough dollars at this level - emit waiting events for odd players
          if (levelDollars && levelDollars.length === 1) {
            const waitingDollar = levelDollars[0];
            await this.emitPlayerWaiting(waitingDollar, bettingLevel, 1);
          }
          continue;
        }

        // Sort by creation time (FIFO)
        const availableDollars = levelDollars
          .filter(
            (dollar) => !this.gameMatchingEngine.isDollarInGame(dollar.id)
          )
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        // Match pairs
        for (let i = 0; i < availableDollars.length - 1; i += 2) {
          if (
            this.gameMatchingEngine.getActiveGamesCount() >= maxConcurrentGames
          ) {
            break; // Hit concurrent limit
          }

          const dollar1 = availableDollars[i];
          const dollar2 = availableDollars[i + 1];

          // Create game session
          const game = this.createGameSession(dollar1, dollar2, bettingLevel);

          // Mark dollars as in-game
          this.virtualDollarFactory.updateDollarState(
            dollar1.id,
            DollarState.IN_GAME
          );
          this.virtualDollarFactory.updateDollarState(
            dollar2.id,
            DollarState.IN_GAME
          );

          // Remove from pool
          await this.gameMatchingEngine.removeFromPool(dollar1.id);
          await this.gameMatchingEngine.removeFromPool(dollar2.id);

          // Track active game
          this.gameMatchingEngine.addActiveGame(game);

          // Emit match found event
          await this.emitMatchFound(
            dollar1,
            dollar2,
            bettingLevel,
            i + 1,
            i + 2
          );

          // Emit game created event
          await this.emitGameCreated(game, dollar1, dollar2);
        }

        // Handle remaining odd player
        const remainingDollars = availableDollars.slice(
          Math.floor(availableDollars.length / 2) * 2
        );
        if (remainingDollars.length === 1) {
          const waitingDollar = remainingDollars[0];
          const queuePosition = Math.floor(availableDollars.length / 2) + 1;
          await this.emitPlayerWaiting(
            waitingDollar,
            bettingLevel,
            queuePosition
          );
        }
      }
    } catch (error) {
      await this.emitMatchmakingError(
        "ATTEMPT_MATCHING",
        `Matchmaking failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Create a new game session using injected factory
   */
  private createGameSession(
    dollar1: any,
    dollar2: any,
    level: BettingLevel
  ): any {
    try {
      return this.gameSessionFactory.create(dollar1, dollar2, level);
    } catch (error) {
      throw new Error(
        `Failed to create game session through factory: ${error}`
      );
    }
  }

  /**
   * Emit matchmaking attempted event
   */
  private async emitMatchmakingAttempted(
    poolStats: any,
    concurrentGamesCount: number,
    maxConcurrentGames: number
  ): Promise<void> {
    const event: MatchmakingAttemptedEvent = {
      type: EVENT_TYPES.MATCHMAKING_ATTEMPTED,
      timestamp: new Date(),
      poolSnapshot: {
        totalDollarsInPool: poolStats.totalDollarsInPool,
        dollarsAvailableForMatching: poolStats.availableForMatching,
        levelDistribution: poolStats.dollarsByLevel || {},
      },
      concurrentGamesCount,
      maxConcurrentGames,
    };

    await this.eventBus.emit(EVENT_TYPES.MATCHMAKING_ATTEMPTED, event);
  }

  /**
   * Emit player waiting event
   */
  private async emitPlayerWaiting(
    dollar: any,
    level: BettingLevel,
    queuePosition: number
  ): Promise<void> {
    const event: PlayerWaitingEvent = {
      type: EVENT_TYPES.PLAYER_WAITING,
      timestamp: new Date(),
      virtualDollarId: dollar.id,
      playerId: dollar.ownerId,
      waitingAtLevel: level,
      queuePosition,
      playersNeededForMatch: 1, // Need 1 more for pair
    };

    await this.eventBus.emit(EVENT_TYPES.PLAYER_WAITING, event);
  }

  /**
   * Emit match found event
   */
  private async emitMatchFound(
    dollar1: any,
    dollar2: any,
    level: BettingLevel,
    position1: number,
    position2: number
  ): Promise<void> {
    const event: MatchFoundEvent = {
      type: EVENT_TYPES.MATCH_FOUND,
      timestamp: new Date(),
      virtualDollar1Id: dollar1.id,
      virtualDollar2Id: dollar2.id,
      player1Id: dollar1.ownerId,
      player2Id: dollar2.ownerId,
      matchedLevel: level,
      fifoOrder: {
        player1Position: position1,
        player2Position: position2,
      },
    };

    await this.eventBus.emit(EVENT_TYPES.MATCH_FOUND, event);
  }

  /**
   * Emit FIFO queue updated event
   */
  private async emitFifoQueueUpdated(level: number): Promise<void> {
    const levelDollars = this.gameMatchingEngine.getDollarsAtLevel(
      level as BettingLevel
    );
    const waitingPlayerIds =
      levelDollars
        ?.filter((dollar) => !this.gameMatchingEngine.isDollarInGame(dollar.id))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((dollar) => dollar.ownerId) || [];

    const event: FifoQueueUpdatedEvent = {
      type: EVENT_TYPES.FIFO_QUEUE_UPDATED,
      timestamp: new Date(),
      level,
      queueLength: waitingPlayerIds.length,
      waitingPlayerIds,
    };

    await this.eventBus.emit(EVENT_TYPES.FIFO_QUEUE_UPDATED, event);
  }

  /**
   * Emit game created event
   */
  private async emitGameCreated(
    game: any,
    dollar1: any,
    dollar2: any
  ): Promise<void> {
    const event: GameCreatedEvent = {
      type: EVENT_TYPES.GAME_CREATED,
      timestamp: new Date(),
      gameId: game.id,
      player1Id: dollar1.ownerId,
      player2Id: dollar2.ownerId,
      player1Level: dollar1.currentLevel,
      player2Level: dollar2.currentLevel,
      virtualDollar1Id: dollar1.id,
      virtualDollar2Id: dollar2.id,
    };

    await this.eventBus.emit(EVENT_TYPES.GAME_CREATED, event);
  }

  /**
   * Emit matchmaking error event
   */
  private async emitMatchmakingError(
    operation: string,
    errorMessage: string
  ): Promise<void> {
    const errorEvent: ErrorEvent = {
      type: "EVENT_ERROR",
      timestamp: new Date(),
      eventType: "MATCHMAKING_ERROR",
      error: errorMessage,
      context: { operation },
    };

    await this.eventBus.emit("EVENT_ERROR", errorEvent);
  }

  /**
   * Get handler statistics for debugging
   */
  getHandlerStats(): {
    isActive: boolean;
    subscriptionCount: number;
    supportedLevels: BettingLevel[];
  } {
    return {
      isActive:
        this.poolSubscription !== null && this.poolUpdateSubscription !== null,
      subscriptionCount:
        (this.poolSubscription ? 1 : 0) + (this.poolUpdateSubscription ? 1 : 0),
      supportedLevels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as BettingLevel[],
    };
  }

  /**
   * Clean up subscriptions and resources
   */
  dispose(): void {
    if (this.poolSubscription) {
      this.poolSubscription.unsubscribe();
      this.poolSubscription = null;
    }
    if (this.poolUpdateSubscription) {
      this.poolUpdateSubscription.unsubscribe();
      this.poolUpdateSubscription = null;
    }
  }
}
