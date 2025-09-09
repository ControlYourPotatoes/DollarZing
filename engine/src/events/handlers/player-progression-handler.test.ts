import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../event-bus';
import { PlayerProgressionHandler } from './player-progression-handler';
import { 
  GameResolvedEvent, 
  EVENT_TYPES 
} from '../event-types';
import { CashOutStrategy } from '../../types/virtual-dollar-engine';

describe('PlayerProgressionHandler', () => {
  let eventBus: EventBus;
  let handler: PlayerProgressionHandler;
  let mockProgressionManager: any;

  beforeEach(() => {
    eventBus = new EventBus();
    
    // Mock ProgressionManager with progression logic
    mockProgressionManager = {
      processGameResult: vi.fn(),
      makeCashOutDecision: vi.fn(),
      processCashOut: vi.fn(),
      getRunState: vi.fn(),
      initializeRun: vi.fn(),
      getCurrentBet: vi.fn(),
      getPotentialWinnings: vi.fn()
    };

    handler = new PlayerProgressionHandler(eventBus, mockProgressionManager);
  });

  afterEach(() => {
    handler.dispose();
    eventBus.dispose();
  });

  describe('Level Advancement Logic', () => {
    it('should advance player from level 1 to level 2 after winning', async () => {
      // Mock progression state for level advancement
      mockProgressionManager.processGameResult.mockReturnValue({
        runId: 'run-1',
        currentLevel: 2,
        gamesWonInRun: 1,
        currentWinnings: 1.8, // level 1 × 1.8
        isComplete: false,
        completionReason: null,
        completedAt: null
      });

      mockProgressionManager.makeCashOutDecision.mockReturnValue('CONTINUE');

      const progressionSpy = vi.fn();
      const subscription = eventBus.on(EVENT_TYPES.PLAYER_ADVANCED, progressionSpy);

      const gameResolvedEvent: GameResolvedEvent = {
        type: 'GAME_RESOLVED',
        timestamp: new Date(),
        gameId: 'game-1',
        winnerId: 'player-1',
        loserId: 'player-2',
        winnerLevel: 1,
        loserLevel: 1,
        winnerDollarId: 'dollar-1',
        loserDollarId: 'dollar-2',
        winnings: 1.8,
        gameResult: 'WIN'
      };

      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);

      subscription.unsubscribe();

      expect(mockProgressionManager.processGameResult).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'dollar-1',
          ownerId: 'player-1',
          currentLevel: 1
        }),
        'win'
      );

      expect(progressionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PLAYER_ADVANCED',
          playerId: 'player-1',
          virtualDollarId: 'dollar-1',
          fromLevel: 1,
          toLevel: 2,
          totalWinnings: 1.8,
          gamesPlayed: 1
        })
      );
    });

    it('should handle progression through all 10 levels correctly', async () => {
      const testCases = [
        { fromLevel: 1, toLevel: 2, winnings: 1.8 },
        { fromLevel: 2, toLevel: 3, winnings: 3.6 },
        { fromLevel: 3, toLevel: 4, winnings: 7.2 },
        { fromLevel: 4, toLevel: 5, winnings: 14.4 },
        { fromLevel: 5, toLevel: 6, winnings: 28.8 },
        { fromLevel: 6, toLevel: 7, winnings: 57.6 },
        { fromLevel: 7, toLevel: 8, winnings: 115.2 },
        { fromLevel: 8, toLevel: 9, winnings: 230.4 },
        { fromLevel: 9, toLevel: 10, winnings: 460.8 }
      ];

      for (const testCase of testCases) {
        mockProgressionManager.processGameResult.mockReturnValue({
          runId: `run-${testCase.fromLevel}`,
          currentLevel: testCase.toLevel,
          gamesWonInRun: testCase.fromLevel,
          currentWinnings: testCase.winnings,
          isComplete: false,
          completionReason: null,
          completedAt: null
        });

        mockProgressionManager.makeCashOutDecision.mockReturnValue('CONTINUE');

        const progressionSpy = vi.fn();
        const subscription = eventBus.on(EVENT_TYPES.PLAYER_ADVANCED, progressionSpy);

        const gameResolvedEvent: GameResolvedEvent = {
          type: 'GAME_RESOLVED',
          timestamp: new Date(),
          gameId: `game-${testCase.fromLevel}`,
          winnerId: 'player-1',
          loserId: 'player-2',
          winnerLevel: testCase.fromLevel,
          loserLevel: testCase.fromLevel,
          winnerDollarId: 'dollar-1',
          loserDollarId: 'dollar-2',
          winnings: testCase.winnings,
          gameResult: 'WIN'
        };

        await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);

        expect(progressionSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'PLAYER_ADVANCED',
            playerId: 'player-1',
            fromLevel: testCase.fromLevel,
            toLevel: testCase.toLevel,
            totalWinnings: testCase.winnings
          })
        );

        subscription.unsubscribe();
      }
    });

    it('should handle jackpot level (10) with special $1024 winnings', async () => {
      mockProgressionManager.processGameResult.mockReturnValue({
        runId: 'run-jackpot',
        currentLevel: 10,
        gamesWonInRun: 10,
        currentWinnings: 1024, // Special jackpot amount
        isComplete: true,
        completionReason: 'JACKPOT',
        completedAt: new Date()
      });

      const runCompletedSpy = vi.fn();
      const subscription = eventBus.on(EVENT_TYPES.RUN_COMPLETED, runCompletedSpy);

      const gameResolvedEvent: GameResolvedEvent = {
        type: 'GAME_RESOLVED',
        timestamp: new Date(),
        gameId: 'game-jackpot',
        winnerId: 'player-1',
        loserId: 'player-2',
        winnerLevel: 10,
        loserLevel: 10,
        winnerDollarId: 'dollar-1',
        loserDollarId: 'dollar-2',
        winnings: 1024,
        gameResult: 'WIN'
      };

      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);

      subscription.unsubscribe();

      expect(runCompletedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RUN_COMPLETED',
          playerId: 'player-1',
          virtualDollarId: 'dollar-1',
          completionType: 'JACKPOT',
          finalLevel: 10,
          totalWinnings: 1024,
          wasJackpot: true
        })
      );
    });
  });

  describe('Cash-Out Decision Integration', () => {
    it('should integrate with conservative cash-out strategy at level 3', async () => {
      mockProgressionManager.processGameResult.mockReturnValue({
        runId: 'run-conservative',
        currentLevel: 3,
        gamesWonInRun: 3,
        currentWinnings: 7.2,
        isComplete: false,
        completionReason: null,
        completedAt: null
      });

      mockProgressionManager.makeCashOutDecision.mockReturnValue('CASH_OUT');
      mockProgressionManager.processCashOut.mockReturnValue({
        runId: 'run-conservative',
        finalLevel: 3,
        totalWinnings: 7.2,
        wasJackpot: false,
        wasCashedOut: true,
        charityContribution: 1.08, // 15% of 7.2
        playerPayout: 6.12,
        gamesPlayedInRun: 3
      });

      const cashOutSpy = vi.fn();
      const runCompletedSpy = vi.fn();
      const cashOutSubscription = eventBus.on(EVENT_TYPES.CASH_OUT_DECISION, cashOutSpy);
      const runSubscription = eventBus.on(EVENT_TYPES.RUN_COMPLETED, runCompletedSpy);

      const gameResolvedEvent: GameResolvedEvent = {
        type: 'GAME_RESOLVED',
        timestamp: new Date(),
        gameId: 'game-conservative',
        winnerId: 'player-1',
        loserId: 'player-2',
        winnerLevel: 3,
        loserLevel: 3,
        winnerDollarId: 'dollar-1',
        loserDollarId: 'dollar-2',
        winnings: 7.2,
        gameResult: 'WIN'
      };

      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);

      cashOutSubscription.unsubscribe();
      runSubscription.unsubscribe();

      expect(cashOutSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CASH_OUT_DECISION',
          playerId: 'player-1',
          virtualDollarId: 'dollar-1',
          decision: 'CASH_OUT',
          currentLevel: 3,
          totalWinnings: 7.2,
          cashOutStrategy: CashOutStrategy.CONSERVATIVE
        })
      );

      expect(runCompletedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RUN_COMPLETED',
          completionType: 'CASH_OUT',
          totalWinnings: 7.2
        })
      );
    });

    it('should handle aggressive strategy continuing to higher levels', async () => {
      mockProgressionManager.processGameResult.mockReturnValue({
        runId: 'run-aggressive',
        currentLevel: 8,
        gamesWonInRun: 8,
        currentWinnings: 230.4,
        isComplete: false,
        completionReason: null,
        completedAt: null
      });

      mockProgressionManager.makeCashOutDecision.mockReturnValue('CONTINUE');

      const cashOutSpy = vi.fn();
      const progressionSpy = vi.fn();
      const cashOutSubscription = eventBus.on(EVENT_TYPES.CASH_OUT_DECISION, cashOutSpy);
      const progressionSubscription = eventBus.on(EVENT_TYPES.PLAYER_ADVANCED, progressionSpy);

      const gameResolvedEvent: GameResolvedEvent = {
        type: 'GAME_RESOLVED',
        timestamp: new Date(),
        gameId: 'game-aggressive',
        winnerId: 'player-1',
        loserId: 'player-2',
        winnerLevel: 7,
        loserLevel: 7,
        winnerDollarId: 'dollar-1',
        loserDollarId: 'dollar-2',
        winnings: 230.4,
        gameResult: 'WIN'
      };

      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);

      cashOutSubscription.unsubscribe();
      progressionSubscription.unsubscribe();

      expect(cashOutSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          decision: 'CONTINUE',
          cashOutStrategy: CashOutStrategy.CONSERVATIVE
        })
      );

      expect(progressionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          fromLevel: 7,
          toLevel: 8
        })
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle progression failure gracefully', async () => {
      mockProgressionManager.processGameResult.mockImplementation(() => {
        throw new Error('Invalid run state - run not found');
      });

      const errorSpy = vi.fn();
      const subscription = eventBus.on(EVENT_TYPES.PLAYER_PROGRESSION_FAILED, errorSpy);

      const gameResolvedEvent: GameResolvedEvent = {
        type: 'GAME_RESOLVED',
        timestamp: new Date(),
        gameId: 'game-error',
        winnerId: 'player-1',
        loserId: 'player-2',
        winnerLevel: 1,
        loserLevel: 1,
        winnerDollarId: 'dollar-error',
        loserDollarId: 'dollar-2',
        winnings: 1.8,
        gameResult: 'WIN'
      };

      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);

      subscription.unsubscribe();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PLAYER_PROGRESSION_FAILED',
          playerId: 'player-1',
          virtualDollarId: 'dollar-error',
          reason: 'Progression processing failed',
          error: 'Winner progression failed: Invalid run state - run not found'
        })
      );
    });

    it('should handle maximum level edge case (level 10)', async () => {
      // Player already at level 10 tries to progress further (should complete as jackpot)
      mockProgressionManager.processGameResult.mockReturnValue({
        runId: 'run-max',
        currentLevel: 10,
        gamesWonInRun: 10,
        currentWinnings: 1024,
        isComplete: true,
        completionReason: 'JACKPOT',
        completedAt: new Date()
      });

      const runCompletedSpy = vi.fn();
      const subscription = eventBus.on(EVENT_TYPES.RUN_COMPLETED, runCompletedSpy);

      const gameResolvedEvent: GameResolvedEvent = {
        type: 'GAME_RESOLVED',
        timestamp: new Date(),
        gameId: 'game-max',
        winnerId: 'player-1',
        loserId: 'player-2',
        winnerLevel: 10,
        loserLevel: 10,
        winnerDollarId: 'dollar-1',
        loserDollarId: 'dollar-2',
        winnings: 1024,
        gameResult: 'WIN'
      };

      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);

      subscription.unsubscribe();

      expect(runCompletedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          completionType: 'JACKPOT',
          finalLevel: 10,
          wasJackpot: true
        })
      );
    });

    it('should handle game loss and run elimination', async () => {
      mockProgressionManager.processGameResult.mockReturnValue({
        runId: 'run-loss',
        currentLevel: 5,
        gamesWonInRun: 4,
        currentWinnings: 0, // Loss clears winnings
        isComplete: true,
        completionReason: 'LOSS',
        completedAt: new Date()
      });

      const runCompletedSpy = vi.fn();
      const subscription = eventBus.on(EVENT_TYPES.RUN_COMPLETED, runCompletedSpy);

      const gameResolvedEvent: GameResolvedEvent = {
        type: 'GAME_RESOLVED',
        timestamp: new Date(),
        gameId: 'game-loss',
        winnerId: 'player-2',
        loserId: 'player-1',
        winnerLevel: 5,
        loserLevel: 5,
        winnerDollarId: 'dollar-2',
        loserDollarId: 'dollar-1',
        winnings: 28.8,
        gameResult: 'WIN' // This is for the winner; we handle the loser
      };

      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);

      subscription.unsubscribe();

      // Should process the loser's elimination
      expect(runCompletedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RUN_COMPLETED',
          playerId: 'player-1',
          virtualDollarId: 'dollar-1',
          completionType: 'ELIMINATED',
          totalWinnings: 0,
          wasJackpot: false
        })
      );
    });
  });

  describe('Event State Tracking', () => {
    it('should maintain proper event sequencing for level progression', async () => {
      const events: string[] = [];
      
      const advancedSub = eventBus.on(EVENT_TYPES.PLAYER_ADVANCED, () => { events.push('ADVANCED'); });
      const decisionSub = eventBus.on(EVENT_TYPES.CASH_OUT_DECISION, () => { events.push('CASH_OUT_DECISION'); });
      const completedSub = eventBus.on(EVENT_TYPES.RUN_COMPLETED, () => { events.push('RUN_COMPLETED'); });

      // Mock different responses for winner vs loser
      mockProgressionManager.processGameResult.mockImplementation((virtualDollar, gameResult) => {
        if (gameResult === 'win') {
          // Winner advances
          return {
            runId: 'run-sequence-winner',
            currentLevel: 6,
            gamesWonInRun: 6,
            currentWinnings: 57.6,
            isComplete: false,
            completionReason: null,
            completedAt: null
          };
        } else {
          // Loser is eliminated
          return {
            runId: 'run-sequence-loser',
            currentLevel: 5,
            gamesWonInRun: 5,
            currentWinnings: 0,
            isComplete: true,
            completionReason: 'LOSS',
            completedAt: new Date()
          };
        }
      });

      mockProgressionManager.makeCashOutDecision.mockReturnValue('CASH_OUT');
      mockProgressionManager.processCashOut.mockReturnValue({
        runId: 'run-sequence',
        finalLevel: 6,
        totalWinnings: 57.6,
        wasJackpot: false,
        wasCashedOut: true,
        charityContribution: 8.64,
        playerPayout: 48.96,
        gamesPlayedInRun: 6
      });

      const gameResolvedEvent: GameResolvedEvent = {
        type: 'GAME_RESOLVED',
        timestamp: new Date(),
        gameId: 'game-sequence',
        winnerId: 'player-1',
        loserId: 'player-2',
        winnerLevel: 5,
        loserLevel: 5,
        winnerDollarId: 'dollar-1',
        loserDollarId: 'dollar-2',
        winnings: 57.6,
        gameResult: 'WIN'
      };

      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);

      advancedSub.unsubscribe();
      decisionSub.unsubscribe();
      completedSub.unsubscribe();

      // Verify proper event sequence - includes RUN_COMPLETED for both winner cash-out and loser elimination
      expect(events).toEqual(['ADVANCED', 'CASH_OUT_DECISION', 'RUN_COMPLETED', 'RUN_COMPLETED']);
    });
  });
});