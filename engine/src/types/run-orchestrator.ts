// Run Orchestrator - Coordinates run completion and new run initiation
// Handles the flow from run completion to new run creation for continuing players

import { ProgressionManager, RunCompletionResult } from './progression-manager';
import { VirtualDollarManager } from './virtual-dollar-types';
import {
  VirtualDollar,
  GameResult,
  CashOutStrategy,
  CashOutDecision,
  DollarState
} from './virtual-dollar-engine';

// ===== RUN ORCHESTRATOR INTERFACES =====

/**
 * Player Run Context - Information about a player's current runs
 */
export interface PlayerRunContext {
  playerId: string;
  activeRuns: VirtualDollar[];
  completedRuns: RunCompletionResult[];
  totalEarnings: number;
  availableFunds: number;
  canCreateNewRun: boolean;
}

/**
 * New Run Request - Request to create a new run for a player
 */
export interface NewRunRequest {
  playerId: string;
  cashOutStrategy: CashOutStrategy;
  fundingSource: 'DONATION' | 'WINNINGS';
}

/**
 * Run Completion Event - Information about a completed run
 */
export interface RunCompletionEvent {
  runId: string;
  playerId: string;
  completionType: 'JACKPOT' | 'CASH_OUT' | 'LOSS';
  totalWinnings: number;
  playerPayout: number;
  charityContribution: number;
  shouldCreateNewRun: boolean;
}

// ===== RUN ORCHESTRATOR CLASS =====

/**
 * RunOrchestrator - Coordinates progression management with player funding
 * Handles the complete lifecycle from run creation through completion and new run initiation
 */
export class RunOrchestrator {
  private progressionManager: ProgressionManager;
  private dollarManager: VirtualDollarManager;
  private playerFunds: Map<string, number> = new Map(); // Simplified fund tracking
  private playerStrategies: Map<string, CashOutStrategy> = new Map();

  constructor(
    progressionManager?: ProgressionManager,
    dollarManager?: VirtualDollarManager,
    charityPercentage: number = 0.15
  ) {
    this.progressionManager = progressionManager || new ProgressionManager(charityPercentage);
    this.dollarManager = dollarManager || new VirtualDollarManager();
  }

  /**
   * Initialize a player with starting funds and strategy
   */
  initializePlayer(playerId: string, initialFunds: number, strategy: CashOutStrategy): void {
    this.playerFunds.set(playerId, initialFunds);
    this.playerStrategies.set(playerId, strategy);
  }

  /**
   * Create a new run for a player if they have sufficient funds
   */
  createNewRun(request: NewRunRequest): VirtualDollar | null {
    const availableFunds = this.playerFunds.get(request.playerId) || 0;
    const gameFeeCost = 1.10; // $1.10 per game (covers betting and fees)

    if (availableFunds < gameFeeCost) {
      return null; // Insufficient funds
    }

    // Create virtual dollar for new run
    const virtualDollar = this.dollarManager.createVirtualDollar(request.playerId);

    // Initialize progression
    this.progressionManager.initializeRun(virtualDollar);

    // Deduct funds
    this.playerFunds.set(request.playerId, availableFunds - gameFeeCost);

    // Store strategy
    this.playerStrategies.set(request.playerId, request.cashOutStrategy);

    return virtualDollar;
  }

  /**
   * Process a game result and handle run completion/continuation
   */
  processGameResult(virtualDollar: VirtualDollar, result: GameResult): RunCompletionEvent | null {
    const progression = this.progressionManager.processGameResult(virtualDollar, result);

    if (progression.isComplete) {
      return this.handleRunCompletion(virtualDollar, progression.completionReason!);
    }

    // Run continues - check if player wants to cash out
    const strategy = this.playerStrategies.get(virtualDollar.ownerId) || CashOutStrategy.BALANCED;
    const cashOutDecision = this.progressionManager.makeCashOutDecision(virtualDollar, strategy);

    if (cashOutDecision === CashOutDecision.CASH_OUT) {
      const completionResult = this.progressionManager.processCashOut(virtualDollar.runId);
      return this.handleRunCompletion(virtualDollar, 'CASH_OUT', completionResult);
    }

    return null; // Run continues
  }

