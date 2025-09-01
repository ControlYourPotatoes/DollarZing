// GameMatchingEngine Implementation
// Handles virtual dollar pool management, 1v1 matching, and game resolution
// Provides event-driven architecture for game tracking and analytics

import { VirtualDollar, DollarState, VirtualDollarManager } from './virtual-dollar-types';
import { ScoringEngine, ScoreResult } from './scoring-engine';
import { GameSession, BettingLevel, PlayerBalanceManager } from './virtual-dollar-engine';
import { GameSessionFactory } from './factory-interfaces';

// Game event types for pub/sub system
export type GameEventType = 'gameCreated' | 'gameResolved' | 'poolUpdated' | 'matchingAttempted';

// Game event interface
export interface GameEvent {
  type: GameEventType;
  gameId?: string;
  timestamp: Date;
  level?: BettingLevel;
  winnerId?: string;
  loserId?: string;
  winnings?: number;
  poolSize?: number;
}

// Result of matching attempt
export interface GameMatchResult {
  matchesMade: number;
  gamesCreated: GameSession[];
  dollarsMatched: string[];
  timestamp: Date;
}

// Result of game resolution
export interface GameResolutionResult {
  success: boolean;
  gameId: string;
  winner?: VirtualDollar;
  loser?: VirtualDollar;
  winnings: number;
  error?: string;
}

// Pool management operation result
export interface PoolOperationResult {
  success: boolean;
  error?: string;
}

// Pool statistics interface
export interface PoolStatistics {
  totalDollarsInPool: number;
  availableForMatching: number;
  dollarsInGame: number;
  dollarsByLevel?: Record<BettingLevel, number>;
  totalGamesCompleted: number;
}

// Game statistics interface
export interface GameStatistics {
  totalGamesPlayed: number;
  gamesByLevel?: Record<BettingLevel, number>;
  totalPlatformFees: number;
  totalWinnings: number;
  averageGameDuration?: number;
}

// Audit trail interface
export interface AuditTrail {
  totalGames: number;
  gameHistory: GameSession[];
  lastUpdated: Date;
}

// Event listener function type
type EventListener = (event: GameEvent) => void;

/**
 * GameMatchingEngine - Core class for managing 1v1 game matching and resolution
 * Handles virtual dollar pool management, automatic matching, and game lifecycle
 */
export class GameMatchingEngine {
  private dollarManager: VirtualDollarManager;
  private scoringEngine: ScoringEngine;
  private gameSessionFactory: GameSessionFactory;
  private playerBalanceManager?: PlayerBalanceManager;
  
  // Pool management
  private pooledDollars: Map<string, VirtualDollar> = new Map();
  private dollarsByLevel: Map<BettingLevel, Set<string>> = new Map();
  private dollarsInGame: Set<string> = new Set();
  
  // Game management
  private activeGames: Map<string, GameSession> = new Map();
  private completedGames: Map<string, GameSession> = new Map();
  
  // Event system
  private eventListeners: Map<GameEventType, EventListener[]> = new Map();
  
  // Configuration
  private maxConcurrentGames: number = 1000;
  
  constructor(dollarManager: VirtualDollarManager, scoringEngine: ScoringEngine, gameSessionFactory: GameSessionFactory) {
    this.dollarManager = dollarManager;
    this.scoringEngine = scoringEngine;
    this.gameSessionFactory = gameSessionFactory;
    
    // Initialize level pools
    for (let level = 1; level <= 11; level++) {
      this.dollarsByLevel.set(level as BettingLevel, new Set());
    }
    
    // Initialize event listener maps
    const eventTypes: GameEventType[] = ['gameCreated', 'gameResolved', 'poolUpdated', 'matchingAttempted'];
    eventTypes.forEach(type => {
      this.eventListeners.set(type, []);
    });
  }

