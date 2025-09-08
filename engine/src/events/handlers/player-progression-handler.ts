/**
 * PlayerProgressionHandler - Event-driven player progression and level advancement
 * Handles player progression logic extracted from PlayerManager and ProgressionManager
 */

import { EventBus, EventSubscription } from '../event-bus';
import {
  GameResolvedEvent,
  PlayerProgressionEvent,
  PlayerProgressionFailedEvent,
  CashOutDecisionEvent,
  CashOutCompletedEvent,
  RunCompletedEvent,
  EVENT_TYPES
} from '../event-types';
import { 
  VirtualDollar, 
  CashOutStrategy, 
  CashOutDecision,
  GameResult 
} from '../../types/virtual-dollar-engine';
import { ProgressionManager } from '../../types/progression-manager';

export class PlayerProgressionHandler {
  private subscription: EventSubscription | null = null;

  constructor(
    private eventBus: EventBus,
    private progressionManager: ProgressionManager
  ) {
    this.setupEventSubscriptions();
  }

  private setupEventSubscriptions(): void {
    // Subscribe to GAME_RESOLVED events to handle winner progression
    this.subscription = this.eventBus.on<GameResolvedEvent>(
      EVENT_TYPES.GAME_RESOLVED,
      this.handleGameResolved.bind(this),
      10 // Higher priority to ensure we process progression before other handlers
    );
  }

