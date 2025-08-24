import { GameMatchingEngine, GameEvent } from '../src/types/game-matching-engine';
import { VirtualDollarManager, VirtualDollar, DollarState } from '../src/types/virtual-dollar-types';
import { ScoringEngine } from '../src/types/scoring-engine';
import { BettingLevel } from '../src/types/virtual-dollar-engine';

describe('GameMatchingEngine', () => {
  let gameMatchingEngine: GameMatchingEngine;
  let virtualDollarManager: VirtualDollarManager;
  let scoringEngine: ScoringEngine;

  beforeEach(() => {
    virtualDollarManager = new VirtualDollarManager();
    scoringEngine = new ScoringEngine();
    gameMatchingEngine = new GameMatchingEngine(virtualDollarManager, scoringEngine);
  });

  describe('Virtual Dollar Pool Management', () => {
    it('should add virtual dollar to matching pool', () => {
      const dollar = virtualDollarManager.createVirtualDollar('player1');
      virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);

      const result = gameMatchingEngine.addToPool(dollar);
      expect(result.success).toBe(true);

      const poolStats = gameMatchingEngine.getPoolStatistics();
      expect(poolStats.totalDollarsInPool).toBe(1);
      expect(poolStats.availableForMatching).toBe(1);
    });

    it('should remove virtual dollar from matching pool', () => {
      const dollar = virtualDollarManager.createVirtualDollar('player1');
      virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
      
      gameMatchingEngine.addToPool(dollar);
      expect(gameMatchingEngine.getPoolStatistics().totalDollarsInPool).toBe(1);

      const result = gameMatchingEngine.removeFromPool(dollar.id);
      expect(result.success).toBe(true);
      expect(gameMatchingEngine.getPoolStatistics().totalDollarsInPool).toBe(0);
    });

    it('should only allow pooled dollars to be added to matching pool', () => {
      const dollar = virtualDollarManager.createVirtualDollar('player1');
      // Don't change state - remains CREATED

      const result = gameMatchingEngine.addToPool(dollar);
      expect(result.success).toBe(false);
      expect(result.error).toContain('only POOLED dollars can be added');
    });

    it('should prevent duplicate additions to pool', () => {
      const dollar = virtualDollarManager.createVirtualDollar('player1');
      virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);

      gameMatchingEngine.addToPool(dollar);
      const result = gameMatchingEngine.removeFromPool(dollar.id);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already in pool');
    });

    it('should handle pool size limits gracefully', () => {
      // Create many dollars and add to pool
      const dollars: VirtualDollar[] = [];
      for (let i = 0; i < 1000; i++) {
        const dollar = virtualDollarManager.createVirtualDollar(`player${i}`);
        virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        dollars.push(dollar);
      }

      dollars.forEach(dollar => {
        const result = gameMatchingEngine.addToPool(dollar);
        expect(result.success).toBe(true);
      });

      expect(gameMatchingEngine.getPoolStatistics().totalDollarsInPool).toBe(1000);
    });

    it('should organize pool by betting levels efficiently', () => {
      const levels: BettingLevel[] = [1, 2, 3, 4, 5];
      
      levels.forEach(level => {
        for (let i = 0; i < 5; i++) {
          const dollar = virtualDollarManager.createVirtualDollar(`player${level}_${i}`);
          dollar.currentLevel = level;
          virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
          gameMatchingEngine.addToPool(dollar);
        }
      });

      const poolStats = gameMatchingEngine.getPoolStatistics();
      expect(poolStats.totalDollarsInPool).toBe(25);
      expect(poolStats.dollarsByLevel).toBeDefined();
      
      levels.forEach(level => {
        expect(poolStats.dollarsByLevel![level]).toBe(5);
      });
    });
  });

  describe('1v1 Matching Algorithm', () => {
    it('should match two available dollars at same level', () => {
      const dollar1 = virtualDollarManager.createVirtualDollar('player1');
      const dollar2 = virtualDollarManager.createVirtualDollar('player2');
      
      [dollar1, dollar2].forEach(dollar => {
        dollar.currentLevel = 3;
        virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });

      const matchResult = gameMatchingEngine.attemptMatching();
      expect(matchResult.matchesMade).toBe(1);
      expect(matchResult.gamesCreated).toHaveLength(1);

      const game = matchResult.gamesCreated[0];
      expect([dollar1.id, dollar2.id]).toContain(game.dollar1.id);
      expect([dollar1.id, dollar2.id]).toContain(game.dollar2.id);
      expect(game.dollar1.id).not.toBe(game.dollar2.id);
    });

    it('should not match dollars at different levels', () => {
      const dollar1 = virtualDollarManager.createVirtualDollar('player1');
      const dollar2 = virtualDollarManager.createVirtualDollar('player2');
      
      dollar1.currentLevel = 3;
      dollar2.currentLevel = 4;
      
      [dollar1, dollar2].forEach(dollar => {
        virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });

      const matchResult = gameMatchingEngine.attemptMatching();
      expect(matchResult.matchesMade).toBe(0);
      expect(matchResult.gamesCreated).toHaveLength(0);
    });

    it('should prioritize longest-waiting dollars for matching', () => {
      const dollars: VirtualDollar[] = [];
      
      // Create 4 dollars at level 1, added with delays
      for (let i = 0; i < 4; i++) {
        const dollar = virtualDollarManager.createVirtualDollar(`player${i}`);
        dollar.currentLevel = 1;
        virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
        dollars.push(dollar);
      }

      const matchResult = gameMatchingEngine.attemptMatching();
      expect(matchResult.matchesMade).toBe(2); // 4 dollars = 2 games

      // Verify oldest dollars were matched first
      const game1 = matchResult.gamesCreated[0];
      expect([dollars[0].id, dollars[1].id]).toContain(game1.dollar1.id);
      expect([dollars[0].id, dollars[1].id]).toContain(game1.dollar2.id);
    });

    it('should handle odd number of dollars gracefully', () => {
      // Add 3 dollars at same level
      for (let i = 0; i < 3; i++) {
        const dollar = virtualDollarManager.createVirtualDollar(`player${i}`);
        dollar.currentLevel = 2;
        virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      }

      const matchResult = gameMatchingEngine.attemptMatching();
      expect(matchResult.matchesMade).toBe(1); // Only 1 match from 3 dollars
      expect(gameMatchingEngine.getPoolStatistics().availableForMatching).toBe(1); // 1 left over
    });

    it('should respect maximum concurrent games limit', () => {
      const maxConcurrent = 2;
      gameMatchingEngine.setMaxConcurrentGames(maxConcurrent);

      // Add 10 dollars at same level
      for (let i = 0; i < 10; i++) {
        const dollar = virtualDollarManager.createVirtualDollar(`player${i}`);
        dollar.currentLevel = 1;
        virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      }

      const matchResult = gameMatchingEngine.attemptMatching();
      expect(matchResult.matchesMade).toBeLessThanOrEqual(maxConcurrent);
    });
  });

  describe('Game Resolution using Algorithmic Scores', () => {
    it('should resolve game using scoring engine', () => {
      const dollar1 = virtualDollarManager.createVirtualDollar('player1');
      const dollar2 = virtualDollarManager.createVirtualDollar('player2');
      const dailySeed = '2025-08-21';

      [dollar1, dollar2].forEach(dollar => {
        dollar.currentLevel = 1;
        virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });

      const matchResult = gameMatchingEngine.attemptMatching();
      expect(matchResult.gamesCreated).toHaveLength(1);

      const game = matchResult.gamesCreated[0];
      const gameResult = gameMatchingEngine.resolveGame(game.id, dailySeed);
      
      expect(gameResult.success).toBe(true);
      expect(gameResult.winner).toBeDefined();
      expect(gameResult.loser).toBeDefined();
      expect([dollar1.serialNumber, dollar2.serialNumber]).toContain(gameResult.winner!.serialNumber);
      expect([dollar1.serialNumber, dollar2.serialNumber]).toContain(gameResult.loser!.serialNumber);
      expect(gameResult.winner!.serialNumber).not.toBe(gameResult.loser!.serialNumber);
    });

    it('should update dollar states after game resolution', () => {
      const dollar1 = virtualDollarManager.createVirtualDollar('player1');
      const dollar2 = virtualDollarManager.createVirtualDollar('player2');
      const dailySeed = '2025-08-21';

      [dollar1, dollar2].forEach(dollar => {
        dollar.currentLevel = 1;
        virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });

      const matchResult = gameMatchingEngine.attemptMatching();
      const game = matchResult.gamesCreated[0];
      const gameResult = gameMatchingEngine.resolveGame(game.id, dailySeed);

      // Check that winner is marked as WON and loser as LOST
      const winnerDollar = virtualDollarManager.getDollar(gameResult.winner!.id);
      const loserDollar = virtualDollarManager.getDollar(gameResult.loser!.id);

      expect(winnerDollar?.state).toBe(DollarState.WON);
      expect(loserDollar?.state).toBe(DollarState.LOST);
    });

    it('should calculate correct winnings for betting level', () => {
      const testLevels: BettingLevel[] = [1, 2, 3, 4, 5];

      testLevels.forEach(level => {
        const dollar1 = virtualDollarManager.createVirtualDollar(`player1_${level}`);
        const dollar2 = virtualDollarManager.createVirtualDollar(`player2_${level}`);

        [dollar1, dollar2].forEach(dollar => {
          dollar.currentLevel = level;
          virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
          gameMatchingEngine.addToPool(dollar);
        });

        const matchResult = gameMatchingEngine.attemptMatching();
        const game = matchResult.gamesCreated[0];
        gameMatchingEngine.resolveGame(game.id, '2025-08-21');

        // Verify winnings match betting level value
        const expectedWinnings = Math.pow(2, level - 1); // $1, $2, $4, $8, $16...
        expect(gameResult.winnings).toBe(expectedWinnings);
      });
    });

    it('should handle score ties deterministically', () => {
      // Mock identical serial numbers to force tie scenario
      const dollar1 = virtualDollarManager.createVirtualDollar('player1');
      const dollar2 = virtualDollarManager.createVirtualDollar('player2');
      dollar2.serialNumber = dollar1.serialNumber; // Force same serial

      [dollar1, dollar2].forEach(dollar => {
        dollar.currentLevel = 1;
        virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });

      const matchResult = gameMatchingEngine.attemptMatching();
      const game = matchResult.gamesCreated[0];
      
      // Resolve multiple times - should be deterministic
      const results = Array.from({ length: 5 }, () => 
        gameMatchingEngine.resolveGame(game.id, '2025-08-21')
      );

      const firstResult = results[0];
      results.forEach(result => {
        expect(result.winner?.id).toBe(firstResult.winner?.id);
        expect(result.loser?.id).toBe(firstResult.loser?.id);
      });
    });
  });

  describe('Concurrent Game Handling', () => {
    it('should handle multiple concurrent games without conflicts', async () => {
      // Create 10 dollars for 5 concurrent games
      const dollars: VirtualDollar[] = [];
      for (let i = 0; i < 10; i++) {
        const dollar = virtualDollarManager.createVirtualDollar(`player${i}`);
        dollar.currentLevel = 1;
        virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
        dollars.push(dollar);
      }

      const matchResult = gameMatchingEngine.attemptMatching();
      expect(matchResult.gamesCreated).toHaveLength(5);

      // Resolve all games concurrently
      const resolutionPromises = matchResult.gamesCreated.map(game => 
        Promise.resolve(gameMatchingEngine.resolveGame(game.id, '2025-08-21'))
      );

      const results = await Promise.all(resolutionPromises);

      // Verify all resolutions succeeded
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.winner).toBeDefined();
        expect(result.loser).toBeDefined();
      });

      // Verify no state conflicts
      const allWinnerIds = results.map(r => r.winner!.id);
      const allLoserIds = results.map(r => r.loser!.id);
      expect(new Set([...allWinnerIds, ...allLoserIds]).size).toBe(10); // All unique
    });

    it('should maintain thread safety during rapid matching attempts', () => {
      // Add dollars continuously while matching
      for (let round = 0; round < 5; round++) {
        // Add 4 new dollars
        for (let i = 0; i < 4; i++) {
          const dollar = virtualDollarManager.createVirtualDollar(`player${round}_${i}`);
          dollar.currentLevel = 1;
          virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
          gameMatchingEngine.addToPool(dollar);
        }

        // Attempt matching
        const matchResult = gameMatchingEngine.attemptMatching();
        
        // Resolve any created games
        matchResult.gamesCreated.forEach(game => {
          gameMatchingEngine.resolveGame(game.id, '2025-08-21');
        });
      }

      // Verify final state is consistent
      const poolStats = gameMatchingEngine.getPoolStatistics();
      expect(poolStats.totalGamesCompleted).toBeGreaterThan(0);
    });

    it('should prevent same dollar from participating in multiple concurrent games', () => {
      const dollar = virtualDollarManager.createVirtualDollar('player1');
      dollar.currentLevel = 1;
      virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
      gameMatchingEngine.addToPool(dollar);

      // Try to add same dollar again
      const result = gameMatchingEngine.addToPool(dollar);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already in pool');
    });
  });

  describe('Game Session Creation and Data Integrity', () => {
    it('should create complete game session with all required data', () => {
      const dollar1 = virtualDollarManager.createVirtualDollar('player1');
      const dollar2 = virtualDollarManager.createVirtualDollar('player2');

      [dollar1, dollar2].forEach(dollar => {
        dollar.currentLevel = 2;
        virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });

      const matchResult = gameMatchingEngine.attemptMatching();
      const game = matchResult.gamesCreated[0];

      expect(game.id).toBeDefined();
      expect(game.dollar1).toBeDefined();
      expect(game.dollar2).toBeDefined();
      expect(game.level).toBe(2);
      expect(game.platformFee).toBe(0.20); // 20c
      expect(game.timestamp).toBeInstanceOf(Date);
      expect(game.gameNumber).toBeGreaterThan(0);
    });

    it('should maintain referential integrity in game sessions', () => {
      const dollar1 = virtualDollarManager.createVirtualDollar('player1');
      const dollar2 = virtualDollarManager.createVirtualDollar('player2');

      [dollar1, dollar2].forEach(dollar => {
        dollar.currentLevel = 1;
        virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });

      const matchResult = gameMatchingEngine.attemptMatching();
      const game = matchResult.gamesCreated[0];
      gameMatchingEngine.resolveGame(game.id, '2025-08-21');

      // Verify game session has complete data
      const completedGame = gameMatchingEngine.getGameSession(game.id);
      expect(completedGame).toBeDefined();
      expect(completedGame!.winner).toBeDefined();
      expect(completedGame!.loser).toBeDefined();
      expect(completedGame!.dailySeed).toBe('2025-08-21');
      expect(completedGame!.dollar1Score).toBeGreaterThanOrEqual(0);
      expect(completedGame!.dollar2Score).toBeGreaterThanOrEqual(0);
    });

    it('should assign sequential game numbers', () => {
      const gameNumbers: number[] = [];

      // Create multiple games
      for (let i = 0; i < 3; i++) {
        const dollar1 = virtualDollarManager.createVirtualDollar(`player1_${i}`);
        const dollar2 = virtualDollarManager.createVirtualDollar(`player2_${i}`);

        [dollar1, dollar2].forEach(dollar => {
          dollar.currentLevel = 1;
          virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
          gameMatchingEngine.addToPool(dollar);
        });

        const matchResult = gameMatchingEngine.attemptMatching();
        if (matchResult.gamesCreated.length > 0) {
          gameNumbers.push(matchResult.gamesCreated[0].gameNumber);
        }
      }

      // Verify sequential numbering
      expect(gameNumbers).toHaveLength(3);
      expect(gameNumbers[1]).toBe(gameNumbers[0] + 1);
      expect(gameNumbers[2]).toBe(gameNumbers[1] + 1);
    });

    it('should update dollar game history after resolution', () => {
      const dollar1 = virtualDollarManager.createVirtualDollar('player1');
      const dollar2 = virtualDollarManager.createVirtualDollar('player2');

      [dollar1, dollar2].forEach(dollar => {
        dollar.currentLevel = 1;
        virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });

      const matchResult = gameMatchingEngine.attemptMatching();
      const game = matchResult.gamesCreated[0];
      gameMatchingEngine.resolveGame(game.id, '2025-08-21');

      // Check that dollar histories are updated
      const updatedDollar1 = virtualDollarManager.getDollar(dollar1.id);
      const updatedDollar2 = virtualDollarManager.getDollar(dollar2.id);

      expect(updatedDollar1!.gameHistory).toContain(game);
      expect(updatedDollar2!.gameHistory).toContain(game);
      expect(updatedDollar1!.totalGamesPlayed).toBe(1);
      expect(updatedDollar2!.totalGamesPlayed).toBe(1);
    });
  });

  describe('Game Event System', () => {
    it('should emit events during game lifecycle', () => {
      const events: GameEvent[] = [];
      
      gameMatchingEngine.on('gameCreated', (event: GameEvent) => events.push(event));
      gameMatchingEngine.on('gameResolved', (event: GameEvent) => events.push(event));

      const dollar1 = virtualDollarManager.createVirtualDollar('player1');
      const dollar2 = virtualDollarManager.createVirtualDollar('player2');

      [dollar1, dollar2].forEach(dollar => {
        dollar.currentLevel = 1;
        virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });

      const matchResult = gameMatchingEngine.attemptMatching();
      const game = matchResult.gamesCreated[0];
      gameMatchingEngine.resolveGame(game.id, '2025-08-21');

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('gameCreated');
      expect(events[1].type).toBe('gameResolved');
      expect(events[0].gameId).toBe(game.id);
      expect(events[1].gameId).toBe(game.id);
    });

    it('should provide detailed event data for analytics', () => {
      let gameCreatedEvent: GameEvent | null = null;
      let gameResolvedEvent: GameEvent | null = null;

      gameMatchingEngine.on('gameCreated', (event: GameEvent) => {
        gameCreatedEvent = event;
      });

      gameMatchingEngine.on('gameResolved', (event: GameEvent) => {
        gameResolvedEvent = event;
      });

      const dollar1 = virtualDollarManager.createVirtualDollar('player1');
      const dollar2 = virtualDollarManager.createVirtualDollar('player2');

      [dollar1, dollar2].forEach(dollar => {
        dollar.currentLevel = 3;
        virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });

      const matchResult = gameMatchingEngine.attemptMatching();
      const game = matchResult.gamesCreated[0];
      gameMatchingEngine.resolveGame(game.id, '2025-08-21');

      // Verify gameCreated event
      expect(gameCreatedEvent).not.toBeNull();
      expect(gameCreatedEvent!.gameId).toBe(game.id);
      expect(gameCreatedEvent!.level).toBe(3);
      expect(gameCreatedEvent!.timestamp).toBeInstanceOf(Date);

      // Verify gameResolved event
      expect(gameResolvedEvent).not.toBeNull();
      expect(gameResolvedEvent!.gameId).toBe(game.id);
      expect(gameResolvedEvent!.winnerId).toBeDefined();
      expect(gameResolvedEvent!.loserId).toBeDefined();
      expect(gameResolvedEvent!.winnings).toBe(8); // Level 3 = $8
    });
  });

  describe('Comprehensive Game Tracking and Audit Trail', () => {
    it('should maintain complete audit trail of all games', () => {
      // Create and resolve multiple games
      for (let i = 0; i < 3; i++) {
        const dollar1 = virtualDollarManager.createVirtualDollar(`player1_${i}`);
        const dollar2 = virtualDollarManager.createVirtualDollar(`player2_${i}`);

        [dollar1, dollar2].forEach(dollar => {
          dollar.currentLevel = 1;
          virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
          gameMatchingEngine.addToPool(dollar);
        });

        const matchResult = gameMatchingEngine.attemptMatching();
        matchResult.gamesCreated.forEach(game => {
          gameMatchingEngine.resolveGame(game.id, '2025-08-21');
        });
      }

      const auditTrail = gameMatchingEngine.getAuditTrail();
      expect(auditTrail.totalGames).toBe(3);
      expect(auditTrail.gameHistory).toHaveLength(3);
      
      auditTrail.gameHistory.forEach(game => {
        expect(game.winner).toBeDefined();
        expect(game.loser).toBeDefined();
        expect(game.dailySeed).toBe('2025-08-21');
      });
    });

    it('should provide detailed statistics for monitoring', () => {
      // Create games at different levels
      const levels: BettingLevel[] = [1, 2, 3];
      
      levels.forEach(level => {
        const dollar1 = virtualDollarManager.createVirtualDollar(`player1_${level}`);
        const dollar2 = virtualDollarManager.createVirtualDollar(`player2_${level}`);

        [dollar1, dollar2].forEach(dollar => {
          dollar.currentLevel = level;
          virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
          gameMatchingEngine.addToPool(dollar);
        });

        const matchResult = gameMatchingEngine.attemptMatching();
        matchResult.gamesCreated.forEach(game => {
          gameMatchingEngine.resolveGame(game.id, '2025-08-21');
        });
      });

      const statistics = gameMatchingEngine.getStatistics();
      expect(statistics.totalGamesPlayed).toBe(3);
      expect(statistics.gamesByLevel).toBeDefined();
      expect(statistics.gamesByLevel![1]).toBe(1);
      expect(statistics.gamesByLevel![2]).toBe(1);
      expect(statistics.gamesByLevel![3]).toBe(1);
      expect(statistics.totalPlatformFees).toBe(0.60); // 3 games × 20c
    });

    it('should support querying games by various criteria', () => {
      const testPlayerId = 'special-player';
      const testLevel: BettingLevel = 2;
      
      // Create specific game
      const dollar1 = virtualDollarManager.createVirtualDollar(testPlayerId);
      const dollar2 = virtualDollarManager.createVirtualDollar('other-player');

      [dollar1, dollar2].forEach(dollar => {
        dollar.currentLevel = testLevel;
        virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });

      const matchResult = gameMatchingEngine.attemptMatching();
      const game = matchResult.gamesCreated[0];
      gameMatchingEngine.resolveGame(game.id, '2025-08-21');

      // Query by player
      const playerGames = gameMatchingEngine.getGamesByPlayer(testPlayerId);
      expect(playerGames).toHaveLength(1);
      expect(playerGames[0].id).toBe(game.id);

      // Query by level
      const levelGames = gameMatchingEngine.getGamesByLevel(testLevel);
      expect(levelGames).toHaveLength(1);
      expect(levelGames[0].level).toBe(testLevel);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large pool sizes efficiently', () => {
      const startTime = Date.now();
      
      // Add 1000 dollars to pool
      for (let i = 0; i < 1000; i++) {
        const dollar = virtualDollarManager.createVirtualDollar(`player${i}`);
        dollar.currentLevel = 1;
        virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      }

      const addTime = Date.now() - startTime;
      expect(addTime).toBeLessThan(1000); // Should complete in under 1 second

      const matchStart = Date.now();
      const matchResult = gameMatchingEngine.attemptMatching();
      const matchTime = Date.now() - matchStart;
      
      expect(matchTime).toBeLessThan(500); // Matching should be fast
      expect(matchResult.matchesMade).toBe(500); // 1000 dollars = 500 games
    });

    it('should manage memory efficiently during long-running operations', () => {
      // Simulate extended operation
      for (let round = 0; round < 100; round++) {
        // Add dollars
        const dollar1 = virtualDollarManager.createVirtualDollar(`player1_${round}`);
        const dollar2 = virtualDollarManager.createVirtualDollar(`player2_${round}`);

        [dollar1, dollar2].forEach(dollar => {
          dollar.currentLevel = 1;
          virtualDollarManager.updateDollarState(dollar.id, DollarState.POOLED);
          gameMatchingEngine.addToPool(dollar);
        });

        // Match and resolve
        const matchResult = gameMatchingEngine.attemptMatching();
        matchResult.gamesCreated.forEach(game => {
          gameMatchingEngine.resolveGame(game.id, '2025-08-21');
        });
      }

      const statistics = gameMatchingEngine.getStatistics();
      expect(statistics.totalGamesPlayed).toBe(100);
      
      // Memory usage should be reasonable
      const poolStats = gameMatchingEngine.getPoolStatistics();
      expect(poolStats.totalDollarsInPool).toBe(0); // All should be resolved
    });
  });
});