  /**
   * Add virtual dollar to matching pool
   */
  addToPool(dollar: VirtualDollar): PoolOperationResult {
    // Validate dollar state
    if (dollar.state !== DollarState.POOLED) {
      return {
        success: false,
        error: 'Only POOLED dollars can be added to matching pool'
      };
    }

    // Check for duplicates
    if (this.pooledDollars.has(dollar.id)) {
      return {
        success: false,
        error: 'Dollar already in pool'
      };
    }

    // Validate player balance if balance manager is available
    if (this.playerBalanceManager && !this.playerBalanceManager.canPlayerPlay(dollar.ownerId)) {
      return {
        success: false,
        error: 'Player does not have sufficient balance to play games'
      };
    }

    // Add to pool
    this.pooledDollars.set(dollar.id, dollar);
    
    // Add to level-specific pool
    const levelSet = this.dollarsByLevel.get(dollar.currentLevel);
    if (levelSet) {
      levelSet.add(dollar.id);
    }

    // Emit pool update event
    this.emit('poolUpdated', {
      type: 'poolUpdated',
      timestamp: new Date(),
      poolSize: this.pooledDollars.size
    });

    return { success: true };
  }

  /**
   * Remove virtual dollar from matching pool
   */
  removeFromPool(dollarId: string): PoolOperationResult {
    const dollar = this.pooledDollars.get(dollarId);
    if (!dollar) {
      return {
        success: false,
        error: 'Dollar not found in pool'
      };
    }

    // Remove from main pool
    this.pooledDollars.delete(dollarId);
    
    // Remove from level-specific pool
    const levelSet = this.dollarsByLevel.get(dollar.currentLevel);
    if (levelSet) {
      levelSet.delete(dollarId);
    }

    // Emit pool update event
    this.emit('poolUpdated', {
      type: 'poolUpdated',
      timestamp: new Date(),
      poolSize: this.pooledDollars.size
    });

    return { success: true };
  }

  /**
   * Attempt to match available dollars and create games
   */
  attemptMatching(): GameMatchResult {
    const matchedDollars: string[] = [];
    const gamesCreated: GameSession[] = [];
    const timestamp = new Date();

    // Check concurrent game limit
    if (this.activeGames.size >= this.maxConcurrentGames) {
      return {
        matchesMade: 0,
        gamesCreated: [],
        dollarsMatched: [],
        timestamp
      };
    }

    // Try to match at each level
    for (let level = 1; level <= 11; level++) {
      const bettingLevel = level as BettingLevel;
      const levelDollars = this.dollarsByLevel.get(bettingLevel);
      
      if (!levelDollars || levelDollars.size < 2) {
        continue; // Not enough dollars at this level
      }

      // Convert to array and sort by creation time (FIFO)
      const availableDollars = Array.from(levelDollars)
        .map(id => this.pooledDollars.get(id)!)
        .filter(dollar => dollar && !this.dollarsInGame.has(dollar.id))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      // Match pairs
      for (let i = 0; i < availableDollars.length - 1; i += 2) {
        if (this.activeGames.size >= this.maxConcurrentGames) {
          break; // Hit concurrent limit
        }

        const dollar1 = availableDollars[i];
        const dollar2 = availableDollars[i + 1];

        // Create game session
        const game = this.createGameSession(dollar1, dollar2, bettingLevel);
        
        // Mark dollars as in-game
        this.dollarsInGame.add(dollar1.id);
        this.dollarsInGame.add(dollar2.id);
        
        // Update dollar states
        this.dollarManager.updateDollarState(dollar1.id, DollarState.IN_GAME);
        this.dollarManager.updateDollarState(dollar2.id, DollarState.IN_GAME);
        
        // Remove from pool
        this.removeFromPool(dollar1.id);
        this.removeFromPool(dollar2.id);
        
        // Track active game
        this.activeGames.set(game.id, game);
        
        gamesCreated.push(game);
        matchedDollars.push(dollar1.id, dollar2.id);

        // Emit game created event
        this.emit('gameCreated', {
          type: 'gameCreated',
          gameId: game.id,
          timestamp: new Date(),
          level: bettingLevel
        });
      }
    }

    // Emit matching attempt event
    this.emit('matchingAttempted', {
      type: 'matchingAttempted',
      timestamp: new Date(),
      poolSize: this.pooledDollars.size
    });

    return {
      matchesMade: gamesCreated.length,
      gamesCreated,
      dollarsMatched: matchedDollars,
      timestamp
    };
  }