  private async handleGameResolved(event: GameResolvedEvent): Promise<void> {
    try {
      // Process both winner and loser progression
      await this.processWinnerProgression(event);
      await this.processLoserElimination(event);
    } catch (error) {
      console.error(`[PlayerProgressionHandler] Error processing game result:`, error);
      
      await this.eventBus.emit(EVENT_TYPES.PLAYER_PROGRESSION_FAILED, {
        type: EVENT_TYPES.PLAYER_PROGRESSION_FAILED,
        timestamp: new Date(),
        playerId: event.winnerId,
        virtualDollarId: event.winnerDollarId,
        currentLevel: event.winnerLevel,
        reason: 'Progression processing failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async processWinnerProgression(event: GameResolvedEvent): Promise<void> {
    // Create VirtualDollar object for progression processing
    const winnerDollar: VirtualDollar = {
      id: event.winnerDollarId,
      ownerId: event.winnerId,
      currentLevel: event.winnerLevel,
      runId: `run-${event.winnerDollarId}`,
      serialNumber: `L${event.winnerLevel.toString().padStart(8, '0')}A`,
      currentScore: 0.75, // Winner score
      state: 'IN_GAME' as any,
      createdAt: new Date(),
      gameHistory: [],
      gamesInThisRun: 0,
      currentRunWinnings: 0,
      isIndependentRun: true
    };

    try {
      // Process the game result through progression manager
      const progressionState = this.progressionManager.processGameResult(
        winnerDollar,
        GameResult.WIN
      );

      if (progressionState.isComplete) {
        // Run completed (jackpot or elimination)
        await this.emitRunCompleted(event.winnerId, event.winnerDollarId, progressionState);
      } else {
        // Player advanced to next level
        await this.emitPlayerAdvanced(
          event.winnerId,
          event.winnerDollarId,
          event.winnerLevel,
          progressionState.currentLevel,
          progressionState.currentWinnings,
          progressionState.gamesWonInRun
        );

        // Check for cash-out decision
        await this.processCashOutDecision(
          winnerDollar,
          event.winnerId,
          progressionState
        );
      }
    } catch (error) {
      throw new Error(`Winner progression failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async processLoserElimination(event: GameResolvedEvent): Promise<void> {
    // Create VirtualDollar object for the loser
    const loserDollar: VirtualDollar = {
      id: event.loserDollarId,
      ownerId: event.loserId,
      currentLevel: event.loserLevel,
      runId: `run-${event.loserDollarId}`,
      serialNumber: `L${event.loserLevel.toString().padStart(8, '0')}B`,
      currentScore: 0.25, // Loser score
      state: 'LOST' as any,
      createdAt: new Date(),
      gameHistory: [],
      gamesInThisRun: 0,
      currentRunWinnings: 0,
      isIndependentRun: true
    };

    try {
      // Process the loss through progression manager
      const progressionState = this.progressionManager.processGameResult(
        loserDollar,
        GameResult.LOSS
      );

      // Loser is eliminated - emit run completion
      await this.emitRunCompleted(event.loserId, event.loserDollarId, progressionState);
    } catch (error) {
      console.error(`[PlayerProgressionHandler] Error processing loser elimination:`, error);
      // Don't throw for loser processing errors, just log them
    }
  }

  private async processCashOutDecision(
    virtualDollar: VirtualDollar,
    playerId: string,
    progressionState: any
  ): Promise<void> {
    try {
      // Get player's cash-out strategy (mock for now - should come from player data)
      const strategy = this.getPlayerStrategy(playerId);
      
      // Make cash-out decision
      const decision = this.progressionManager.makeCashOutDecision(virtualDollar, strategy);
      
      // Emit cash-out decision event
      await this.eventBus.emit(EVENT_TYPES.CASH_OUT_DECISION, {
        type: EVENT_TYPES.CASH_OUT_DECISION,
        timestamp: new Date(),
        playerId,
        virtualDollarId: virtualDollar.id,
        decision: decision === CashOutDecision.CASH_OUT ? 'CASH_OUT' : 'CONTINUE',
        currentLevel: progressionState.currentLevel,
        totalWinnings: progressionState.currentWinnings,
        cashOutStrategy: strategy,
        reason: this.getCashOutReason(strategy, progressionState.currentLevel),
        amount: decision === CashOutDecision.CASH_OUT ? progressionState.currentWinnings : undefined
      });

      // If player decided to cash out, process the cash-out
      if (decision === CashOutDecision.CASH_OUT) {
        const completionResult = this.progressionManager.processCashOut(virtualDollar.runId);
        
        await this.eventBus.emit(EVENT_TYPES.CASH_OUT_COMPLETED, {
          type: EVENT_TYPES.CASH_OUT_COMPLETED,
          timestamp: new Date(),
          playerId,
          virtualDollarId: virtualDollar.id,
          finalLevel: completionResult.finalLevel,
          totalWinnings: completionResult.totalWinnings,
          cashOutAmount: completionResult.playerPayout,
          runCompleted: true,
          wasJackpot: completionResult.wasJackpot
        });

        // Emit run completion
        await this.eventBus.emit(EVENT_TYPES.RUN_COMPLETED, {
          type: EVENT_TYPES.RUN_COMPLETED,
          timestamp: new Date(),
          playerId,
          virtualDollarId: virtualDollar.id,
          completionType: 'CASH_OUT',
          finalLevel: completionResult.finalLevel,
          totalWinnings: completionResult.totalWinnings,
          gamesPlayed: completionResult.gamesPlayedInRun,
          wasJackpot: false
        });
      }
    } catch (error) {
      console.error(`[PlayerProgressionHandler] Cash-out decision processing failed:`, error);
      await this.eventBus.emit(EVENT_TYPES.PLAYER_PROGRESSION_FAILED, {
        type: EVENT_TYPES.PLAYER_PROGRESSION_FAILED,
        timestamp: new Date(),
        playerId,
        virtualDollarId: virtualDollar.id,
        currentLevel: progressionState.currentLevel,
        reason: 'Cash-out decision failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async emitPlayerAdvanced(
    playerId: string,
    virtualDollarId: string,
    fromLevel: number,
    toLevel: number,
    totalWinnings: number,
    gamesPlayed: number
  ): Promise<void> {
    await this.eventBus.emit(EVENT_TYPES.PLAYER_ADVANCED, {
      type: EVENT_TYPES.PLAYER_ADVANCED,
      timestamp: new Date(),
      playerId,
      virtualDollarId,
      fromLevel,
      toLevel,
      totalWinnings,
      gamesPlayed
    });
  }

  private async emitRunCompleted(
    playerId: string,
    virtualDollarId: string,
    progressionState: any
  ): Promise<void> {
    let completionType: 'CASH_OUT' | 'JACKPOT' | 'ELIMINATED';
    
    switch (progressionState.completionReason) {
      case 'JACKPOT':
        completionType = 'JACKPOT';
        break;
      case 'CASH_OUT':
        completionType = 'CASH_OUT';
        break;
      case 'LOSS':
      default:
        completionType = 'ELIMINATED';
        break;
    }

    await this.eventBus.emit(EVENT_TYPES.RUN_COMPLETED, {
      type: EVENT_TYPES.RUN_COMPLETED,
      timestamp: new Date(),
      playerId,
      virtualDollarId,
      completionType,
      finalLevel: progressionState.currentLevel,
      totalWinnings: progressionState.currentWinnings,
      gamesPlayed: progressionState.gamesWonInRun + (progressionState.completionReason === 'LOSS' ? 1 : 0),
      wasJackpot: progressionState.completionReason === 'JACKPOT'
    });
  }

  private getPlayerStrategy(playerId: string): CashOutStrategy {
    // For now, derive strategy from player ID pattern
    // In real implementation, this would come from player data
    if (playerId.includes('conservative')) return CashOutStrategy.CONSERVATIVE;
    if (playerId.includes('aggressive')) return CashOutStrategy.AGGRESSIVE;
    return CashOutStrategy.BALANCED; // Default
  }

  private getCashOutReason(strategy: CashOutStrategy, currentLevel: number): string {
    switch (strategy) {
      case CashOutStrategy.CONSERVATIVE:
        return `Conservative strategy: cashing out at level ${currentLevel} for safety`;
      case CashOutStrategy.AGGRESSIVE:
        return `Aggressive strategy: continuing to pursue jackpot`;
      case CashOutStrategy.BALANCED:
        return `Balanced strategy: evaluating risk vs reward at level ${currentLevel}`;
      default:
        return 'Unknown strategy';
    }
  }

  public dispose(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }
}