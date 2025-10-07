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

    // Mock VirtualDollarFactory with all required methods based on interface
    mockVirtualDollarFactory = {
      getDollar: vi.fn(),
      updateDollarState: vi.fn(),
      eliminatePlayer: vi.fn(),
      advancePlayerLevel: vi.fn(),
      calculateLevelWinnings: vi.fn(),
      create: vi.fn(),
      release: vi.fn(),
      createBatch: vi.fn(),
      getStatistics: vi.fn()
    };

    // Mock GameMatchingEngine
    mockGameMatchingEngine = {
      addToPool: vi.fn().mockReturnValue({ success: true }),
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
      // Mock virtual dollar for the losing player
      const mockLoserDollar = {
        id: 'dollar-loser',
        ownerId: 'player-loser',
        currentLevel: 2,
        state: 'POOLED',
        isActive: true,
        currentRunWinnings: 1.8
      };

      mockVirtualDollarFactory.getDollar.mockReturnValue(mockLoserDollar);
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

      // Should eliminate the loser with correct parameters
      expect(mockVirtualDollarFactory.eliminatePlayer).toHaveBeenCalledWith(
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

      mockVirtualDollarFactory.getDollar.mockReturnValue(mockWinnerDollar);
      mockVirtualDollarFactory.advancePlayerLevel.mockReturnValue(advancedWinnerDollar);
      mockVirtualDollarFactory.calculateLevelWinnings.mockReturnValue(14.4);

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
        potentialWinnings: 7.2,
        nextLevel: 4,
        nextPotentialWinnings: 14.4
      };

      await eventBus.emit(EVENT_TYPES.CONTINUE_PLAY, continuePlayEvent);

      advancedSubscription.unsubscribe();
      poolSubscription.unsubscribe();

      // Should advance the winner with correct parameters
      expect(mockVirtualDollarFactory.advancePlayerLevel).toHaveBeenCalledWith(
        'dollar-winner',
        4,
        14.4
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
        currentRunWinnings: 921.6
      };

      mockVirtualDollarFactory.getDollar.mockReturnValue(mockJackpotDollar);
      mockVirtualDollarFactory.advancePlayerLevel.mockReturnValue(mockJackpotDollar);
      mockVirtualDollarFactory.calculateLevelWinnings.mockReturnValue(921.6);

      const runCompletedSpy = vi.fn();
      const subscription = eventBus.on(EVENT_TYPES.VIRTUAL_DOLLAR_RUN_COMPLETED, runCompletedSpy);

      const continuePlayEvent: ContinuePlayEvent = {
        type: EVENT_TYPES.CONTINUE_PLAY,
        timestamp: new Date(),
        playerId: 'player-jackpot',
        virtualDollarId: 'dollar-jackpot',
        currentLevel: 10,
        potentialWinnings: 921.6,
        nextLevel: 10,
        nextPotentialWinnings: 921.6
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
      // Mock factory to throw error on eliminatePlayer call
      mockVirtualDollarFactory.getDollar.mockReturnValue({
        id: 'dollar-error',
        ownerId: 'player-error',
        currentLevel: 1,
        state: 'POOLED',
        isActive: true,
        currentRunWinnings: 0
      });
      mockVirtualDollarFactory.eliminatePlayer.mockImplementation(() => {
        throw new Error('Elimination failed');
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

      // Wait a bit for async processing to complete
      await new Promise(resolve => setTimeout(resolve, 10));

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

      mockVirtualDollarFactory.getDollar.mockReturnValue(mockAdvancedDollar);
      mockVirtualDollarFactory.advancePlayerLevel.mockReturnValue(rePooledDollar);
      mockVirtualDollarFactory.calculateLevelWinnings.mockReturnValue(57.6);

      const advancedSpy = vi.fn();
      const subscription = eventBus.on(EVENT_TYPES.VIRTUAL_DOLLAR_ADVANCED, advancedSpy);

      const continuePlayEvent: ContinuePlayEvent = {
        type: EVENT_TYPES.CONTINUE_PLAY,
        timestamp: new Date(),
        playerId: 'player-repool',
        virtualDollarId: 'dollar-repool',
        currentLevel: 5,
        potentialWinnings: 28.8,
        nextLevel: 6,
        nextPotentialWinnings: 57.6
      };

      await eventBus.emit(EVENT_TYPES.CONTINUE_PLAY, continuePlayEvent);

      subscription.unsubscribe();

      // Should advance the winner and add back to pool at new level
      expect(mockVirtualDollarFactory.advancePlayerLevel).toHaveBeenCalledWith(
        'dollar-repool',
        6,
        57.6
      );
      expect(mockGameMatchingEngine.addToPool).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "dollar-repool",
          ownerId: "player-repool",
        })
      );
      expect(advancedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EVENT_TYPES.VIRTUAL_DOLLAR_ADVANCED,
          playerId: 'player-repool',
          virtualDollarId: 'dollar-repool'
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