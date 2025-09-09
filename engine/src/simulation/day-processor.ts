import { GameMatchingEngine } from "../types/game-matching-engine";
import { PlayerManager } from "./player-manager";
import { VirtualDollarManager } from "../types/virtual-dollar-types";
import { RevenueCalculator } from "../types/revenue-calculator";
import { DollarState, GameResult } from "../types/virtual-dollar-engine";
import { EventBus } from "../events/event-bus";
import {
  EVENT_TYPES,
  DayStartedEvent,
  DayCompletedEvent,
  NewRunCreatedEvent,
} from "../events/event-types";
import { SimulationConfig } from "./game-engine-simulator";

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
    private playerManager: PlayerManager,
    private dollarManager: VirtualDollarManager,
    private revenueCalculator: RevenueCalculator,
    private eventBus: EventBus
  ) {
    this.setupEventSubscriptions();
  }

  /**
   * Setup event subscriptions for event-driven processing
   */
  private setupEventSubscriptions(): void {
    this.eventBus.on(
      EVENT_TYPES.NEW_RUN_CREATED,
      this.handleNewRunCreated.bind(this)
    );
  }

  /**
   * Handle new run created event - add to pool
   */
  private async handleNewRunCreated(event: NewRunCreatedEvent): Promise<void> {
    // Add the new run to the game matching engine pool
    this.dollarManager.updateDollarState(
      event.virtualDollarId,
      DollarState.POOLED
    );

    // Get the virtual dollar from the manager
    const virtualDollar = this.dollarManager.getDollar(event.virtualDollarId);
    if (virtualDollar) {
      this.gameMatchingEngine.addToPool(virtualDollar);
    }
  }

  /**
   * Process a single day of simulation
   */
  async processDay(
    day: number,
    config: DayProcessingConfig,
    simulationConfig: SimulationConfig
  ): Promise<void> {
    console.log(`DEBUG: [DayProcessor] ===== PROCESSING DAY ${day} =====`);

    // Emit day started event
    const initialPoolStats = this.gameMatchingEngine.getPoolStatistics();
    await this.eventBus.emit(EVENT_TYPES.DAY_STARTED, {
      type: EVENT_TYPES.DAY_STARTED,
      timestamp: new Date(),
      dayNumber: day,
      totalPlayers: 0, // Will need to track this properly
      activePlayers: 0, // Will need to track this properly
      poolSize: initialPoolStats.totalDollarsInPool,
      growthModel: simulationConfig.growthModel,
      playerStrategies: simulationConfig.playerStrategies,
    } as DayStartedEvent);
    // Note: addNewRunsToPool() is now handled by PlayerManager via DAY_STARTED event

    // Process available games for the day
    const maxGamesPerDay = Math.max(25, config.initialPlayerCount * 2);

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

      // Process the games through GameMatchingEngine first (this handles the basic resolution)
      // Then process the results for cash-out decisions and re-pooling
      if (matchResult.gamesCreated.length > 0) {
        console.log(
          `DEBUG: About to process game results for ${matchResult.gamesCreated.length} games`
        );
        await this.processGameResults(matchResult.gamesCreated);
        console.log(`DEBUG: Finished processing game results`);
      }

      // Small delay to prevent blocking
      if (gameAttempt % 50 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    // Emit day completed event
    const finalPoolStats = this.gameMatchingEngine.getPoolStatistics();
    await this.eventBus.emit(EVENT_TYPES.DAY_COMPLETED, {
      type: EVENT_TYPES.DAY_COMPLETED,
      timestamp: new Date(),
      dayNumber: day,
      gamesProcessed: maxGamesPerDay, // Approximate
      newPlayers: 0, // Would need to track this
      totalRevenue: 0, // Would need to track this through revenue events
      poolSize: finalPoolStats.totalDollarsInPool,
      activePlayers: 0, // Would need to track this properly
    } as DayCompletedEvent);
  }

  /**
   * Add new runs to the game matching engine pool
   */
  async addNewRunsToPool(): Promise<void> {
    // Auto-create new runs for eligible players
    const newRuns = this.playerManager.autoCreateRuns(2); // Max 2 concurrent runs per player

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
  async resolveGames(games: any[], dailySeed: string): Promise<void> {
    console.log(
      `DEBUG: [DayProcessor.resolveGames] Processing ${games.length} games`
    );
    games.forEach((gameSession) => {
      // Generate proper daily seed format (YYYY-MM-DD) from config or current date
      const seed = dailySeed.match(/^\d{4}-\d{2}-\d{2}$/)
        ? dailySeed
        : new Date().toISOString().split("T")[0];

      const resolutionResult = this.gameMatchingEngine.resolveGame(
        gameSession.id,
        seed
      );

      console.log(`DEBUG: Resolution result for game ${gameSession.id}:`, {
        success: resolutionResult.success,
        hasWinner: !!resolutionResult.winner,
        hasLoser: !!resolutionResult.loser,
        error: resolutionResult.error,
      });

      if (!resolutionResult.success) {
        console.warn(
          `Failed to resolve game ${gameSession.id}: ${resolutionResult.error}`
        );
        return;
      }

      // Process game revenue after resolution
      this.revenueCalculator.processGameRevenue(gameSession);

      // Process game results through run orchestrator
      if (resolutionResult.winner && resolutionResult.loser) {
        console.log(`DEBUG: Resolution result - Winner: ${
          resolutionResult.winner?.ownerId || "null"
        }, Loser: 
          ${resolutionResult.loser?.ownerId || "null"}`);
        // Process winner progression
        const winnerResult = this.playerManager.processGameResult(
          resolutionResult.winner,
          GameResult.WIN
        );

        console.log(
          `DEBUG: Winner result for ${resolutionResult.winner.ownerId}:`,
          winnerResult
            ? `completionType: ${winnerResult.completionType}`
            : "null (run continues)"
        );
        console.log(`DEBUG: Winner result is null:`, winnerResult === null);
        console.log(
          `DEBUG: Winner result is undefined:`,
          winnerResult === undefined
        );
        console.log(
          `DEBUG: Winner current level: ${resolutionResult.winner.currentLevel}`
        );

        if (winnerResult) {
          console.log(
            `DEBUG: Winner result: ${winnerResult.completionType}, Level: ${resolutionResult.winner.currentLevel}, Winnings: $${winnerResult.totalWinnings}`
          );
        } else {
          // Winner advanced to next level but run continues - re-add to pool
          console.log(
            `DEBUG: Winner ${resolutionResult.winner.ownerId} advanced to level ${resolutionResult.winner.currentLevel}, re-adding to pool`
          );
          this.dollarManager.updateDollarState(
            resolutionResult.winner.id,
            DollarState.POOLED
          );
          this.gameMatchingEngine.addToPool(resolutionResult.winner);
        }

        // Process loser result
        const loserResult = this.playerManager.processGameResult(
          resolutionResult.loser,
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
            const playerStrategy = this.playerManager.getPlayerStrategy(
              result.playerId
            );
            const newRun = this.playerManager.createNewRun({
              playerId: result.playerId,
              cashOutStrategy: playerStrategy,
              fundingSource: "DONATION",
            });

            if (newRun) {
              // Update state from CREATED to POOLED before adding to matching engine
              this.dollarManager.updateDollarState(
                newRun.id,
                DollarState.POOLED
              );
              this.gameMatchingEngine.addToPool(newRun);
            }
          }
        });
      }
    });
  }

  /**
   * Process game results through run orchestrator
   */
  private async processGameResults(games: any[]): Promise<void> {
    console.log(`DEBUG: Processing ${games.length} game results`);
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
      const winnerResult = this.playerManager.processGameResult(
        winner,
        GameResult.WIN
      );

      if (winnerResult) {
        console.log(
          `DEBUG: Winner result: ${winnerResult.completionType}, Level: ${winner.currentLevel}, Winnings: $${winnerResult.totalWinnings}`
        );
      } else {
        // Winner advanced to next level but run continues - re-add to pool
        console.log(
          `DEBUG: Winner ${winner.ownerId} advanced to level ${winner.currentLevel}, re-adding to pool`
        );
        this.dollarManager.updateDollarState(winner.id, DollarState.POOLED);
        this.gameMatchingEngine.addToPool(winner);
      }

      // Process loser result
      const loserResult = this.playerManager.processGameResult(
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
          const playerStrategy = this.playerManager.getPlayerStrategy(
            result.playerId
          );
          const newRun = this.playerManager.createNewRun({
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
