import { EventBus } from "../event-bus";
import {
  EVENT_TYPES,
  GameCreatedEvent,
  GameResolvedEvent,
  DayStartedEvent,
  CashOutCompletedEvent,
  MatchFoundEvent,
  VirtualDollarAdvancedEvent,
} from "../event-types";
import { BettingLevel } from "../../types/virtual-dollar-engine";
import type { EventDebugInterface } from "../debug";

export interface LevelStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  cashouts: number;
  progressions: number;
  winnings: number;

  // Transition tracking for level progression visibility
  playersAdvancedToNextLevel: number; // Count of players who progressed FROM this level
  playersArrivedFromPreviousLevel: number; // Count of players who arrived AT this level
  averageWaitTimeMs: number; // Average time spent in pool before match
  maxWaitTimeMs: number; // Longest wait time in pool at this level
}

export interface LevelTrackingSnapshot {
  currentDay: number;
  dailyLevelStats: Record<number, Record<BettingLevel, LevelStats>>;
  cumulativeLevelStats: Record<BettingLevel, LevelStats>;
}

/**
 * LevelTrackingHandler - Tracks games played at each betting level
 * Maintains daily and cumulative statistics for level-based analytics
 */
export class LevelTrackingHandler {
  private static instanceCounter = 0;
  private instanceId: number;
  private currentDay: number = 1;
  private dailyLevelStats: Map<number, Map<BettingLevel, LevelStats>> =
    new Map();
  private cumulativeLevelStats: Map<BettingLevel, LevelStats> = new Map();
  private playerLevels: Map<string, PlayerLevelInfo> = new Map();

  constructor(
    private eventBus: EventBus,
    private debugInterface?: EventDebugInterface,
    private verbose?: boolean
  ) {
    this.instanceId = ++LevelTrackingHandler.instanceCounter;
    if (this.verbose) {
      console.log(
        `[LevelTrackingHandler #${this.instanceId}] Initializing level tracking`
      );
    }
    this.setupEventSubscriptions();
  }

  private setupEventSubscriptions(): void {
    // Listen to DAY_STARTED events to track day changes
    this.eventBus.on(EVENT_TYPES.DAY_STARTED, this.handleDayStarted.bind(this));

    // Listen to GAME_CREATED events to track games by level
    this.eventBus.on(
      EVENT_TYPES.GAME_CREATED,
      this.handleGameCreated.bind(this)
    );

    // Listen to GAME_RESOLVED events to track outcomes by level
    this.eventBus.on(
      EVENT_TYPES.GAME_RESOLVED,
      this.handleGameResolved.bind(this)
    );

    // Listen to CASH_OUT_COMPLETED events to track cash-outs
    this.eventBus.on(
      EVENT_TYPES.CASH_OUT_COMPLETED,
      this.handleCashOutCompleted.bind(this)
    );

    // Listen to MATCH_FOUND events to track arrivals and wait times
    this.eventBus.on(EVENT_TYPES.MATCH_FOUND, this.handleMatchFound.bind(this));

    // Listen to VIRTUAL_DOLLAR_ADVANCED events to track level progressions
    this.eventBus.on(
      EVENT_TYPES.VIRTUAL_DOLLAR_ADVANCED,
      this.handleVirtualDollarAdvanced.bind(this)
    );

    if (this.verbose) {
      console.log(
        `[LevelTrackingHandler #${this.instanceId}] Event subscriptions established`
      );
    }
  }

  private handleGameCreated(event: GameCreatedEvent): void {
    const day = this.getCurrentDay();
    const level = event.player1Level as BettingLevel;

    if (this.debugInterface) {
      console.log(
        `[LevelTrackingHandler #${this.instanceId}] Game created at level ${level} on day ${day}`
      );
    }

    const dayStats = this.ensureDailyStats(day);
    // Initialize once to avoid double-counting when processing both players
    const stats = dayStats.get(level) || this.createEmptyLevelStats();

    // Each GAME_CREATED represents a single match at this level
    stats.gamesPlayed += 1;

    dayStats.set(level, stats);

    this.playerLevels.set(event.player1Id, {
      currentLevel: event.player1Level as BettingLevel,
      previousLevel: event.player1Level as BettingLevel,
    });
    this.playerLevels.set(event.player2Id, {
      currentLevel: event.player2Level as BettingLevel,
      previousLevel: event.player2Level as BettingLevel,
    });
  }

