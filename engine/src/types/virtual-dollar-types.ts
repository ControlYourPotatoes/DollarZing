// Virtual Dollar Manager Implementation
// Handles creation, lifecycle management, and tracking of virtual dollars

import {
  VirtualDollar,
  DollarState,
  GameSession,
  BettingLevel,
  ValidationResult
} from './virtual-dollar-engine';
import { getObjectPoolManager, isObjectPoolingEnabled } from './object-pool';

// State transition history tracking
interface StateTransition {
  state: DollarState;
  timestamp: Date;
}

// Pool statistics interface
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
export class VirtualDollarManager {
  private dollars: Map<string, VirtualDollar> = new Map();
  private serialNumbers: Set<string> = new Set();
  private pooledDollars: Set<string> = new Set();
  private dollarsByPlayer: Map<string, Set<string>> = new Map();
  private stateHistory: Map<string, StateTransition[]> = new Map();

  /**
   * Generate a realistic serial number following letter+8digits+letter pattern
   * Uses weighted letter distribution to simulate real currency patterns
   */
  generateSerialNumber(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    
    const firstLetter = letters[Math.floor(Math.random() * letters.length)];
    const lastLetter = letters[Math.floor(Math.random() * letters.length)];
    
    // Generate 8 random digits
    const digits = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    
    return `${firstLetter}${digits}${lastLetter}`;
  }