  /**
   * Create a new game session using injected factory
   */
  private createGameSession(dollar1: VirtualDollar, dollar2: VirtualDollar, level: BettingLevel): GameSession {
    try {
      return this.gameSessionFactory.create(dollar1, dollar2, level);
    } catch (error) {
      throw new Error(`Failed to create game session through factory: ${error}`);
    }
  }

  /**
   * Resolve a game using scoring engine and update states
   */
  resolveGame(gameId: string, dailySeed: string): GameResolutionResult {
    const game = this.activeGames.get(gameId);
    if (!game) {
      return {
        success: false,
        gameId,
        winnings: 0,
        error: 'Game not found or already resolved'
      };
    }

    try {
      // Get scores from scoring engine
      const scoreResult: ScoreResult = this.scoringEngine.compareScores(
        game.dollar1.serialNumber,
        game.dollar2.serialNumber,
        dailySeed
      );

      // Update game session with resolution data
      game.dailySeed = dailySeed;
      game.dollar1Score = scoreResult.winnerScore === game.dollar1Score ? 
        scoreResult.winnerScore : scoreResult.loserScore;
      game.dollar2Score = scoreResult.winnerScore === game.dollar2Score ? 
        scoreResult.winnerScore : scoreResult.loserScore;

      // Determine winner and loser
      let winner: VirtualDollar;
      let loser: VirtualDollar;

      if (scoreResult.winner === game.dollar1.serialNumber) {
        winner = game.dollar1;
        loser = game.dollar2;
        game.dollar1Score = scoreResult.winnerScore;
        game.dollar2Score = scoreResult.loserScore;
      } else {
        winner = game.dollar2;
        loser = game.dollar1;
        game.dollar1Score = scoreResult.loserScore;
        game.dollar2Score = scoreResult.winnerScore;
      }

      // Update game session
      game.winner = winner;
      game.loser = loser;

      // Implement winner-takes-all pot absorption logic (Task 2.3)
      winner.potValue += loser.potValue; // Winner absorbs loser's pot value
      loser.potValue = 0; // Loser loses all pot value

      // Process player balance transactions if balance manager is available
      if (this.playerBalanceManager) {
        // No game fees charged - Virtual Dollar Pool Engine handles all fees via pot system
        
        // Add winnings to winner's progression
        this.playerBalanceManager.addWinProgression(winner.ownerId, game.winnings);

        // Clear loser's progression
        this.playerBalanceManager.loseProgression(loser.ownerId);
      }

      // Update dollar states
      this.dollarManager.updateDollarState(winner.id, DollarState.WON);
      this.dollarManager.updateDollarState(loser.id, DollarState.LOST);

      // Update dollar game history and statistics
      winner.gameHistory.push(game);
      loser.gameHistory.push(game);
      winner.gamesInThisRun++;
      loser.gamesInThisRun++;
      winner.currentRunWinnings = game.winnings;
      // Note: loser loses their currentRunWinnings (already implied by LOST state)

      // Move game from active to completed
      this.activeGames.delete(gameId);
      this.completedGames.set(gameId, game);
      
      // Release game session back to factory
      try {
        this.gameSessionFactory.release(game);
      } catch (error) {
        console.warn(`Warning: Failed to release game session to factory: ${error}`);
        // Don't throw - release operations should be non-critical
      }
      
      // Remove from in-game tracking
      this.dollarsInGame.delete(winner.id);
      this.dollarsInGame.delete(loser.id);

      // Emit game resolved event
      this.emit('gameResolved', {
        type: 'gameResolved',
        gameId,
        timestamp: new Date(),
        winnerId: winner.id,
        loserId: loser.id,
        winnings: game.winnings,
        level: game.level
      });

      return {
        success: true,
        gameId,
        winner,
        loser,
        winnings: game.winnings
      };

    } catch (error) {
      return {
        success: false,
        gameId,
        winnings: 0,
        error: `Game resolution failed: ${error}`
      };
    }
  }

