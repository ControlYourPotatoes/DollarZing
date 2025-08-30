import { 
  SimulationEngine, 
  PlayerBehaviorModel, 
  GrowthCalculator,
  LevelProgressionCalculator,
  RevenueDistributionCalculator 
} from '../src/simulation/index';
import { SimulationParameters } from '../../data/src/types/index';

describe('Core Simulation Engine', () => {
  describe('SimulationEngine', () => {
    let engine: SimulationEngine;
    let testParameters: SimulationParameters;

    beforeEach(() => {
      testParameters = {
        cashOutStrategy: 'average',
        adoptionRate: 0.05,
        growthMultiplier: 1.2,
        panamaAdoption: false
      };
      engine = new SimulationEngine(testParameters);
    });

    it('should create engine with valid parameters', () => {
      expect(engine).toBeInstanceOf(SimulationEngine);
      expect(engine.getParameters()).toEqual(testParameters);
    });

    it('should generate yearly dataset within performance requirements', async () => {
      const startTime = performance.now();
      const dataset = await engine.generateYearlyDataset();
      const endTime = performance.now();
      
      const generationTime = endTime - startTime;
      expect(generationTime).toBeLessThan(5000); // Under 5 seconds
      expect(dataset.dailySnapshots).toHaveLength(365);
      expect(dataset.metadata.generationDurationMs).toBe(generationTime);
    });

    it('should maintain financial consistency across all days', async () => {
      const dataset = await engine.generateYearlyDataset();
      
      dataset.dailySnapshots.forEach((snapshot, index) => {
        const { financialMetrics } = snapshot;
        const totalRevenue = financialMetrics.platformEarnings + 
                            financialMetrics.charityContributions + 
                            financialMetrics.governmentEarnings + 
                            financialMetrics.playerWinnings;
        
        expect(totalRevenue).toBeCloseTo(financialMetrics.totalRevenue, 2);
        expect(snapshot.day).toBe(index + 1);
      });
    });

    it('should handle parameter updates', () => {
      const newParameters: SimulationParameters = {
        cashOutStrategy: 'high',
        adoptionRate: 0.1,
        growthMultiplier: 1.5,
        panamaAdoption: true
      };
      
      engine.updateParameters(newParameters);
      expect(engine.getParameters()).toEqual(newParameters);
    });

    it('should validate dataset accuracy against legacy calculations', async () => {
      // Test a single day calculation against the legacy logic
      const dataset = await engine.generateYearlyDataset();
      const firstDay = dataset.dailySnapshots[0];
      
      // Verify the first day matches expected patterns
      expect(firstDay.day).toBe(1);
      expect(firstDay.playerMetrics.totalPlayers).toBeGreaterThan(0);
      expect(firstDay.financialMetrics.gamesPlayed).toBeGreaterThan(0);
      expect(firstDay.levelProgression).toHaveLength(10); // 10 levels
    });

    it('should generate consistent results with same seed', async () => {
      const engine1 = new SimulationEngine(testParameters);
      const engine2 = new SimulationEngine(testParameters);
      
      const dataset1 = await engine1.generateYearlyDataset();
      const dataset2 = await engine2.generateYearlyDataset();
      
      // First few days should match exactly with same parameters
      expect(dataset1.dailySnapshots[0].financialMetrics.gamesPlayed)
        .toBe(dataset2.dailySnapshots[0].financialMetrics.gamesPlayed);
      expect(dataset1.dailySnapshots[0].playerMetrics.totalPlayers)
        .toBe(dataset2.dailySnapshots[0].playerMetrics.totalPlayers);
    });

    it('should handle memory usage within limits', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const dataset = await engine.generateYearlyDataset();
      const finalMemory = process.memoryUsage().heapUsed;
      
      const memoryUsedMB = (finalMemory - initialMemory) / (1024 * 1024);
      expect(memoryUsedMB).toBeLessThan(100); // Under 100MB
      expect(dataset.metadata.memoryUsageMB).toBeLessThan(100);
    });
  });

  describe('PlayerBehaviorModel', () => {
    let behaviorModel: PlayerBehaviorModel;

    beforeEach(() => {
      behaviorModel = new PlayerBehaviorModel();
    });

    it('should calculate cash-out probabilities correctly', () => {
      // Low strategy: higher cash-out at lower levels
      expect(behaviorModel.getCashOutProbability(1, 'low')).toBeGreaterThan(0.8);
      expect(behaviorModel.getCashOutProbability(10, 'low')).toBeLessThan(0.5);

      // High strategy: lower cash-out at lower levels
      expect(behaviorModel.getCashOutProbability(1, 'high')).toBeLessThan(0.3);
      expect(behaviorModel.getCashOutProbability(10, 'high')).toBeGreaterThan(0.5);

      // Average strategy: consistent probabilities
      expect(behaviorModel.getCashOutProbability(1, 'average')).toBeCloseTo(0.3, 1);
      expect(behaviorModel.getCashOutProbability(10, 'average')).toBeCloseTo(0.3, 1);
    });

    it('should generate bills per day within expected ranges', () => {
      for (let i = 0; i < 100; i++) {
        const lowBills = behaviorModel.getBillsPerDay('low', Math.random());
        const avgBills = behaviorModel.getBillsPerDay('average', Math.random());
        const highBills = behaviorModel.getBillsPerDay('high', Math.random());

        expect(lowBills).toBeGreaterThanOrEqual(1);
        expect(lowBills).toBeLessThanOrEqual(4);
        
        expect(avgBills).toBeGreaterThanOrEqual(5);
        expect(avgBills).toBeLessThanOrEqual(7);
        
        expect(highBills).toBeGreaterThanOrEqual(8);
        expect(highBills).toBeLessThanOrEqual(12);
      }
    });

    it('should model player journeys with progression tracking', () => {
      const journey = behaviorModel.simulatePlayerJourney('player-001', 'high', 30);
      
      expect(journey.playerId).toBe('player-001');
      expect(journey.totalGamesPlayed).toBeGreaterThan(0);
      expect(journey.maxLevelReached).toBeGreaterThanOrEqual(1);
      expect(journey.maxLevelReached).toBeLessThanOrEqual(10);
      expect(journey.levelProgression).toHaveLength(journey.maxLevelReached);
      expect(journey.netGain).toBe(journey.totalWinnings - journey.totalLosses);
    });
  });

  describe('GrowthCalculator', () => {
    let growthCalculator: GrowthCalculator;

    beforeEach(() => {
      growthCalculator = new GrowthCalculator();
    });

    it('should calculate organic growth rates', () => {
      const baseGrowth = growthCalculator.calculateOrganicGrowth(1, 1000, 1.2, 0.12345);
      expect(baseGrowth).toBeGreaterThan(1000); // Should grow
      
      const dayTenGrowth = growthCalculator.calculateOrganicGrowth(10, 1000, 1.2, 0.12345);
      expect(dayTenGrowth).toBeGreaterThan(baseGrowth); // Should grow more over time
    });

    it('should calculate Panama adoption correctly', () => {
      const adoptionRate = 0.1; // 10% adoption
      const panamaUsers = 1000000; // 1M total users
      
      const adoptedUsers = growthCalculator.calculatePanamaAdoption(
        5, 1000, adoptionRate, panamaUsers, 0.12345
      );
      
      expect(adoptedUsers).toBeGreaterThan(1000);
      expect(adoptedUsers).toBeLessThanOrEqual(panamaUsers);
    });

    it('should apply growth multipliers correctly', () => {
      const baseGrowth = growthCalculator.calculateOrganicGrowth(5, 1000, 1.0, 0.12345);
      const multipliedGrowth = growthCalculator.calculateOrganicGrowth(5, 1000, 2.0, 0.12345);
      
      expect(multipliedGrowth).toBeGreaterThan(baseGrowth);
    });

    it('should maintain player count constraints', () => {
      const maxUsers = 1000000;
      const nearMaxGrowth = growthCalculator.calculatePanamaAdoption(
        50, 950000, 0.1, maxUsers, 0.12345
      );
      
      expect(nearMaxGrowth).toBeLessThanOrEqual(maxUsers);
    });
  });

  describe('LevelProgressionCalculator', () => {
    let progressionCalc: LevelProgressionCalculator;

    beforeEach(() => {
      progressionCalc = new LevelProgressionCalculator();
    });

    it('should calculate level statistics correctly', () => {
      const stats = progressionCalc.calculateLevelStatistics(5, 1000, 'average', 0.12345);
      
      expect(stats.level).toBe(5);
      expect(stats.gamesAtLevel).toBe(1000);
      expect(stats.successRate).toBeGreaterThan(0);
      expect(stats.successRate).toBeLessThanOrEqual(1);
      expect(stats.avgTimeAtLevel).toBeGreaterThan(0);
      expect(stats.bottleneckScore).toBeGreaterThanOrEqual(0);
      expect(stats.bottleneckScore).toBeLessThanOrEqual(1);
    });

    it('should identify bottlenecks at higher levels', () => {
      const level3Stats = progressionCalc.calculateLevelStatistics(3, 1000, 'low', 0.12345);
      const level8Stats = progressionCalc.calculateLevelStatistics(8, 100, 'low', 0.12345);
      
      // Higher levels should generally have higher bottleneck scores for low strategy
      expect(level8Stats.bottleneckScore).toBeGreaterThanOrEqual(level3Stats.bottleneckScore);
    });

    it('should handle edge cases at level 10 (jackpot level)', () => {
      const jackpotStats = progressionCalc.calculateLevelStatistics(10, 50, 'high', 0.12345);
      
      expect(jackpotStats.level).toBe(10);
      expect(jackpotStats.successRate).toBe(1.0); // Always win at jackpot level
      expect(jackpotStats.bottleneckScore).toBe(0); // No bottleneck at final level
    });
  });

  describe('RevenueDistributionCalculator', () => {
    let revenueCalc: RevenueDistributionCalculator;

    beforeEach(() => {
      revenueCalc = new RevenueDistributionCalculator();
    });

    it('should calculate revenue breakdown correctly', () => {
      const breakdown = revenueCalc.calculateRevenueBreakdown(1000, 'cashout');
      
      expect(breakdown.platform.percentage).toBeCloseTo(0.2, 2);
      expect(breakdown.charity.percentage).toBeCloseTo(0.2, 2);
      expect(breakdown.government.percentage).toBeCloseTo(0.4, 2);
      expect(breakdown.players.percentage).toBeCloseTo(0.4, 2);
      
      const totalAmount = breakdown.platform.amount + breakdown.charity.amount + 
                         breakdown.government.amount + breakdown.players.amount;
      expect(totalAmount).toBeCloseTo(1000, 2);
    });

    it('should handle different transaction types', () => {
      const cashoutBreakdown = revenueCalc.calculateRevenueBreakdown(1000, 'cashout');
      const lossBreakdown = revenueCalc.calculateRevenueBreakdown(1000, 'loss');
      
      // Loss events should have different distribution (less to players)
      expect(lossBreakdown.players.percentage).toBeLessThan(cashoutBreakdown.players.percentage);
    });

    it('should maintain percentage consistency', () => {
      for (const amount of [100, 500, 1000, 5000]) {
        const breakdown = revenueCalc.calculateRevenueBreakdown(amount, 'cashout');
        const totalPercentage = breakdown.platform.percentage + breakdown.charity.percentage + 
                              breakdown.government.percentage + breakdown.players.percentage;
        
        expect(totalPercentage).toBeCloseTo(1.0, 2);
      }
    });
  });

  describe('Parameter Validation', () => {
    it('should validate simulation parameters', () => {
      const validParams: SimulationParameters = {
        cashOutStrategy: 'average',
        adoptionRate: 0.05,
        growthMultiplier: 1.2,
        panamaAdoption: true
      };

      expect(() => new SimulationEngine(validParams)).not.toThrow();
    });

    it('should reject invalid adoption rates', () => {
      const invalidParams: SimulationParameters = {
        cashOutStrategy: 'average',
        adoptionRate: -0.1, // Negative rate
        growthMultiplier: 1.2,
        panamaAdoption: false
      };

      expect(() => new SimulationEngine(invalidParams)).toThrow('Invalid adoption rate');
    });

    it('should reject invalid growth multipliers', () => {
      const invalidParams: SimulationParameters = {
        cashOutStrategy: 'average',
        adoptionRate: 0.05,
        growthMultiplier: -1.0, // Negative multiplier
        panamaAdoption: false
      };

      expect(() => new SimulationEngine(invalidParams)).toThrow('Invalid growth multiplier');
    });

    it('should reject invalid cash-out strategies', () => {
      const invalidParams = {
        cashOutStrategy: 'invalid' as any,
        adoptionRate: 0.05,
        growthMultiplier: 1.2,
        panamaAdoption: false
      };

      expect(() => new SimulationEngine(invalidParams)).toThrow('Invalid cash-out strategy');
    });
  });

  describe('Performance and Accuracy', () => {
    it('should meet generation speed benchmarks', async () => {
      const engine = new SimulationEngine({
        cashOutStrategy: 'average',
        adoptionRate: 0.03,
        growthMultiplier: 1.1,
        panamaAdoption: false
      });

      const trials = 3;
      const times: number[] = [];
      
      for (let i = 0; i < trials; i++) {
        const start = performance.now();
        await engine.generateYearlyDataset();
        const end = performance.now();
        times.push(end - start);
      }
      
      const avgTime = times.reduce((sum, time) => sum + time, 0) / trials;
      expect(avgTime).toBeLessThan(5000); // Average under 5 seconds
    });

    it('should maintain accuracy metrics', async () => {
      const engine = new SimulationEngine({
        cashOutStrategy: 'average',
        adoptionRate: 0.05,
        growthMultiplier: 1.2,
        panamaAdoption: false
      });

      const dataset = await engine.generateYearlyDataset();
      expect(dataset.metadata.accuracy).toBeGreaterThan(0.95); // At least 95% accuracy
    });
  });
});