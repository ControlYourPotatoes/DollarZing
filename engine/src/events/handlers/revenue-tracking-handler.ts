/**
 * RevenueTrackingHandler - Event-driven revenue tracking and financial transaction processing
 * Integrates with RevenueCalculator to handle comprehensive financial analytics
 */

import { EventBus, EventSubscription } from "../event-bus";
import {
  GameResolvedEvent,
  CashOutCompletedEvent,
  RevenueGameProcessedEvent,
  RevenueCashOutProcessedEvent,
  RevenueUpdateEvent,
  ErrorEvent,
  EVENT_TYPES,
} from "../event-types";
import { RevenueCalculator } from "../../types/revenue-calculator";
import { GameSession, VirtualDollar, DollarState, BettingLevel } from "../../types/virtual-dollar-engine";

/**
 * Transaction record for comprehensive financial logging
 */
export interface TransactionRecord {
  id: string;
  type: "GAME_REVENUE" | "CASH_OUT_REVENUE";
  timestamp: Date;
  amount: number;
  playerId?: string;
  gameId?: string;
  virtualDollarId?: string;
  details: {
    [key: string]: any;
  };
}

/**
 * Transaction filter options for searching transaction history
 */
export interface TransactionFilter {
  type?: "GAME_REVENUE" | "CASH_OUT_REVENUE";
  playerId?: string;
  gameId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
}

/**
 * Revenue tracking configuration
 */
export interface RevenueTrackingConfig {
  enableTransactionLogging: boolean;
  maxTransactionHistory: number;
  enableRealtimeUpdates: boolean;
}

/**
 * Revenue tracking handler that processes financial events and maintains comprehensive transaction logs
 */
export class RevenueTrackingHandler {
  private gameResolvedSubscription: EventSubscription | null = null;
  private cashOutCompletedSubscription: EventSubscription | null = null;
  private transactionHistory: TransactionRecord[] = [];
  private config: RevenueTrackingConfig;
  private transactionIdCounter = 1;

  constructor(
    private eventBus: EventBus,
    private revenueCalculator: RevenueCalculator,
    config?: Partial<RevenueTrackingConfig>
  ) {
    this.config = {
      enableTransactionLogging: true,
      maxTransactionHistory: 10000,
      enableRealtimeUpdates: true,
      ...config
    };

    this.setupEventSubscriptions();
    this.validateRevenueCalculatorIntegration();
  }

  private setupEventSubscriptions(): void {
    // Subscribe to GAME_RESOLVED events to process game revenue
    this.gameResolvedSubscription = this.eventBus.on<GameResolvedEvent>(
      EVENT_TYPES.GAME_RESOLVED,
      this.handleGameResolved.bind(this),
      15 // High priority to ensure revenue tracking happens early
    );

    // Subscribe to CASH_OUT_COMPLETED events to process cash-out revenue
    this.cashOutCompletedSubscription = this.eventBus.on<CashOutCompletedEvent>(
      EVENT_TYPES.CASH_OUT_COMPLETED,
      this.handleCashOutCompleted.bind(this),
      15 // High priority to ensure revenue tracking happens early
    );
  }

