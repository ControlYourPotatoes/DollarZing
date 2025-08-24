import { SimulationEngine, PlayerBehaviorModel, GrowthCalculator, LevelProgressionCalculator, RevenueDistributionCalculator } from '../src/simulation/index';
describe('Basic Simulation Components', () => {
    const testParameters = {
        cashOutStrategy: 'average',
        adoptionRate: 0.05,
        growthMultiplier: 1.2,
        panamaAdoption: false
    };
    describe('PlayerBehaviorModel', () => {
        let behaviorModel;
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
            for (let i = 0; i < 10; i++) { // Reduced iterations for speed
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
    });
    describe('GrowthCalculator', () => {
        let growthCalculator;
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
            const adoptedUsers = growthCalculator.calculatePanamaAdoption(5, 1000, adoptionRate, panamaUsers, 0.12345);
            expect(adoptedUsers).toBeGreaterThan(1000);
            expect(adoptedUsers).toBeLessThanOrEqual(panamaUsers);
        });
    });
    describe('LevelProgressionCalculator', () => {
        let progressionCalc;
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
        it('should handle edge cases at level 10 (jackpot level)', () => {
            const jackpotStats = progressionCalc.calculateLevelStatistics(10, 50, 'high', 0.12345);
            expect(jackpotStats.level).toBe(10);
            expect(jackpotStats.successRate).toBe(1.0); // Always win at jackpot level
            expect(jackpotStats.bottleneckScore).toBe(0); // No bottleneck at final level
        });
    });
    describe('RevenueDistributionCalculator', () => {
        let revenueCalc;
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
    });
    describe('SimulationEngine Basic Functions', () => {
        let engine;
        beforeEach(() => {
            engine = new SimulationEngine(testParameters);
        });
        it('should create engine with valid parameters', () => {
            expect(engine).toBeInstanceOf(SimulationEngine);
            expect(engine.getParameters()).toEqual(testParameters);
        });
        it('should handle parameter updates', () => {
            const newParameters = {
                cashOutStrategy: 'high',
                adoptionRate: 0.1,
                growthMultiplier: 1.5,
                panamaAdoption: true
            };
            engine.updateParameters(newParameters);
            expect(engine.getParameters()).toEqual(newParameters);
        });
        it('should validate parameters correctly', () => {
            const invalidParams = {
                cashOutStrategy: 'average',
                adoptionRate: -0.1, // Negative rate
                growthMultiplier: 1.2,
                panamaAdoption: false
            };
            expect(() => new SimulationEngine(invalidParams)).toThrow('Invalid adoption rate');
        });
        it('should reject invalid growth multipliers', () => {
            const invalidParams = {
                cashOutStrategy: 'average',
                adoptionRate: 0.05,
                growthMultiplier: -1.0, // Negative multiplier
                panamaAdoption: false
            };
            expect(() => new SimulationEngine(invalidParams)).toThrow('Invalid growth multiplier');
        });
        it('should reject invalid cash-out strategies', () => {
            const invalidParams = {
                cashOutStrategy: 'invalid',
                adoptionRate: 0.05,
                growthMultiplier: 1.2,
                panamaAdoption: false
            };
            expect(() => new SimulationEngine(invalidParams)).toThrow('Invalid cash-out strategy');
        });
    });
});
//# sourceMappingURL=simulation-basic.test.js.map