  /**
   * Generate a unique ID for virtual dollars
   */
  private generateUniqueId(): string {
    return `vd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a unique run ID for independent jackpot attempts
   */
  private generateRunId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new virtual dollar with validation - Conditionally uses object pooling
   */
  createVirtualDollar(playerId: string): VirtualDollar {
    // Validate player ID
    if (!playerId || playerId.trim() === '') {
      throw new Error('Invalid player ID');
    }

    // Generate unique serial number with collision detection
    let serialNumber: string;
    let attempts = 0;
    const maxAttempts = 1000;

    do {
      serialNumber = this.generateSerialNumber();
      attempts++;
      if (attempts > maxAttempts) {
        throw new Error('Serial number collision detected');
      }
    } while (this.serialNumbers.has(serialNumber));

    let dollar: VirtualDollar;

    if (isObjectPoolingEnabled()) {
      // Get object from pool and initialize it
      const poolManager = getObjectPoolManager();
      dollar = poolManager.virtualDollarPool.acquire();
      
      poolManager.virtualDollarPool.initializeDollar(
        dollar,
        this.generateUniqueId(),
        serialNumber,
        playerId,
        this.generateRunId()
      );
    } else {
      // Create directly without pooling
      dollar = {
        id: this.generateUniqueId(),
        serialNumber,
        currentScore: 0,
        currentLevel: 1, // Start at betting level 1
        state: DollarState.CREATED,
        ownerId: playerId,
        runId: this.generateRunId(),
        createdAt: new Date(),
        gameHistory: [],
        gamesInThisRun: 0,
        currentRunWinnings: 0,
        isIndependentRun: true
      };
    }

    // Store dollar and track serial number
    this.dollars.set(dollar.id, dollar);
    this.serialNumbers.add(serialNumber);
    
    // Track by player
    if (!this.dollarsByPlayer.has(playerId)) {
      this.dollarsByPlayer.set(playerId, new Set());
    }
    this.dollarsByPlayer.get(playerId)!.add(dollar.id);

    // Initialize state history
    this.stateHistory.set(dollar.id, [{
      state: DollarState.CREATED,
      timestamp: new Date()
    }]);

    return dollar;
  }

  /**
   * Update dollar state with validation and history tracking
   */
  updateDollarState(dollarId: string, newState: DollarState): ValidationResult {
    const dollar = this.dollars.get(dollarId);
    
    if (!dollar) {
      return {
        isValid: false,
        errors: [`Dollar with ID ${dollarId} not found`],
        warnings: []
      };
    }

    // Validate state transition
    const validationResult = this.validateStateTransition(dollar.state, newState);
    if (!validationResult.isValid) {
      return validationResult;
    }

    // Update state
    dollar.state = newState;
    
    // Track state history
    const history = this.stateHistory.get(dollarId) || [];
    history.push({
      state: newState,
      timestamp: new Date()
    });
    this.stateHistory.set(dollarId, history);

    // Update pool tracking
    this.updatePoolTracking(dollarId, newState);

    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }

  /**
   * Validate state transition rules
   */
  private validateStateTransition(currentState: DollarState, newState: DollarState): ValidationResult {
    const errors: string[] = [];
    
    // Final states cannot transition
    if (currentState === DollarState.CASHED_OUT || currentState === DollarState.LOST) {
      errors.push(`Cannot transition from final state ${currentState.toUpperCase()}`);
    }

    // Define valid transitions
    const validTransitions: Record<DollarState, DollarState[]> = {
      [DollarState.CREATED]: [DollarState.POOLED],
      [DollarState.POOLED]: [DollarState.IN_GAME],
      [DollarState.IN_GAME]: [DollarState.WON, DollarState.LOST],
      [DollarState.WON]: [DollarState.POOLED, DollarState.CASHED_OUT],
      [DollarState.LOST]: [], // Final state
      [DollarState.CASHED_OUT]: [] // Final state
    };

    if (!validTransitions[currentState].includes(newState)) {
      errors.push(`Invalid state transition from ${currentState.toUpperCase()} to ${newState.toUpperCase()}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Update pool tracking based on state changes
   */
  private updatePoolTracking(dollarId: string, state: DollarState): void {
    if (state === DollarState.POOLED) {
      this.pooledDollars.add(dollarId);
    } else {
      this.pooledDollars.delete(dollarId);
    }
  }

  /**
   * Get dollar by ID
   */
  getDollar(dollarId: string): VirtualDollar | null {
    return this.dollars.get(dollarId) || null;
  }

  /**
   * Get dollar by serial number
   */
  getDollarBySerial(serialNumber: string): VirtualDollar | null {
    for (const dollar of Array.from(this.dollars.values())) {
      if (dollar.serialNumber === serialNumber) {
        return dollar;
      }
    }
    return null;
  }

  /**
   * Get all dollars owned by a specific player
   */
  getDollarsByPlayer(playerId: string): VirtualDollar[] {
    const playerDollarIds = this.dollarsByPlayer.get(playerId) || new Set();
    const dollars: VirtualDollar[] = [];
    
    for (const dollarId of Array.from(playerDollarIds)) {
      const dollar = this.dollars.get(dollarId);
      if (dollar) {
        dollars.push(dollar);
      }
    }
    
    return dollars;
  }

  /**
   * Get all pooled dollars ready for matching
   */
  getPooledDollars(): VirtualDollar[] {
    const pooled: VirtualDollar[] = [];
    
    for (const dollarId of Array.from(this.pooledDollars)) {
      const dollar = this.dollars.get(dollarId);
      if (dollar && dollar.state === DollarState.POOLED) {
        pooled.push(dollar);
      }
    }
    
    return pooled;
  }

  /**
   * Create multiple virtual dollars in batch for efficiency
   */
  createBatchVirtualDollars(playerIds: string[]): VirtualDollar[] {
    const dollars: VirtualDollar[] = [];
    
    for (const playerId of playerIds) {
      try {
        const dollar = this.createVirtualDollar(playerId);
        dollars.push(dollar);
      } catch (error) {
        // Continue with other players if one fails
        console.error(`Failed to create virtual dollar for player ${playerId}:`, error);
      }
    }
    
    return dollars;
  }

  /**
   * Get state history for a specific dollar
   */
  getDollarStateHistory(dollarId: string): StateTransition[] {
    return this.stateHistory.get(dollarId) || [];
  }

  /**
   * Get pool statistics
   */
  getPoolStatistics(): PoolStatistics {
    let pooledDollars = 0;
    let inGameDollars = 0;
    let completedDollars = 0;

    for (const dollar of Array.from(this.dollars.values())) {
      switch (dollar.state) {
        case DollarState.POOLED:
          pooledDollars++;
          break;
        case DollarState.IN_GAME:
          inGameDollars++;
          break;
        case DollarState.CASHED_OUT:
        case DollarState.LOST:
          completedDollars++;
          break;
      }
    }

    return {
      totalDollars: this.dollars.size,
      pooledDollars,
      inGameDollars,
      completedDollars
    };
  }

  /**
   * Update run-specific data after a game
   */
  updateRunData(dollarId: string, winnings: number): ValidationResult {
    const dollar = this.dollars.get(dollarId);
    
    if (!dollar) {
      return {
        isValid: false,
        errors: [`Dollar with ID ${dollarId} not found`],
        warnings: []
      };
    }

    // Increment games in this run
    dollar.gamesInThisRun++;
    
    // Update current run winnings (potential cash-out amount)
    dollar.currentRunWinnings = winnings;

    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }

  /**
   * Get dollar by run ID
   */
  getDollarByRunId(runId: string): VirtualDollar | null {
    for (const dollar of Array.from(this.dollars.values())) {
      if (dollar.runId === runId) {
        return dollar;
      }
    }
    return null;
  }

  /**
   * Get all active runs for a player
   */
  getActiveRunsByPlayer(playerId: string): VirtualDollar[] {
    const playerDollars = this.getDollarsByPlayer(playerId);
    return playerDollars.filter(dollar => 
      dollar.state !== DollarState.CASHED_OUT && 
      dollar.state !== DollarState.LOST
    );
  }

  /**
   * Get completed runs for a player
   */
  getCompletedRunsByPlayer(playerId: string): VirtualDollar[] {
    const playerDollars = this.getDollarsByPlayer(playerId);
    return playerDollars.filter(dollar => 
      dollar.state === DollarState.CASHED_OUT || 
      dollar.state === DollarState.LOST
    );
  }

  /**
   * Release a virtual dollar back to the object pool when no longer needed
   * Should be called when a dollar reaches a final state and won't be accessed again
   */
  releaseDollar(dollarId: string): void {
    const dollar = this.dollars.get(dollarId);
    if (!dollar) {
      return;
    }

    // Only release dollars in final states
    if (dollar.state === DollarState.CASHED_OUT || dollar.state === DollarState.LOST) {
      // Remove from tracking structures
      this.dollars.delete(dollarId);
      this.serialNumbers.delete(dollar.serialNumber);
      this.pooledDollars.delete(dollarId);
      this.stateHistory.delete(dollarId);
      
      // Remove from player tracking
      const playerDollars = this.dollarsByPlayer.get(dollar.ownerId);
      if (playerDollars) {
        playerDollars.delete(dollarId);
        if (playerDollars.size === 0) {
          this.dollarsByPlayer.delete(dollar.ownerId);
        }
      }

      // Return to object pool only if pooling is enabled
      if (isObjectPoolingEnabled()) {
        const poolManager = getObjectPoolManager();
        poolManager.virtualDollarPool.release(dollar);
      }
    }
  }

  /**
   * Cleanup completed dollars to free memory - batch release to pool
   * This should be called periodically during long simulations
   */
  cleanupCompletedDollars(): number {
    const completedDollars: string[] = [];
    
    // Find all dollars in final states
    for (const [dollarId, dollar] of this.dollars) {
      if (dollar.state === DollarState.CASHED_OUT || dollar.state === DollarState.LOST) {
        completedDollars.push(dollarId);
      }
    }

    // Release them to the pool
    completedDollars.forEach(dollarId => this.releaseDollar(dollarId));
    
    return completedDollars.length;
  }
}

// Export interfaces and types used by VirtualDollarManager
export { VirtualDollar, DollarState, GameSession, BettingLevel, ValidationResult };