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
import {
  BettingLevel,
  DollarState,
  type VirtualDollar,
} from "../../types/virtual-dollar-engine";

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
  private isMatching = false;
  private pendingMatchAttempt = false;
  private terminationTriggered = false;
  private consecutiveNoMatchCycles = 0;
  private readonly maxNoMatchCycles = 5;
  private fifoUpdateScheduled = false;
  private pendingFifoLevels = new Set<number>();
  private lastFifoSnapshot = new Map<number, string>();
  private daySinceLastReset = 0;
  private staleCycleStartLevel: number | null = null;
  private readonly maxStaleCyclesBeforeCleanup = 5;
  private readonly stalemateRetryDelayMs = 25;

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
    if (this.terminationTriggered) {
      return;
    }

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

    // Reset guards at the start of each day
    this.eventBus.on(EVENT_TYPES.DAY_STARTED, () => {
      this.consecutiveNoMatchCycles = 0;
      this.pendingFifoLevels.clear();
      this.lastFifoSnapshot.clear();
      this.daySinceLastReset++;
    });

    this.eventBus.on(EVENT_TYPES.DAY_COMPLETED, () => {
      this.staleCycleStartLevel = null;
      this.consecutiveNoMatchCycles = 0;
      this.pendingFifoLevels.clear();
      this.lastFifoSnapshot.clear();
    });

    this.eventBus.on(EVENT_TYPES.DAY_FRAME_COMPLETED, () => {
      this.staleCycleStartLevel = null;
      this.consecutiveNoMatchCycles = 0;
      this.pendingFifoLevels.clear();
      this.lastFifoSnapshot.clear();
    });

    // Track new runs so we can detect when inflow stops
    this.eventBus.on(EVENT_TYPES.NEW_RUN_CREATED, () => {
      this.consecutiveNoMatchCycles = 0;
    });
  }

  /**
   * Handle POOL_ADDED event - Trigger matchmaking attempt
   */
  private handlePoolAdded(event: PoolAddedEvent): void {
    if (this.terminationTriggered) {
      return;
    }
    this.queueFifoUpdate(event.currentLevel);
    void this.attemptMatching();
  }

  /**
   * Handle POOL_UPDATED event - Trigger matchmaking attempt
   */
  private handlePoolUpdated(event: PoolUpdatedEvent): void {
    if (this.terminationTriggered) {
      return;
    }
    for (const level of Object.keys(event.levelDistribution)) {
      this.queueFifoUpdate(parseInt(level, 10));
    }

    void this.attemptMatching();
  }

  private queueFifoUpdate(level: number): void {
    if (this.terminationTriggered) {
      return;
    }
    this.pendingFifoLevels.add(level);
    if (!this.fifoUpdateScheduled) {
      this.fifoUpdateScheduled = true;
      Promise.resolve().then(() => {
        this.fifoUpdateScheduled = false;
        if (this.terminationTriggered) {
          this.pendingFifoLevels.clear();
          return;
        }
        for (const queuedLevel of this.pendingFifoLevels) {
          void this.emitFifoQueueUpdated(queuedLevel);
        }
        this.pendingFifoLevels.clear();
      });
    }
  }

  /**
   * Core matchmaking logic - moved from GameMatchingEngine
   */
  private async attemptMatching(): Promise<void> {
    if (this.terminationTriggered) {
      return;
    }

    if (this.isMatching) {
      this.pendingMatchAttempt = true;
      return;
    }

    this.isMatching = true;

    try {
      // Get current pool state
      const poolStats = this.gameMatchingEngine.getPoolStatistics();
      const activeGamesCount = this.gameMatchingEngine.getActiveGamesCount();
      const maxConcurrentGames =
        this.gameMatchingEngine.getMaxConcurrentGames();

      // Emit matchmaking attempted event
      void this.emitMatchmakingAttempted(
        poolStats,
        activeGamesCount,
        maxConcurrentGames
      );

      // Check concurrent game limit
      if (activeGamesCount >= maxConcurrentGames) {
        return; // Cannot create more games
      }

      // Track whether we matched anything in this run
      let matchesMade = 0;
      let stalemateDetected = false;
      let lastStalemateLevel: number | null = null;

      // Try to match at each level, prioritizing higher tiers first
      for (let level = 10; level >= 1; level--) {
        const bettingLevel = level as BettingLevel;
        const levelDollars =
          this.gameMatchingEngine.getDollarsAtLevel(bettingLevel);

        if (!levelDollars || levelDollars.length === 0) {
          continue;
        }

        const availableDollars: Array<{
          dollar: VirtualDollar;
          position: number;
        }> = [];
        for (const [index, dollar] of levelDollars.entries()) {
          if (!dollar) {
            continue;
          }

          if (
            dollar.state === DollarState.LOST ||
            dollar.state === DollarState.CASHED_OUT
          ) {
            void this.evictFinalStateDollar(dollar, bettingLevel);
            continue;
          }

          if (dollar.state !== DollarState.POOLED) {
            continue;
          }

          if (this.gameMatchingEngine.isDollarInGame(dollar.id)) {
            continue;
          }

          availableDollars.push({ dollar, position: index + 1 });
        }

        if (availableDollars.length < 2) {
          if (availableDollars.length === 1) {
            void this.emitPlayerWaiting(
              availableDollars[0].dollar,
              bettingLevel,
              availableDollars[0].position
            );
          }
          continue;
        }

        const matchingQueue = [...availableDollars];
        const deferredQueue: typeof availableDollars = [];

        while (
          matchingQueue.length > 1 &&
          this.gameMatchingEngine.getActiveGamesCount() < maxConcurrentGames
        ) {
          const primary = matchingQueue.shift()!;
          const partnerIndex = matchingQueue.findIndex(
            (candidate) => candidate.dollar.ownerId !== primary.dollar.ownerId
          );

          if (partnerIndex === -1) {
            deferredQueue.push(primary);
            console.debug(
              `[MatchmakingEventHandler] No eligible partner for ${
                primary.dollar.ownerId
              } at level ${level} (queue length: ${
                matchingQueue.length + deferredQueue.length
              })`
            );
            continue;
          }

          const partner = matchingQueue.splice(partnerIndex, 1)[0];

          // Create game session
          try {
            const game = this.createGameSession(
              primary.dollar,
              partner.dollar,
              bettingLevel
            );

            // Mark dollars as in-game
            this.virtualDollarFactory.updateDollarState(
              primary.dollar.id,
              DollarState.IN_GAME
            );
            this.virtualDollarFactory.updateDollarState(
              partner.dollar.id,
              DollarState.IN_GAME
            );
            this.gameMatchingEngine.markDollarInGame(primary.dollar.id);
            this.gameMatchingEngine.markDollarInGame(partner.dollar.id);

            // Remove from pool
            void this.gameMatchingEngine
              .removeFromPool(primary.dollar.id)
              .catch((error) =>
                console.error(
                  `[MatchmakingEventHandler] Failed to remove primary dollar ${primary.dollar.id} from pool:`,
                  error
                )
              );
            void this.gameMatchingEngine
              .removeFromPool(partner.dollar.id)
              .catch((error) =>
                console.error(
                  `[MatchmakingEventHandler] Failed to remove partner dollar ${partner.dollar.id} from pool:`,
                  error
                )
              );

            // Track active game
            this.gameMatchingEngine.addActiveGame(game);

            void this.emitMatchFound(
              primary.dollar,
              partner.dollar,
              bettingLevel,
              primary.position,
              partner.position
            );

            void this.emitGameCreated(game, primary.dollar, partner.dollar);
            matchesMade++;
          } catch (error) {
            console.error(
              `[MatchmakingEventHandler] Failed to create or register game at level ${level}:`,
              error
            );
          }
        }

        const remainingQueue = [...deferredQueue, ...matchingQueue];
        if (remainingQueue.length > 0) {
          const waiting = remainingQueue[0];
          void this.emitPlayerWaiting(
            waiting.dollar,
            bettingLevel,
            waiting.position
          );
        }

        if (matchesMade === 0) {
          const uniqueOwners = new Set(
            remainingQueue.map((entry) => entry.dollar.ownerId)
          );
          if (uniqueOwners.size < 2) {
            stalemateDetected = true;
            lastStalemateLevel = level;
          }
        }
      }

      if (matchesMade > 0) {
        this.consecutiveNoMatchCycles = 0;
      } else if (stalemateDetected && lastStalemateLevel !== null) {
        this.consecutiveNoMatchCycles++;

        console.debug(`[MatchmakingEventHandler] Stalemate cycle ${this.consecutiveNoMatchCycles} at level ${lastStalemateLevel} (max cleanup: ${this.maxStaleCyclesBeforeCleanup})`);

        if (lastStalemateLevel === this.staleCycleStartLevel) {
          if (this.consecutiveNoMatchCycles >= this.maxNoMatchCycles) {
            console.warn(
              `[MatchmakingEventHandler] Waiting for another unique player at level ${lastStalemateLevel}. ` +
                `Cycles without match: ${this.consecutiveNoMatchCycles}`
            );
          }

          if (
            this.consecutiveNoMatchCycles >= this.maxStaleCyclesBeforeCleanup
          ) {
            console.debug(`[MatchmakingEventHandler] Triggering stale cleanup at level ${lastStalemateLevel} after ${this.consecutiveNoMatchCycles} cycles`);
            this.cleanupStaleQueueState(lastStalemateLevel);
            return;
          }
        } else {
          this.staleCycleStartLevel = lastStalemateLevel;
        }
      } else {
        this.consecutiveNoMatchCycles = 0;
        this.staleCycleStartLevel = null;
      }
    } catch (error) {
      if (!this.terminationTriggered) {
        void this.emitMatchmakingError(
          "ATTEMPT_MATCHING",
          `Matchmaking failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    } finally {
      this.isMatching = false;
      if (!this.terminationTriggered && this.pendingMatchAttempt) {
        this.pendingMatchAttempt = false;
        setTimeout(() => {
          void this.attemptMatching();
        }, 50);  // Backoff to prevent tight loop
      } else {
        this.pendingMatchAttempt = false;
      }
    }
  }

  private cleanupStaleQueueState(level: number): void {
    const requeuedIds = this.gameMatchingEngine.clearStaleInGameDollars(level as BettingLevel);
    if (requeuedIds.length > 0) {
      console.warn(
        `[MatchmakingEventHandler] Requeued ${requeuedIds.length} stale dollars at level ${level} after ` +
        `${this.consecutiveNoMatchCycles} idle cycles: ${requeuedIds.slice(0, 5).join(", ")}${requeuedIds.length > 5 ? "…" : ""}`
      );
    }
    this.consecutiveNoMatchCycles = 0;
    this.staleCycleStartLevel = null;

    // Back off before retrying so we wait for fresh inflow or game resolutions
    if (!this.pendingMatchAttempt) {
      this.pendingMatchAttempt = true;
      setTimeout(() => void this.attemptMatching(), this.stalemateRetryDelayMs);
    }

    void this.emitFifoQueueUpdated(level);
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

    void this.eventBus
      .emit(EVENT_TYPES.MATCHMAKING_ATTEMPTED, event)
      .catch((error) =>
        console.error(
          "[MatchmakingEventHandler] Failed to emit MATCHMAKING_ATTEMPTED:",
          error
        )
      );
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

    void this.eventBus
      .emit(EVENT_TYPES.PLAYER_WAITING, event)
      .catch((error) =>
        console.error(
          "[MatchmakingEventHandler] Failed to emit PLAYER_WAITING:",
          error
        )
      );
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

    void this.eventBus
      .emit(EVENT_TYPES.MATCH_FOUND, event)
      .catch((error) =>
        console.error(
          "[MatchmakingEventHandler] Failed to emit MATCH_FOUND:",
          error
        )
      );
  }

  private async evictFinalStateDollar(
    dollar: VirtualDollar,
    level: BettingLevel
  ): Promise<void> {
    const removalPromise = this.gameMatchingEngine.removeFromPool(
      dollar.id,
      "ERROR"
    );

    removalPromise
      .then((removal) => {
        if (!removal.success) {
          console.warn(
            `[MatchmakingEventHandler] Dropped stale dollar ${
              dollar.id
            } at level ${level}: ${removal.error ?? "removeFromPool failed"}`
          );
        }
      })
      .catch((error) =>
        console.warn(
          `[MatchmakingEventHandler] Error removing stale dollar ${dollar.id}:`,
          error
        )
      );

    try {
      this.virtualDollarFactory.releaseDollar(dollar.id);
    } catch (error) {
      console.warn(
        `[MatchmakingEventHandler] Failed to release stale dollar ${dollar.id}: ${error}`
      );
    }
  }

  /**
   * Emit FIFO queue updated event
   */
  private async emitFifoQueueUpdated(level: number): Promise<void> {
    const levelDollars = this.gameMatchingEngine.getDollarsAtLevel(
      level as BettingLevel
    );
    const waitingPlayerIds = levelDollars
      .filter(
        (dollar): dollar is VirtualDollar =>
          Boolean(dollar) && dollar.state === DollarState.POOLED
      )
      .filter((dollar) => !this.gameMatchingEngine.isDollarInGame(dollar.id))
      .map((dollar) => dollar.ownerId);

    const snapshotKey = JSON.stringify({
      queueLength: waitingPlayerIds.length,
      waitingPlayerIds,
    });

    const previous = this.lastFifoSnapshot.get(level);
    if (previous === snapshotKey) {
      return;
    }

    this.lastFifoSnapshot.set(level, snapshotKey);

    const event: FifoQueueUpdatedEvent = {
      type: EVENT_TYPES.FIFO_QUEUE_UPDATED,
      timestamp: new Date(),
      level,
      queueLength: waitingPlayerIds.length,
      waitingPlayerIds,
    };

    void this.eventBus
      .emit(EVENT_TYPES.FIFO_QUEUE_UPDATED, event)
      .catch((error) =>
        console.error(
          "[MatchmakingEventHandler] Failed to emit FIFO_QUEUE_UPDATED:",
          error
        )
      );
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

    void this.eventBus
      .emit(EVENT_TYPES.GAME_CREATED, event)
      .catch((error) =>
        console.error(
          "[MatchmakingEventHandler] Failed to emit GAME_CREATED:",
          error
        )
      );
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

    void this.eventBus
      .emit("EVENT_ERROR", errorEvent)
      .catch((error) =>
        console.error(
          "[MatchmakingEventHandler] Failed to emit EVENT_ERROR:",
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
    this.poolSubscription?.unsubscribe();
    this.poolSubscription = null;
    this.poolUpdateSubscription?.unsubscribe();
    this.poolUpdateSubscription = null;
  }
}
