import { EventBus } from "../event-bus";
import {
  EVENT_TYPES,
  GameCreatedEvent,
  GameResolvedEvent,
  DayStartedEvent,
} from "../event-types";
import { BettingLevel } from "../../types/virtual-dollar-engine";

/**
 * LevelTrackingHandler - Tracks games played at each betting level
 * Maintains daily and cumulative statistics for level-based analytics
 */
export class LevelTrackingHandler {
  private currentDay: number = 1;
  private dailyLevelStats: Map<number, Map<BettingLevel, LevelStats>> =
    new Map();
  private cumulativeLevelStats: Map<BettingLevel, LevelStats> = new Map();

  constructor(private eventBus: EventBus) {
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
  }

  private handleGameCreated(event: GameCreatedEvent): void {
    const day = this.getCurrentDay();
    const level = event.player1Level as BettingLevel; // Both players enter at same level

    const dayStats = this.ensureDailyStats(day);
    // Initialize once to avoid double-counting when processing both players
    const stats = dayStats.get(level) || this.createEmptyLevelStats();

    // Each GAME_CREATED represents a single match at this level
    stats.gamesPlayed += 1;

    dayStats.set(level, stats);
  }

  private handleGameResolved(event: GameResolvedEvent): void {
    const day = this.getCurrentDay();
    const winnerLevel = event.winnerLevel as BettingLevel;
    const loserLevel = event.loserLevel as BettingLevel;

    const dayStats = this.ensureDailyStats(day);

    // Winner stats
    const winnerStats =
      dayStats.get(winnerLevel) || this.createEmptyLevelStats();
    winnerStats.wins++;
    winnerStats.progressions++; // Winner advances to next level
    winnerStats.winnings += event.winnings;
    dayStats.set(winnerLevel, winnerStats);

    // Track loser stats
    const loserStats = dayStats.get(loserLevel) || this.createEmptyLevelStats();
    loserStats.losses++;
    dayStats.set(loserLevel, loserStats);

    // Update cumulative stats
    const winnerCumulativeStats =
      this.cumulativeLevelStats.get(winnerLevel) ||
      this.createEmptyLevelStats();
    winnerCumulativeStats.wins++;
    winnerCumulativeStats.progressions++;
    winnerCumulativeStats.winnings += event.winnings;
    this.cumulativeLevelStats.set(winnerLevel, winnerCumulativeStats);

    const loserCumulativeStats =
      this.cumulativeLevelStats.get(loserLevel) || this.createEmptyLevelStats();
    loserCumulativeStats.losses++;
    this.cumulativeLevelStats.set(loserLevel, loserCumulativeStats);
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

  private handleDayStarted(event: DayStartedEvent): void {
    // Day events already provide 1-based indexing
    this.currentDay = event.dayNumber;
    this.ensureDailyStats(this.currentDay);
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
   * Ensure daily stats exist for the given day
   */
  private ensureDailyStats(day: number): Map<BettingLevel, LevelStats> {
    if (!this.dailyLevelStats.has(day)) {
      this.dailyLevelStats.set(day, new Map());
    }
    return this.dailyLevelStats.get(day)!;
  }
}

interface LevelStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  cashouts: number;
  progressions: number;
  winnings: number;
}
