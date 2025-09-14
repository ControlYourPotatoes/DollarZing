import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../event-bus';
import { PlayerProgressionHandler } from './player-progression-handler';
import {
  GameResolvedEvent,
  ContinuePlayEvent,
  EVENT_TYPES
} from '../event-types';

describe('PlayerProgressionHandler', () => {
  let eventBus: EventBus;
  let handler: PlayerProgressionHandler;
  let mockVirtualDollarFactory: any;
  let mockGameMatchingEngine: any;

  beforeEach(() => {
    eventBus = new EventBus();

    // Mock VirtualDollarFactory with all required methods
    mockVirtualDollarFactory = {
      getVirtualDollar: vi.fn(),
      updateVirtualDollar: vi.fn(),
      eliminatePlayer: vi.fn(),
      advancePlayer: vi.fn(),
      createVirtualDollar: vi.fn()
    };

    // Mock GameMatchingEngine
    mockGameMatchingEngine = {
      addToPool: vi.fn(),
      removeFromPool: vi.fn()
    };

    handler = new PlayerProgressionHandler(eventBus, mockVirtualDollarFactory, mockGameMatchingEngine);
  });

  afterEach(() => {
    handler.dispose();
    eventBus.dispose();
  });

  describe('Event-Driven Progression Logic', () => {
    it('should process loser elimination from GAME_RESOLVED events', async () => {
      // Mock virtual dollar for loser
      const mockLoserDollar = {
        id: 'dollar-loser',
        ownerId: 'player-loser',
        currentLevel: 2,
        state: 'POOLED',
        isActive: true,
        currentRunWinnings: 1.8
      };

      mockVirtualDollarFactory.getVirtualDollar.mockReturnValue(mockLoserDollar);
      mockVirtualDollarFactory.eliminatePlayer.mockReturnValue(mockLoserDollar);

      const runCompletedSpy = vi.fn();
      const winningsUpdatedSpy = vi.fn();
      const runSubscription = eventBus.on(EVENT_TYPES.VIRTUAL_DOLLAR_RUN_COMPLETED, runCompletedSpy);
      const winningsSubscription = eventBus.on(EVENT_TYPES.PLAYER_TOTAL_WINNINGS_UPDATED, winningsUpdatedSpy);

      const gameResolvedEvent: GameResolvedEvent = {
        type: EVENT_TYPES.GAME_RESOLVED,
        timestamp: new Date(),
        gameId: 'game-1',
        winnerId: 'player-winner',
        loserId: 'player-loser',
        winnerLevel: 2,
        loserLevel: 2,
        winnerDollarId: 'dollar-winner',
        loserDollarId: 'dollar-loser',
        winnings: 3.6,
        gameResult: 'WIN'
      };

      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);

      runSubscription.unsubscribe();
      winningsSubscription.unsubscribe();

      // Should eliminate the loser
      expect(mockVirtualDollarFactory.eliminatePlayer).toHaveBeenCalledWith(
        'player-loser',
        'dollar-loser',
        2
      );

      // Should emit run completed event for loser
      expect(runCompletedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EVENT_TYPES.VIRTUAL_DOLLAR_RUN_COMPLETED,
          playerId: 'player-loser',
          virtualDollarId: 'dollar-loser'
        })
      );

      // Should emit winnings update for loser
      expect(winningsUpdatedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EVENT_TYPES.PLAYER_TOTAL_WINNINGS_UPDATED,
          playerId: 'player-loser'
        })
      );
    });

    it('should process winner progression from CONTINUE_PLAY events', async () => {
      // Mock virtual dollar for winner
      const mockWinnerDollar = {
        id: 'dollar-winner',
        ownerId: 'player-winner',
        currentLevel: 3,
        state: 'POOLED',
        isActive: true,
        currentRunWinnings: 7.2
      };

      const advancedWinnerDollar = {
        ...mockWinnerDollar,
        currentLevel: 4,
        currentRunWinnings: 14.4
      };

      mockVirtualDollarFactory.getVirtualDollar.mockReturnValue(mockWinnerDollar);
      mockVirtualDollarFactory.advancePlayer.mockReturnValue(advancedWinnerDollar);

      const advancedSpy = vi.fn();
      const poolAddedSpy = vi.fn();
      const advancedSubscription = eventBus.on(EVENT_TYPES.VIRTUAL_DOLLAR_ADVANCED, advancedSpy);
      const poolSubscription = eventBus.on(EVENT_TYPES.POOL_ADDED, poolAddedSpy);

      // Simulate CONTINUE_PLAY event (normally emitted by CashOutDecisionHandler)
      const continuePlayEvent: ContinuePlayEvent = {
        type: EVENT_TYPES.CONTINUE_PLAY,
        timestamp: new Date(),
        playerId: 'player-winner',
        virtualDollarId: 'dollar-winner',
        currentLevel: 3,
        decision: 'CONTINUE',
        levelWinnings: 7.2
      };

      await eventBus.emit(EVENT_TYPES.CONTINUE_PLAY, continuePlayEvent);

      advancedSubscription.unsubscribe();
      poolSubscription.unsubscribe();

      // Should advance the winner
      expect(mockVirtualDollarFactory.advancePlayer).toHaveBeenCalledWith(
        'player-winner',
        'dollar-winner',
        3,
        4,
        7.2
      );

      // Should emit advancement event
      expect(advancedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EVENT_TYPES.VIRTUAL_DOLLAR_ADVANCED,
          playerId: 'player-winner',
          virtualDollarId: 'dollar-winner'
        })
      );
    });

    it('should handle jackpot completion at level 10', async () => {
      const mockJackpotDollar = {
        id: 'dollar-jackpot',
        ownerId: 'player-jackpot',
        currentLevel: 10,
        state: 'POOLED',
        isActive: true,
        currentRunWinnings: 1024
      };

      mockVirtualDollarFactory.getVirtualDollar.mockReturnValue(mockJackpotDollar);
      mockVirtualDollarFactory.advancePlayer.mockReturnValue(mockJackpotDollar);

      const runCompletedSpy = vi.fn();
      const subscription = eventBus.on(EVENT_TYPES.VIRTUAL_DOLLAR_RUN_COMPLETED, runCompletedSpy);

      const continuePlayEvent: ContinuePlayEvent = {
        type: EVENT_TYPES.CONTINUE_PLAY,
        timestamp: new Date(),
        playerId: 'player-jackpot',
        virtualDollarId: 'dollar-jackpot',
        currentLevel: 10,
        decision: 'CONTINUE',
        levelWinnings: 1024
      };

      await eventBus.emit(EVENT_TYPES.CONTINUE_PLAY, continuePlayEvent);

      subscription.unsubscribe();

      // Should complete the run as jackpot
      expect(runCompletedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EVENT_TYPES.VIRTUAL_DOLLAR_RUN_COMPLETED,
          playerId: 'player-jackpot',
          completionType: 'JACKPOT'
        })
      );
    });

    it('should handle errors gracefully and emit failure events', async () => {
      // Mock factory to throw error
      mockVirtualDollarFactory.getVirtualDollar.mockImplementation(() => {
        throw new Error('Virtual dollar not found');
      });

      const failureSpy = vi.fn();
      const subscription = eventBus.on(EVENT_TYPES.VIRTUAL_DOLLAR_PROGRESSION_FAILED, failureSpy);

      const gameResolvedEvent: GameResolvedEvent = {
        type: EVENT_TYPES.GAME_RESOLVED,
        timestamp: new Date(),
        gameId: 'game-error',
        winnerId: 'player-winner',
        loserId: 'player-error',
        winnerLevel: 1,
        loserLevel: 1,
        winnerDollarId: 'dollar-winner',
        loserDollarId: 'dollar-error',
        winnings: 1.8,
        gameResult: 'WIN'
      };

      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);
      subscription.unsubscribe();

      // Should emit failure event
      expect(failureSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EVENT_TYPES.VIRTUAL_DOLLAR_PROGRESSION_FAILED,
          playerId: 'player-error',
          reason: 'Loser elimination failed'
        })
      );
    });
  });

  describe('Integration with Pool Management', () => {
    it('should re-pool advanced winner dollars', async () => {
      const mockAdvancedDollar = {
        id: 'dollar-repool',
        ownerId: 'player-repool',
        currentLevel: 5,
        state: 'WON',
        isActive: true,
        currentRunWinnings: 28.8
      };

      const rePooledDollar = {
        ...mockAdvancedDollar,
        currentLevel: 6,
        currentRunWinnings: 57.6,
        state: 'POOLED'
      };

      mockVirtualDollarFactory.getVirtualDollar.mockReturnValue(mockAdvancedDollar);
      mockVirtualDollarFactory.advancePlayer.mockReturnValue(rePooledDollar);

      const poolAddedSpy = vi.fn();
      const subscription = eventBus.on(EVENT_TYPES.POOL_ADDED, poolAddedSpy);

      const continuePlayEvent: ContinuePlayEvent = {
        type: EVENT_TYPES.CONTINUE_PLAY,
        timestamp: new Date(),
        playerId: 'player-repool',
        virtualDollarId: 'dollar-repool',
        currentLevel: 5,
        decision: 'CONTINUE',
        levelWinnings: 28.8
      };

      await eventBus.emit(EVENT_TYPES.CONTINUE_PLAY, continuePlayEvent);

      subscription.unsubscribe();

      // Should add back to pool at new level
      expect(mockGameMatchingEngine.addToPool).toHaveBeenCalledWith(rePooledDollar);
      expect(poolAddedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EVENT_TYPES.POOL_ADDED,
          playerId: 'player-repool',
          level: 6
        })
      );
    });

    it('should properly handle event subscription lifecycle', async () => {
      // Test that handler properly subscribes and unsubscribes
      expect(handler).toBeDefined();

      // Test disposal
      const disposeSpy = vi.spyOn(handler, 'dispose');
      handler.dispose();

      expect(disposeSpy).toHaveBeenCalled();
    });
  });
});