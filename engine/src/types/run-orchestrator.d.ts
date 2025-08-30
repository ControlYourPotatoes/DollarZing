import { ProgressionManager, RunCompletionResult } from './progression-manager';
import { VirtualDollarManager } from './virtual-dollar-types';
import { VirtualDollar, GameResult, CashOutStrategy } from './virtual-dollar-engine';
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
/**
 * RunOrchestrator - Coordinates progression management with player funding
 * Handles the complete lifecycle from run creation through completion and new run initiation
 */
export declare class RunOrchestrator {
    private progressionManager;
    private dollarManager;
    private playerFunds;
    private playerStrategies;
    constructor(progressionManager?: ProgressionManager, dollarManager?: VirtualDollarManager, charityPercentage?: number);
    /**
     * Initialize a player with starting funds and strategy
     */
    initializePlayer(playerId: string, initialFunds: number, strategy: CashOutStrategy): void;
    /**
     * Create a new run for a player if they have sufficient funds
     */
    createNewRun(request: NewRunRequest): VirtualDollar | null;
    /**
     * Process a game result and handle run completion/continuation
     */
    processGameResult(virtualDollar: VirtualDollar, result: GameResult): RunCompletionEvent | null;
    /**
     * Handle run completion and determine if new run should be created
     */
    private handleRunCompletion;
    /**
     * Get player run context
     */
    getPlayerRunContext(playerId: string): PlayerRunContext;
    /**
     * Get all active runs across all players
     */
    getAllActiveRuns(): VirtualDollar[];
    /**
     * Get player funds
     */
    getPlayerFunds(playerId: string): number;
    /**
     * Add funds to player account (for testing or additional deposits)
     */
    addPlayerFunds(playerId: string, amount: number): void;
    /**
     * Get player cash-out strategy
     */
    getPlayerStrategy(playerId: string): CashOutStrategy;
    /**
     * Update player cash-out strategy
     */
    updatePlayerStrategy(playerId: string, strategy: CashOutStrategy): void;
    /**
     * Get total funds across all players (for simulation statistics)
     */
    getTotalPlayerFunds(): number;
    /**
     * Get number of active players (players with funds or active runs)
     */
    getActivePlayerCount(): number;
    /**
     * Auto-create runs for players with funds and specific strategies
     */
    autoCreateRuns(maxRunsPerPlayer?: number): VirtualDollar[];
}
//# sourceMappingURL=run-orchestrator.d.ts.map