  /**
   * Handle run completion and determine if new run should be created
   */
  private handleRunCompletion(
    virtualDollar: VirtualDollar, 
    completionType: 'JACKPOT' | 'CASH_OUT' | 'LOSS',
    completionResult?: RunCompletionResult
  ): RunCompletionEvent {
    const playerId = virtualDollar.ownerId;
    const result = completionResult || this.progressionManager.getCompletedRun(virtualDollar.runId)!;

    // Update player funds with winnings
    const currentFunds = this.playerFunds.get(playerId) || 0;
    this.playerFunds.set(playerId, currentFunds + result.playerPayout);

    // Update virtual dollar state
    const newState = completionType === 'LOSS' ? DollarState.LOST : DollarState.CASHED_OUT;
    this.dollarManager.updateDollarState(virtualDollar.id, newState);

    // Determine if player should create a new run
    const gameFeeCost = 1.10;
    const availableFunds = this.playerFunds.get(playerId) || 0;
    const shouldCreateNewRun = availableFunds >= gameFeeCost;

    return {
      runId: virtualDollar.runId,
      playerId,
      completionType,
      totalWinnings: result.totalWinnings,
      playerPayout: result.playerPayout,
      charityContribution: result.charityContribution,
      shouldCreateNewRun
    };
  }

  /**
   * Get player run context
   */
  getPlayerRunContext(playerId: string): PlayerRunContext {
    const activeDollars = this.dollarManager.getDollarsByPlayer(playerId)
      .filter(dollar => dollar.state !== DollarState.LOST && dollar.state !== DollarState.CASHED_OUT);

    const completedRunIds = this.dollarManager.getDollarsByPlayer(playerId)
      .filter(dollar => dollar.state === DollarState.LOST || dollar.state === DollarState.CASHED_OUT)
      .map(dollar => dollar.runId);

    const completedRuns = completedRunIds
      .map(runId => this.progressionManager.getCompletedRun(runId))
      .filter(run => run !== null) as RunCompletionResult[];

    const totalEarnings = completedRuns.reduce((sum, run) => sum + run.playerPayout, 0);
    const availableFunds = this.playerFunds.get(playerId) || 0;
    const gameFeeCost = 1.10;

    return {
      playerId,
      activeRuns: activeDollars,
      completedRuns,
      totalEarnings,
      availableFunds,
      canCreateNewRun: availableFunds >= gameFeeCost
    };
  }

  /**
   * Get all active runs across all players
   */
  getAllActiveRuns(): VirtualDollar[] {
    return this.dollarManager.getPooledDollars()
      .concat(this.progressionManager.getActiveRuns().map(run => 
        this.dollarManager.getDollarByRunId(run.runId)
      ).filter(dollar => dollar !== null) as VirtualDollar[]);
  }

  /**
   * Get player funds
   */
  getPlayerFunds(playerId: string): number {
    return this.playerFunds.get(playerId) || 0;
  }

  /**
   * Add funds to player account (for testing or additional deposits)
   */
  addPlayerFunds(playerId: string, amount: number): void {
    const currentFunds = this.playerFunds.get(playerId) || 0;
    this.playerFunds.set(playerId, currentFunds + amount);
  }

  /**
   * Get player cash-out strategy
   */
  getPlayerStrategy(playerId: string): CashOutStrategy {
    return this.playerStrategies.get(playerId) || CashOutStrategy.BALANCED;
  }

  /**
   * Update player cash-out strategy
   */
  updatePlayerStrategy(playerId: string, strategy: CashOutStrategy): void {
    this.playerStrategies.set(playerId, strategy);
  }

  /**
   * Get total funds across all players (for simulation statistics)
   */
  getTotalPlayerFunds(): number {
    let total = 0;
    for (const funds of this.playerFunds.values()) {
      total += funds;
    }
    return total;
  }

  /**
   * Get number of active players (players with funds or active runs)
   */
  getActivePlayerCount(): number {
    const playersWithFunds = Array.from(this.playerFunds.entries())
      .filter(([_, funds]) => funds > 0).length;
    
    const playersWithActiveRuns = new Set(
      this.getAllActiveRuns().map(dollar => dollar.ownerId)
    ).size;

    return Math.max(playersWithFunds, playersWithActiveRuns);
  }

  /**
   * Auto-create runs for players with funds and specific strategies
   */
  autoCreateRuns(maxRunsPerPlayer: number = 1): VirtualDollar[] {
    const newRuns: VirtualDollar[] = [];
    
    for (const [playerId, funds] of this.playerFunds.entries()) {
      const gameFeeCost = 1.10;
      if (funds < gameFeeCost) continue;

      const context = this.getPlayerRunContext(playerId);
      if (context.activeRuns.length >= maxRunsPerPlayer) continue;

      const strategy = this.getPlayerStrategy(playerId);
      const newRun = this.createNewRun({
        playerId,
        cashOutStrategy: strategy,
        fundingSource: 'DONATION'
      });

      if (newRun) {
        newRuns.push(newRun);
      }
    }

    return newRuns;
  }
}