  /**
   * Get game session by ID
   */
  getGameSession(gameId: string): GameSession | null {
    return this.activeGames.get(gameId) || this.completedGames.get(gameId) || null;
  }

  /**
   * Get pool statistics
   */
  getPoolStatistics(): PoolStatistics {
    const dollarsByLevel: Record<BettingLevel, number> = {} as Record<BettingLevel, number>;
    
    for (let level = 1; level <= 11; level++) {
      const bettingLevel = level as BettingLevel;
      dollarsByLevel[bettingLevel] = this.dollarsByLevel.get(bettingLevel)?.size || 0;
    }

    return {
      totalDollarsInPool: this.pooledDollars.size + this.dollarsInGame.size,
      availableForMatching: this.pooledDollars.size,
      dollarsInGame: this.dollarsInGame.size,
      dollarsByLevel,
      totalGamesCompleted: this.completedGames.size
    };
  }

  /**
   * Get comprehensive game statistics
   */
  getStatistics(): GameStatistics {
    const gamesByLevel: Record<BettingLevel, number> = {} as Record<BettingLevel, number>;
    let totalPlatformFees = 0;
    let totalWinnings = 0;

    // Initialize level counts
    for (let level = 1; level <= 11; level++) {
      gamesByLevel[level as BettingLevel] = 0;
    }

    // Calculate statistics from completed games
    for (const game of Array.from(this.completedGames.values())) {
      gamesByLevel[game.level]++;
      totalPlatformFees += game.platformFee;
      totalWinnings += game.winnings;
    }

    return {
      totalGamesPlayed: this.completedGames.size,
      gamesByLevel,
      totalPlatformFees,
      totalWinnings
    };
  }

  /**
   * Get audit trail of all games
   */
  getAuditTrail(): AuditTrail {
    return {
      totalGames: this.completedGames.size,
      gameHistory: Array.from(this.completedGames.values()),
      lastUpdated: new Date()
    };
  }

  /**
   * Get games by player ID
   */
  getGamesByPlayer(playerId: string): GameSession[] {
    return Array.from(this.completedGames.values()).filter(game => 
      game.dollar1.ownerId === playerId || game.dollar2.ownerId === playerId
    );
  }

  /**
   * Get games by betting level
   */
  getGamesByLevel(level: BettingLevel): GameSession[] {
    return Array.from(this.completedGames.values()).filter(game => 
      game.level === level
    );
  }

  /**
   * Set maximum concurrent games
   */
  setMaxConcurrentGames(max: number): void {
    if (max < 1) {
      throw new Error('Maximum concurrent games must be at least 1');
    }
    this.maxConcurrentGames = max;
  }

  /**
   * Set PlayerBalanceManager for balance validation
   */
  setPlayerBalanceManager(balanceManager: PlayerBalanceManager): void {
    this.playerBalanceManager = balanceManager;
  }

  /**
   * Event system - add listener
   */
  on(eventType: GameEventType, listener: EventListener): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.push(listener);
    }
  }

  /**
   * Event system - remove listener
   */
  off(eventType: GameEventType, listener: EventListener): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Event system - emit event
   */
  private emit(eventType: GameEventType, event: GameEvent): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Clear all completed games (for memory management)
   */
  clearCompletedGames(): void {
    // Release all game sessions before clearing
    for (const game of Array.from(this.completedGames.values())) {
      try {
        this.gameSessionFactory.release(game);
      } catch (error) {
        console.warn(`Warning: Failed to release game session during cleanup: ${error}`);
      }
    }
    this.completedGames.clear();
  }

  /**
   * Get active game count
   */
  getActiveGameCount(): number {
    return this.activeGames.size;
  }

  /**
   * Get factory statistics for performance monitoring
   */
  getFactoryStatistics() {
    return this.gameSessionFactory.getStatistics();
  }
}