  /**
   * Handle GAME_RESOLVED event by processing game revenue through RevenueCalculator
   */
  private async handleGameResolved(event: GameResolvedEvent): Promise<void> {
    try {
      // Validate required event data
      this.validateGameResolvedEvent(event);

      // Create game session for revenue calculator
      const gameSession: GameSession = this.createGameSessionFromEvent(event);

      // Process revenue through calculator
      const revenueResult = this.revenueCalculator.processGameRevenue(gameSession);

      if (!revenueResult.isValid) {
        await this.emitRevenueError(
          EVENT_TYPES.GAME_RESOLVED,
          event.gameId,
          `Game revenue processing failed: ${revenueResult.errors.join(", ")}`
        );
        return;
      }

      // Calculate revenue components
      const platformFee = 0.2; // Standard platform fee per game
      const gameRevenue = platformFee;
      const platformRevenue = platformFee;
      const charityContribution = 0; // No charity from game fees
      const totalGameRevenue = gameRevenue;

      // Log transaction if enabled
      if (this.config.enableTransactionLogging) {
        this.logTransaction({
          type: "GAME_REVENUE",
          gameId: event.gameId,
          timestamp: event.timestamp,
          amount: gameRevenue,
          details: {
            winnerId: event.winnerId,
            loserId: event.loserId,
            winnings: event.winnings,
            platformFee: platformFee,
            winnerLevel: event.winnerLevel,
            loserLevel: event.loserLevel
          }
        });
      }

      // Emit revenue game processed event
      await this.eventBus.emit(EVENT_TYPES.REVENUE_GAME_PROCESSED, {
        type: EVENT_TYPES.REVENUE_GAME_PROCESSED,
        timestamp: new Date(),
        gameId: event.gameId,
        gameRevenue: gameRevenue,
        platformRevenue: platformRevenue,
        charityContribution: charityContribution,
        totalGameRevenue: totalGameRevenue,
      } as RevenueGameProcessedEvent);

      // Emit revenue update if real-time updates are enabled
      if (this.config.enableRealtimeUpdates) {
        await this.emitRevenueUpdate();
      }

      console.log(
        `[RevenueTrackingHandler] Processed game revenue: ${gameRevenue} for game ${event.gameId}`
      );
    } catch (error) {
      console.error(
        `[RevenueTrackingHandler] Error processing game revenue:`,
        error
      );

      await this.emitRevenueError(
        EVENT_TYPES.GAME_RESOLVED,
        event.gameId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Handle CASH_OUT_COMPLETED event by processing cash-out revenue
   */
  private async handleCashOutCompleted(event: CashOutCompletedEvent): Promise<void> {
    try {
      // Validate required event data
      this.validateCashOutCompletedEvent(event);

      // Process cash-out through revenue calculator
      const cashOutResult = this.revenueCalculator.processCashOut(event.cashOutAmount);

      if (!cashOutResult.validation.isValid) {
        await this.emitRevenueError(
          EVENT_TYPES.CASH_OUT_COMPLETED,
          event.virtualDollarId,
          `Cash-out processing failed: ${cashOutResult.validation.errors.join(", ")}`
        );
        return;
      }

      // Get current revenue stream for total player winnings
      const revenueStream = this.revenueCalculator.getRevenueStream();

      // Log transaction if enabled
      if (this.config.enableTransactionLogging) {
        this.logTransaction({
          type: "CASH_OUT_REVENUE",
          playerId: event.playerId,
          virtualDollarId: event.virtualDollarId,
          timestamp: event.timestamp,
          amount: event.cashOutAmount,
          details: {
            playerAmount: cashOutResult.playerAmount,
            charityAmount: cashOutResult.charityAmount,
            finalLevel: event.finalLevel,
            totalWinnings: event.totalWinnings,
            runCompleted: event.runCompleted,
            wasJackpot: event.wasJackpot
          }
        });
      }

      // Emit revenue cash-out processed event
      await this.eventBus.emit(EVENT_TYPES.REVENUE_CASH_OUT_PROCESSED, {
        type: EVENT_TYPES.REVENUE_CASH_OUT_PROCESSED,
        timestamp: new Date(),
        playerId: event.playerId,
        virtualDollarId: event.virtualDollarId,
        cashOutAmount: event.cashOutAmount,
        playerWinnings: cashOutResult.playerAmount,
        totalPlayerWinnings: revenueStream.playerWinnings,
      } as RevenueCashOutProcessedEvent);

      // Emit revenue update if real-time updates are enabled
      if (this.config.enableRealtimeUpdates) {
        await this.emitRevenueUpdate();
      }

      console.log(
        `[RevenueTrackingHandler] Processed cash-out revenue: ${event.cashOutAmount} for player ${event.playerId}`
      );
    } catch (error) {
      console.error(
        `[RevenueTrackingHandler] Error processing cash-out revenue:`,
        error
      );

      await this.emitRevenueError(
        EVENT_TYPES.CASH_OUT_COMPLETED,
        event.virtualDollarId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Emit comprehensive revenue update event
   */
  private async emitRevenueUpdate(): Promise<void> {
    try {
      const revenueStream = this.revenueCalculator.getRevenueStream();

      await this.eventBus.emit(EVENT_TYPES.REVENUE_UPDATE, {
        type: EVENT_TYPES.REVENUE_UPDATE,
        timestamp: new Date(),
        totalPlatformRevenue: revenueStream.platformClickRevenue,
        totalCharityContributions: revenueStream.charityContributions,
        totalPlayerPayouts: revenueStream.playerWinnings,
        totalGames: revenueStream.totalGames,
        revenuePerGame: revenueStream.totalGames > 0 
          ? revenueStream.platformClickRevenue / revenueStream.totalGames 
          : 0,
      } as RevenueUpdateEvent);
    } catch (error) {
      console.error(`[RevenueTrackingHandler] Error emitting revenue update:`, error);
    }
  }

  /**
   * Emit revenue error event
   */
  private async emitRevenueError(
    eventType: string,
    contextId: string,
    error: string
  ): Promise<void> {
    try {
      await this.eventBus.emit(EVENT_TYPES.EVENT_ERROR, {
        type: EVENT_TYPES.EVENT_ERROR,
        timestamp: new Date(),
        eventType: eventType,
        error: error,
        context: { contextId }
      } as ErrorEvent);
    } catch (emitError) {
      console.error(`[RevenueTrackingHandler] Failed to emit error event:`, emitError);
    }
  }

  /**
   * Create game session from game resolved event
   * Creates minimal VirtualDollar objects for revenue tracking purposes
   */
  private createGameSessionFromEvent(event: GameResolvedEvent): GameSession {
    // Create minimal VirtualDollar objects with required properties
    const winnerDollar: VirtualDollar = {
      id: event.winnerDollarId,
      serialNumber: `TRACK-${event.winnerDollarId}`,
      currentScore: event.winnings,
      currentLevel: event.winnerLevel as BettingLevel,
      state: DollarState.WON,
      playerId: event.winnerId,
      gamesWon: 1,
      gamesLost: 0,
      gamesPlayed: 1,
      currentProgression: event.winnings,
      totalProgression: event.winnings,
      isActive: true,
      createdAt: event.timestamp
    };

    const loserDollar: VirtualDollar = {
      id: event.loserDollarId,
      serialNumber: `TRACK-${event.loserDollarId}`,
      currentScore: 0,
      currentLevel: event.loserLevel as BettingLevel,
      state: DollarState.LOST,
      playerId: event.loserId,
      gamesWon: 0,
      gamesLost: 1,
      gamesPlayed: 1,
      currentProgression: 0,
      totalProgression: 0,
      isActive: false,
      createdAt: event.timestamp
    };

    return {
      id: event.gameId,
      dollar1: winnerDollar,
      dollar2: loserDollar,
      winner: winnerDollar,
      loser: loserDollar,
      level: event.winnerLevel as BettingLevel,
      platformFee: 0.2, // Standard platform fee
      timestamp: event.timestamp,
      gameNumber: 0, // Not available in event data
      dailySeed: "revenue-tracking", // Placeholder for revenue tracking
      winnings: event.winnings
    };
  }

  /**
   * Log transaction to history with automatic cleanup
   */
  private logTransaction(transaction: Partial<TransactionRecord>): void {
    const record: TransactionRecord = {
      id: `TXN-${this.transactionIdCounter.toString().padStart(6, '0')}`,
      type: transaction.type!,
      timestamp: transaction.timestamp!,
      amount: transaction.amount!,
      playerId: transaction.playerId,
      gameId: transaction.gameId,
      virtualDollarId: transaction.virtualDollarId,
      details: transaction.details || {}
    };

    this.transactionHistory.unshift(record); // Add to beginning for recent-first ordering
    this.transactionIdCounter++;

    // Clean up old transactions if over limit
    if (this.transactionHistory.length > this.config.maxTransactionHistory) {
      this.transactionHistory = this.transactionHistory.slice(0, this.config.maxTransactionHistory);
    }
  }

  /**
   * Validate game resolved event has required data
   */
  private validateGameResolvedEvent(event: GameResolvedEvent): void {
    const missingFields: string[] = [];

    if (!event.gameId) missingFields.push("gameId");
    if (!event.winnerId) missingFields.push("winnerId");
    if (!event.loserId) missingFields.push("loserId");
    if (!event.winnerDollarId) missingFields.push("winnerDollarId");
    if (!event.loserDollarId) missingFields.push("loserDollarId");
    if (event.winnings === undefined || event.winnings === null) missingFields.push("winnings");
    if (!event.timestamp) missingFields.push("timestamp");

    if (missingFields.length > 0) {
      throw new Error(`Missing required event data: ${missingFields.join(", ")}`);
    }
  }

  /**
   * Validate cash-out completed event has required data
   */
  private validateCashOutCompletedEvent(event: CashOutCompletedEvent): void {
    const missingFields: string[] = [];

    if (!event.playerId) missingFields.push("playerId");
    if (!event.virtualDollarId) missingFields.push("virtualDollarId");
    if (event.cashOutAmount === undefined || event.cashOutAmount === null) missingFields.push("cashOutAmount");
    if (!event.timestamp) missingFields.push("timestamp");

    if (missingFields.length > 0) {
      throw new Error(`Missing required event data: ${missingFields.join(", ")}`);
    }
  }

  /**
   * Validate revenue calculator integration on startup
   */
  private validateRevenueCalculatorIntegration(): void {
    try {
      // Verify revenue calculator is responsive
      const revenueStream = this.revenueCalculator.getRevenueStream();
      
      if (!revenueStream) {
        throw new Error("Revenue calculator returned invalid revenue stream");
      }

      console.log("[RevenueTrackingHandler] Revenue calculator integration validated");
    } catch (error) {
      console.error("[RevenueTrackingHandler] Revenue calculator integration failed:", error);
      throw error;
    }
  }

  /**
   * Get transaction history with optional filtering
   */
  getTransactionHistory(filter?: TransactionFilter): TransactionRecord[] {
    if (!filter) {
      return [...this.transactionHistory];
    }

    return this.transactionHistory.filter(transaction => {
      // Type filter
      if (filter.type && transaction.type !== filter.type) {
        return false;
      }

      // Player ID filter
      if (filter.playerId && transaction.playerId !== filter.playerId) {
        return false;
      }

      // Game ID filter
      if (filter.gameId && transaction.gameId !== filter.gameId) {
        return false;
      }

      // Date range filter
      if (filter.dateFrom && transaction.timestamp < filter.dateFrom) {
        return false;
      }
      if (filter.dateTo && transaction.timestamp > filter.dateTo) {
        return false;
      }

      // Amount range filter
      if (filter.minAmount !== undefined && transaction.amount < filter.minAmount) {
        return false;
      }
      if (filter.maxAmount !== undefined && transaction.amount > filter.maxAmount) {
        return false;
      }

      return true;
    });
  }

  /**
   * Generate comprehensive revenue report through revenue calculator
   */
  generateRevenueReport() {
    return this.revenueCalculator.generateRevenueReport();
  }

  /**
   * Update charity percentage configuration
   */
  updateCharityPercentage(percentage: number) {
    return this.revenueCalculator.setCharityPercentage(percentage);
  }

  /**
   * Get current revenue stream state
   */
  getRevenueStream() {
    return this.revenueCalculator.getRevenueStream();
  }

  /**
   * Get revenue tracking statistics
   */
  getTrackingStatistics(): {
    totalTransactions: number;
    gameTransactions: number;
    cashOutTransactions: number;
    totalVolume: number;
    averageTransactionAmount: number;
  } {
    const gameTransactions = this.transactionHistory.filter(t => t.type === "GAME_REVENUE");
    const cashOutTransactions = this.transactionHistory.filter(t => t.type === "CASH_OUT_REVENUE");
    const totalVolume = this.transactionHistory.reduce((sum, t) => sum + t.amount, 0);

    return {
      totalTransactions: this.transactionHistory.length,
      gameTransactions: gameTransactions.length,
      cashOutTransactions: cashOutTransactions.length,
      totalVolume: totalVolume,
      averageTransactionAmount: this.transactionHistory.length > 0 
        ? totalVolume / this.transactionHistory.length 
        : 0
    };
  }

  /**
   * Clear transaction history (for testing or reset purposes)
   */
  clearTransactionHistory(): void {
    this.transactionHistory = [];
    this.transactionIdCounter = 1;
  }

  /**
   * Update revenue tracking configuration
   */
  updateConfiguration(config: Partial<RevenueTrackingConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Apply max history limit if changed
    if (config.maxTransactionHistory !== undefined && 
        this.transactionHistory.length > config.maxTransactionHistory) {
      this.transactionHistory = this.transactionHistory.slice(0, config.maxTransactionHistory);
    }
  }

  /**
   * Get current configuration
   */
  getConfiguration(): RevenueTrackingConfig {
    return { ...this.config };
  }

  /**
   * Dispose of the handler and clean up subscriptions
   */
  dispose(): void {
    if (this.gameResolvedSubscription) {
      this.gameResolvedSubscription.unsubscribe();
      this.gameResolvedSubscription = null;
    }

    if (this.cashOutCompletedSubscription) {
      this.cashOutCompletedSubscription.unsubscribe();
      this.cashOutCompletedSubscription = null;
    }

    console.log("[RevenueTrackingHandler] Disposed - cleaned up subscriptions");
  }
}