import { 
  VirtualDollarManager,
  VirtualDollar,
  DollarState
} from '../src/types/virtual-dollar-types';

describe('VirtualDollarManager', () => {
  let manager: VirtualDollarManager;

  beforeEach(() => {
    manager = new VirtualDollarManager();
  });

  describe('Serial Number Generation', () => {
    it('should generate valid serial numbers matching letter+8digits+letter pattern', () => {
      const serial = manager.generateSerialNumber();
      const pattern = /^[A-Z]\d{8}[A-Z]$/;
      expect(pattern.test(serial)).toBe(true);
    });

    it('should generate unique serial numbers', () => {
      const serials = new Set();
      for (let i = 0; i < 1000; i++) {
        const serial = manager.generateSerialNumber();
        expect(serials.has(serial)).toBe(false);
        serials.add(serial);
      }
    });

    it('should generate realistic letter distributions', () => {
      const serials = Array.from({ length: 100 }, () => manager.generateSerialNumber());
      const firstLetters = serials.map(s => s.charAt(0));
      const lastLetters = serials.map(s => s.charAt(9));
      
      // Should have variety in letters (not all the same)
      expect(new Set(firstLetters).size).toBeGreaterThan(5);
      expect(new Set(lastLetters).size).toBeGreaterThan(5);
    });
  });

  describe('Dollar Creation', () => {
    it('should create virtual dollar with all required properties', () => {
      const playerId = 'player-123';
      const dollar = manager.createVirtualDollar(playerId);

      expect(dollar.id).toBeDefined();
      expect(dollar.serialNumber).toMatch(/^[A-Z]\d{8}[A-Z]$/);
      expect(dollar.currentScore).toBe(0);
      expect(dollar.currentLevel).toBe(1);
      expect(dollar.state).toBe(DollarState.CREATED);
      expect(dollar.ownerId).toBe(playerId);
      expect(dollar.runId).toBeDefined();
      expect(dollar.createdAt).toBeInstanceOf(Date);
      expect(dollar.gameHistory).toEqual([]);
      expect(dollar.gamesInThisRun).toBe(0);
      expect(dollar.currentRunWinnings).toBe(0);
      expect(dollar.isIndependentRun).toBe(true);
    });

    it('should create dollars with unique run IDs', () => {
      const dollar1 = manager.createVirtualDollar('player1');
      const dollar2 = manager.createVirtualDollar('player1');
      expect(dollar1.runId).not.toBe(dollar2.runId);
    });

    it('should create dollars with unique IDs', () => {
      const dollar1 = manager.createVirtualDollar('player1');
      const dollar2 = manager.createVirtualDollar('player2');
      expect(dollar1.id).not.toBe(dollar2.id);
    });

    it('should validate player IDs during creation', () => {
      expect(() => manager.createVirtualDollar('')).toThrow('Invalid player ID');
      expect(() => manager.createVirtualDollar(null as any)).toThrow('Invalid player ID');
      expect(() => manager.createVirtualDollar(undefined as any)).toThrow('Invalid player ID');
    });
  });

  describe('Dollar State Management', () => {
    let dollar: VirtualDollar;

    beforeEach(() => {
      dollar = manager.createVirtualDollar('test-player');
    });

    it('should transition from created to pooled state', () => {
      const result = manager.updateDollarState(dollar.id, DollarState.POOLED);
      expect(result.isValid).toBe(true);
      
      const updatedDollar = manager.getDollar(dollar.id);
      expect(updatedDollar?.state).toBe(DollarState.POOLED);
    });

    it('should transition through valid state progression', () => {
      // created → pooled → in-game → won → cashed-out
      expect(manager.updateDollarState(dollar.id, DollarState.POOLED).isValid).toBe(true);
      expect(manager.updateDollarState(dollar.id, DollarState.IN_GAME).isValid).toBe(true);
      expect(manager.updateDollarState(dollar.id, DollarState.WON).isValid).toBe(true);
      expect(manager.updateDollarState(dollar.id, DollarState.CASHED_OUT).isValid).toBe(true);
    });

    it('should prevent invalid state transitions', () => {
      // Can't go directly from created to won
      const result = manager.updateDollarState(dollar.id, DollarState.WON);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid state transition from CREATED to WON');
    });

    it('should prevent transitions from final states', () => {
      manager.updateDollarState(dollar.id, DollarState.POOLED);
      manager.updateDollarState(dollar.id, DollarState.IN_GAME);
      manager.updateDollarState(dollar.id, DollarState.LOST);

      // Can't transition from LOST to any other state
      const result = manager.updateDollarState(dollar.id, DollarState.POOLED);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot transition from final state LOST');
    });
  });

  describe('Dollar Pool Management', () => {
    it('should add dollars to pool', () => {
      const dollar = manager.createVirtualDollar('player1');
      manager.updateDollarState(dollar.id, DollarState.POOLED);
      
      const pooledDollars = manager.getPooledDollars();
      expect(pooledDollars).toHaveLength(1);
      expect(pooledDollars[0].id).toBe(dollar.id);
    });

    it('should remove dollars from pool when state changes', () => {
      const dollar = manager.createVirtualDollar('player1');
      manager.updateDollarState(dollar.id, DollarState.POOLED);
      
      expect(manager.getPooledDollars()).toHaveLength(1);
      
      manager.updateDollarState(dollar.id, DollarState.IN_GAME);
      expect(manager.getPooledDollars()).toHaveLength(0);
    });

    it('should handle batch dollar creation', () => {
      const playerIds = ['player1', 'player2', 'player3'];
      const dollars = manager.createBatchVirtualDollars(playerIds);
      
      expect(dollars).toHaveLength(3);
      expect(new Set(dollars.map(d => d.id)).size).toBe(3); // All unique IDs
      expect(new Set(dollars.map(d => d.serialNumber)).size).toBe(3); // All unique serials
    });

    it('should get dollars by player ID', () => {
      const playerId = 'player1';
      const dollar1 = manager.createVirtualDollar(playerId);
      const dollar2 = manager.createVirtualDollar(playerId);
      const dollar3 = manager.createVirtualDollar('player2');

      const playerDollars = manager.getDollarsByPlayer(playerId);
      expect(playerDollars).toHaveLength(2);
      expect(playerDollars.map(d => d.id)).toContain(dollar1.id);
      expect(playerDollars.map(d => d.id)).toContain(dollar2.id);
      expect(playerDollars.map(d => d.id)).not.toContain(dollar3.id);
    });
  });

  describe('Dollar Lookup and Queries', () => {
    it('should find dollar by ID', () => {
      const dollar = manager.createVirtualDollar('player1');
      const found = manager.getDollar(dollar.id);
      
      expect(found).toBeDefined();
      expect(found?.id).toBe(dollar.id);
    });

    it('should return null for non-existent dollar', () => {
      const found = manager.getDollar('non-existent-id');
      expect(found).toBeNull();
    });

    it('should find dollar by serial number', () => {
      const dollar = manager.createVirtualDollar('player1');
      const found = manager.getDollarBySerial(dollar.serialNumber);
      
      expect(found).toBeDefined();
      expect(found?.serialNumber).toBe(dollar.serialNumber);
    });

    it('should get pool statistics', () => {
      manager.createVirtualDollar('player1');
      manager.createVirtualDollar('player2');
      const dollar3 = manager.createVirtualDollar('player3');
      
      manager.updateDollarState(dollar3.id, DollarState.POOLED);
      
      const stats = manager.getPoolStatistics();
      expect(stats.totalDollars).toBe(3);
      expect(stats.pooledDollars).toBe(1);
      expect(stats.inGameDollars).toBe(0);
      expect(stats.completedDollars).toBe(0);
    });
  });

  describe('History and Tracking', () => {
    it('should track dollar state history', () => {
      const dollar = manager.createVirtualDollar('player1');
      
      manager.updateDollarState(dollar.id, DollarState.POOLED);
      manager.updateDollarState(dollar.id, DollarState.IN_GAME);
      manager.updateDollarState(dollar.id, DollarState.WON);
      
      const history = manager.getDollarStateHistory(dollar.id);
      expect(history).toHaveLength(4); // Initial created + 3 transitions
      expect(history[0].state).toBe(DollarState.CREATED);
      expect(history[1].state).toBe(DollarState.POOLED);
      expect(history[2].state).toBe(DollarState.IN_GAME);
      expect(history[3].state).toBe(DollarState.WON);
    });

    it('should include timestamps in state history', () => {
      const dollar = manager.createVirtualDollar('player1');
      const beforeUpdate = Date.now();
      
      manager.updateDollarState(dollar.id, DollarState.POOLED);
      const afterUpdate = Date.now();
      
      const history = manager.getDollarStateHistory(dollar.id);
      const pooledTransition = history.find(h => h.state === DollarState.POOLED);
      
      expect(pooledTransition).toBeDefined();
      expect(pooledTransition!.timestamp.getTime()).toBeGreaterThanOrEqual(beforeUpdate);
      expect(pooledTransition!.timestamp.getTime()).toBeLessThanOrEqual(afterUpdate);
    });
  });

  describe('Independent Run Functionality', () => {
    it('should update run-specific data correctly', () => {
      const dollar = manager.createVirtualDollar('player1');
      const winnings = 2.0; // Level 1 winnings
      
      const result = manager.updateRunData(dollar.id, winnings);
      expect(result.isValid).toBe(true);
      
      const updatedDollar = manager.getDollar(dollar.id);
      expect(updatedDollar?.gamesInThisRun).toBe(1);
      expect(updatedDollar?.currentRunWinnings).toBe(winnings);
    });

    it('should find dollar by run ID', () => {
      const dollar = manager.createVirtualDollar('player1');
      const found = manager.getDollarByRunId(dollar.runId);
      
      expect(found).toBeDefined();
      expect(found?.runId).toBe(dollar.runId);
    });

    it('should get active runs for a player', () => {
      const playerId = 'player1';
      const dollar1 = manager.createVirtualDollar(playerId);
      const dollar2 = manager.createVirtualDollar(playerId);
      
      // One dollar is pooled (active), one is cashed out (completed)
      manager.updateDollarState(dollar1.id, DollarState.POOLED);
      manager.updateDollarState(dollar2.id, DollarState.POOLED);
      manager.updateDollarState(dollar2.id, DollarState.IN_GAME);
      manager.updateDollarState(dollar2.id, DollarState.WON);
      manager.updateDollarState(dollar2.id, DollarState.CASHED_OUT);
      
      const activeRuns = manager.getActiveRunsByPlayer(playerId);
      expect(activeRuns).toHaveLength(1);
      expect(activeRuns[0].id).toBe(dollar1.id);
    });

    it('should get completed runs for a player', () => {
      const playerId = 'player1';
      const dollar1 = manager.createVirtualDollar(playerId);
      manager.createVirtualDollar(playerId); // Create second dollar but don't complete it
      
      // Complete one dollar
      manager.updateDollarState(dollar1.id, DollarState.POOLED);
      manager.updateDollarState(dollar1.id, DollarState.IN_GAME);
      manager.updateDollarState(dollar1.id, DollarState.LOST);
      
      const completedRuns = manager.getCompletedRunsByPlayer(playerId);
      expect(completedRuns).toHaveLength(1);
      expect(completedRuns[0].id).toBe(dollar1.id);
    });

    it('should validate run data update for non-existent dollar', () => {
      const result = manager.updateRunData('non-existent', 2.0);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Dollar with ID non-existent not found');
    });
  });

  describe('Error Handling and Validation', () => {
    it('should validate dollar state updates for non-existent dollars', () => {
      const result = manager.updateDollarState('non-existent', DollarState.POOLED);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Dollar with ID non-existent not found');
    });

    it('should handle concurrent state updates safely', () => {
      const dollar = manager.createVirtualDollar('player1');
      
      // Simulate concurrent updates
      const promises = [
        manager.updateDollarState(dollar.id, DollarState.POOLED),
        manager.updateDollarState(dollar.id, DollarState.POOLED),
        manager.updateDollarState(dollar.id, DollarState.POOLED)
      ];
      
      // All should complete without throwing
      expect(() => Promise.all(promises)).not.toThrow();
    });

    it('should prevent creation with duplicate serial numbers', () => {
      // Mock the serial generation to return same value
      const fixedSerial = 'A12345678B';
      jest.spyOn(manager, 'generateSerialNumber').mockReturnValue(fixedSerial);
      
      const dollar1 = manager.createVirtualDollar('player1');
      expect(() => manager.createVirtualDollar('player2')).toThrow('Serial number collision detected');
      
      expect(dollar1.serialNumber).toBe(fixedSerial);
    });
  });
});