  private handleGameResolved(event: GameResolvedEvent): void {
    const day = this.getCurrentDay();
    const winnerLevel = event.winnerLevel as BettingLevel;
    const loserLevel = event.loserLevel as BettingLevel;

    const dayStats = this.ensureDailyStats(day);

    const winnerState = this.playerLevels.get(event.winnerId);
    const loserState = this.playerLevels.get(event.loserId);

    const winnerBucket = winnerLevel;
    const loserBucket = loserState?.previousLevel ?? loserLevel;

    const winnerStats =
      dayStats.get(winnerBucket) || this.createEmptyLevelStats();
    winnerStats.wins++;
    winnerStats.progressions++; // Winner advances to next level
    winnerStats.winnings += event.winnings;
    dayStats.set(winnerBucket, winnerStats);

    // Track loser stats
    const loserStats =
      dayStats.get(loserBucket) || this.createEmptyLevelStats();
    loserStats.losses++;
    dayStats.set(loserBucket, loserStats);

    // Update cumulative stats
    const winnerCumulativeStats =
      this.cumulativeLevelStats.get(winnerBucket) ||
      this.createEmptyLevelStats();
    winnerCumulativeStats.wins++;
    winnerCumulativeStats.progressions++;
    winnerCumulativeStats.winnings += event.winnings;
    this.cumulativeLevelStats.set(winnerBucket, winnerCumulativeStats);

    const loserCumulativeStats =
      this.cumulativeLevelStats.get(loserBucket) ||
      this.createEmptyLevelStats();
    loserCumulativeStats.losses++;
    this.cumulativeLevelStats.set(loserBucket, loserCumulativeStats);

    // Explicitly handle level 10 to ensure tracking
    if (winnerLevel === 10) {
      if (this.debugInterface) {
        console.log(
          `Player ${event.winnerId} reached level 10 at ${event.timestamp}`
        );
      }
    }

    if (winnerState) {
      this.playerLevels.set(event.winnerId, {
        currentLevel: winnerLevel,
        previousLevel: winnerState.currentLevel,
      });
    }
    if (loserState) {
      this.playerLevels.set(event.loserId, {
        currentLevel: loserLevel,
        previousLevel: loserState.currentLevel,
      });
    }
  }

  private handleCashOutCompleted = (event: CashOutCompletedEvent): void => {
    if (event.finalLevel === 10) {
      if (this.debugInterface) {
        console.log(`Cash-out processed for level 10 player ${event.playerId}`);
      }
    }
  };

  /**
   * Handle MATCH_FOUND event to track player arrivals and wait times at each level
   */
  private handleMatchFound(event: MatchFoundEvent): void {
    const level = event.matchedLevel as BettingLevel;
    const day = this.getCurrentDay();
    const dayStats = this.ensureDailyStats(day);
    const stats = dayStats.get(level) || this.createEmptyLevelStats();

    // Track arrivals at this level (both players arrived to create this match)
    stats.playersArrivedFromPreviousLevel += 2;

    // Update wait time stats if available
    if (event.waitTimes) {
      const avgWait =
        (event.waitTimes.player1WaitMs + event.waitTimes.player2WaitMs) / 2;
      const maxWait = Math.max(
        event.waitTimes.player1WaitMs,
        event.waitTimes.player2WaitMs
      );

      // Update running average
      const totalGames = stats.gamesPlayed || 1;
      stats.averageWaitTimeMs =
        (stats.averageWaitTimeMs * (totalGames - 1) + avgWait) / totalGames;
      stats.maxWaitTimeMs = Math.max(stats.maxWaitTimeMs, maxWait);
    }

    dayStats.set(level, stats);

    // Update cumulative stats
    const cumulativeStats =
      this.cumulativeLevelStats.get(level) || this.createEmptyLevelStats();
    cumulativeStats.playersArrivedFromPreviousLevel += 2;
    this.cumulativeLevelStats.set(level, cumulativeStats);
  }

