import { EventBus } from "../event-bus";
import {
  EVENT_TYPES,
  GameCreatedEvent,
  GameResolvedEvent,
  DayStartedEvent,
} from "../event-types";
import { BettingLevel } from "../../types/virtual-dollar-engine";

export interface LevelStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  cashouts: number;
  progressions: number;
  winnings: number;
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

  constructor(private eventBus: EventBus) {
    this.instanceId = ++LevelTrackingHandler.instanceCounter;
    console.log(`[LevelTrackingHandler #${this.instanceId}] Initializing level tracking`);
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
    
    console.log(`[LevelTrackingHandler #${this.instanceId}] Event subscriptions established`);
  }

  private handleGameCreated(event: GameCreatedEvent): void {
    const day = this.getCurrentDay();
    const level = event.player1Level as BettingLevel;

    console.log(`[LevelTrackingHandler #${this.instanceId}] Game created at level ${level} on day ${day}`);

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

  private createEmptyLevelStats(): LevelStats {
    return {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      cashouts: 0,
      progressions: 0,
      winnings: 0,
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
    console.log(`[LevelTrackingHandler #${this.instanceId}] Day ${this.currentDay} started - daily stats initialized`);
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
    console.log(`[LevelTrackingHandler #${this.instanceId}] Exporting snapshot - currentDay: ${this.currentDay}, dailyStats days: ${Array.from(this.dailyLevelStats.keys()).join(',')}, cumulative levels: ${Array.from(this.cumulativeLevelStats.keys()).join(',')}`);
    
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
      console.log(`[LevelTrackingHandler #${this.instanceId}] Day ${day} has ${statsMap.size} levels tracked`);
    }

    const cumulative: Record<BettingLevel, LevelStats> = {} as Record<
      BettingLevel,
      LevelStats
    >;
    for (const [level, stats] of this.cumulativeLevelStats.entries()) {
      cumulative[level] = { ...stats };
    }

    console.log(`[LevelTrackingHandler #${this.instanceId}] Snapshot exported with ${Object.keys(daily).length} days and ${Object.keys(cumulative).length} cumulative levels`);

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
