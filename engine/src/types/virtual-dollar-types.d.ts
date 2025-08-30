import { VirtualDollar, DollarState, GameSession, BettingLevel, ValidationResult } from './virtual-dollar-engine';
interface StateTransition {
    state: DollarState;
    timestamp: Date;
}
interface PoolStatistics {
    totalDollars: number;
    pooledDollars: number;
    inGameDollars: number;
    completedDollars: number;
}
/**
 * VirtualDollarManager - Core class for managing virtual dollar lifecycle
 * Handles creation, state management, pool tracking, and history maintenance
 */
export declare class VirtualDollarManager {
    private dollars;
    private serialNumbers;
    private pooledDollars;
    private dollarsByPlayer;
    private stateHistory;
    /**
     * Generate a realistic serial number following letter+8digits+letter pattern
     * Uses weighted letter distribution to simulate real currency patterns
     */
    generateSerialNumber(): string;
    /**
     * Generate a unique ID for virtual dollars
     */
    private generateUniqueId;
    /**
     * Generate a unique run ID for independent jackpot attempts
     */
    private generateRunId;
    /**
     * Create a new virtual dollar with validation - Conditionally uses object pooling
     */
    createVirtualDollar(playerId: string): VirtualDollar;
    /**
     * Update dollar state with validation and history tracking
     */
    updateDollarState(dollarId: string, newState: DollarState): ValidationResult;
    /**
     * Validate state transition rules
     */
    private validateStateTransition;
    /**
     * Update pool tracking based on state changes
     */
    private updatePoolTracking;
    /**
     * Get dollar by ID
     */
    getDollar(dollarId: string): VirtualDollar | null;
    /**
     * Get dollar by serial number
     */
    getDollarBySerial(serialNumber: string): VirtualDollar | null;
    /**
     * Get all dollars owned by a specific player
     */
    getDollarsByPlayer(playerId: string): VirtualDollar[];
    /**
     * Get all pooled dollars ready for matching
     */
    getPooledDollars(): VirtualDollar[];
    /**
     * Create multiple virtual dollars in batch for efficiency
     */
    createBatchVirtualDollars(playerIds: string[]): VirtualDollar[];
    /**
     * Get state history for a specific dollar
     */
    getDollarStateHistory(dollarId: string): StateTransition[];
    /**
     * Get pool statistics
     */
    getPoolStatistics(): PoolStatistics;
    /**
     * Update run-specific data after a game
     */
    updateRunData(dollarId: string, winnings: number): ValidationResult;
    /**
     * Get dollar by run ID
     */
    getDollarByRunId(runId: string): VirtualDollar | null;
    /**
     * Get all active runs for a player
     */
    getActiveRunsByPlayer(playerId: string): VirtualDollar[];
    /**
     * Get completed runs for a player
     */
    getCompletedRunsByPlayer(playerId: string): VirtualDollar[];
    /**
     * Release a virtual dollar back to the object pool when no longer needed
     * Should be called when a dollar reaches a final state and won't be accessed again
     */
    releaseDollar(dollarId: string): void;
    /**
     * Cleanup completed dollars to free memory - batch release to pool
     * This should be called periodically during long simulations
     */
    cleanupCompletedDollars(): number;
}
export { VirtualDollar, DollarState, GameSession, BettingLevel, ValidationResult };
//# sourceMappingURL=virtual-dollar-types.d.ts.map