  /**
   * Handle VIRTUAL_DOLLAR_ADVANCED event to track players leaving each level
   */
  private handleVirtualDollarAdvanced(event: VirtualDollarAdvancedEvent): void {
    const fromLevel = event.previousLevel as BettingLevel;
    const day = this.getCurrentDay();
    const dayStats = this.ensureDailyStats(day);
    const stats = dayStats.get(fromLevel) || this.createEmptyLevelStats();

    // Track departures from this level
    stats.playersAdvancedToNextLevel += 1;

    dayStats.set(fromLevel, stats);

    // Update cumulative stats
    const cumulativeStats =
      this.cumulativeLevelStats.get(fromLevel) || this.createEmptyLevelStats();
    cumulativeStats.playersAdvancedToNextLevel += 1;
    this.cumulativeLevelStats.set(fromLevel, cumulativeStats);

    if (this.debugInterface) {
      console.log(
        `[LevelTrackingHandler #${this.instanceId}] Player advanced from level ${fromLevel} to ${event.currentLevel} on day ${day}`
      );
    }
  }

  private createEmptyLevelStats(): LevelStats {
    return {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      cashouts: 0,
      progressions: 0,
      winnings: 0,
      playersAdvancedToNextLevel: 0,
      playersArrivedFromPreviousLevel: 0,
      averageWaitTimeMs: 0,
      maxWaitTimeMs: 0,
    };
  }

  private ensureDailyStats(day: number): Map<BettingLevel, LevelStats> {
    if (!this.dailyLevelStats.has(day)) {
      this.dailyLevelStats.set(day, new Map());
    }
    return this.dailyLevelStats.get(day)!;
  }

  private handleDayStarted(event: DayStartedEvent): void {
    // Day events already provide 1-based indexing
    this.currentDay = event.dayNumber;
    this.ensureDailyStats(this.currentDay);
    if (this.debugInterface) {
      console.log(
        `[LevelTrackingHandler #${this.instanceId}] Day ${this.currentDay} started - daily stats initialized`
      );
    }
  }

  private getCurrentDay(): number {
    return this.currentDay;
  }

  /**
   * Get level statistics for a specific day
   */
  getDailyLevelStats(day: number): Map<BettingLevel, LevelStats> {
    return this.dailyLevelStats.get(day) || new Map();
  }

  /**
   * Get cumulative level statistics
   */
  getCumulativeLevelStats(): Map<BettingLevel, LevelStats> {
    return this.cumulativeLevelStats;
  }

  /**
   * Get current day's level statistics
   */
  getCurrentDayLevelStats(): Map<BettingLevel, LevelStats> {
    return this.getDailyLevelStats(this.currentDay);
  }

  /**
   * Export a serializable snapshot of tracked statistics
   */
  public exportSnapshot(): LevelTrackingSnapshot {
    if (this.debugInterface) {
      console.log(
        `[LevelTrackingHandler #${
          this.instanceId
        }] Exporting snapshot - currentDay: ${
          this.currentDay
        }, dailyStats days: ${Array.from(this.dailyLevelStats.keys()).join(
          ","
        )}, cumulative levels: ${Array.from(
          this.cumulativeLevelStats.keys()
        ).join(",")}`
      );
    }

    const daily: Record<number, Record<BettingLevel, LevelStats>> = {};
    for (const [day, statsMap] of this.dailyLevelStats.entries()) {
      const dayRecord: Record<BettingLevel, LevelStats> = {} as Record<
        BettingLevel,
        LevelStats
      >;
      for (const [level, stats] of statsMap.entries()) {
        dayRecord[level] = { ...stats };
      }
      daily[day] = dayRecord;
      if (this.debugInterface) {
        console.log(
          `[LevelTrackingHandler #${this.instanceId}] Day ${day} has ${statsMap.size} levels tracked`
        );
      }
    }

    const cumulative: Record<BettingLevel, LevelStats> = {} as Record<
      BettingLevel,
      LevelStats
    >;
    for (const [level, stats] of this.cumulativeLevelStats.entries()) {
      cumulative[level] = { ...stats };
    }

    if (this.debugInterface) {
      console.log(
        `[LevelTrackingHandler #${this.instanceId}] Snapshot exported with ${
          Object.keys(daily).length
        } days and ${Object.keys(cumulative).length} cumulative levels`
      );
    }

    return {
      currentDay: this.currentDay,
      dailyLevelStats: daily,
      cumulativeLevelStats: cumulative,
    };
  }
}

interface PlayerLevelInfo {
  currentLevel: BettingLevel;
  previousLevel: BettingLevel;
}
