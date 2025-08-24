// Revenue Calculator Integration Tests - Task 6.2, 6.4, 6.10, 6.12
// Integration tests for RevenueCalculator with real implementation
import { RevenueCalculator } from '../src/types/revenue-calculator';
describe('RevenueCalculator - Integration Tests', () => {
    let revenueCalculator;
    beforeEach(() => {
        revenueCalculator = new RevenueCalculator(0.15); // 15% charity
    });
    describe('Real Implementation Tests', () => {
        test('should process game revenue correctly', () => {
            const mockGameSession = {
                id: 'game_123',
                dollar1: { id: 'dollar1', serialNumber: 'A12345678B' },
                dollar2: { id: 'dollar2', serialNumber: 'C87654321D' },
                winner: { id: 'dollar1' },
                loser: { id: 'dollar2' },
                level: 1,
                platformFee: 0.20,
                timestamp: new Date(),
                gameNumber: 1,
                dailySeed: 'seed123',
                dollar1Score: 0.75,
                dollar2Score: 0.68,
                winnings: 2.00
            };
            const result = revenueCalculator.processGameRevenue(mockGameSession);
            expect(result.isValid).toBe(true);
            expect(revenueCalculator.getPlatformRevenue()).toBe(0.20);
            expect(revenueCalculator.getTotalGames()).toBe(1);
            const revenueStream = revenueCalculator.getRevenueStream();
            expect(revenueStream.platformClickRevenue).toBe(0.20);
            expect(revenueStream.totalClickFees).toBe(0.20);
            expect(revenueStream.totalGames).toBe(1);
        });
        test('should process cash-out with charity correctly', () => {
            const result = revenueCalculator.processCashOut(100.00);
            expect(result.validation.isValid).toBe(true);
            expect(result.charityAmount).toBe(15.00); // 15% of $100
            expect(result.playerAmount).toBe(85.00); // 85% of $100
            expect(revenueCalculator.getCharityContributions()).toBe(15.00);
            expect(revenueCalculator.getPlayerWinnings()).toBe(85.00);
        });
        test('should validate charity percentage bounds', () => {
            const lowResult = revenueCalculator.setCharityPercentage(0.05); // 5% - invalid
            expect(lowResult.isValid).toBe(false);
            expect(lowResult.errors).toContain('Charity percentage must be between 0.10 (10%) and 1.00 (100%)');
            const highResult = revenueCalculator.setCharityPercentage(1.01); // 101% - invalid  
            expect(highResult.isValid).toBe(false);
            expect(highResult.errors).toContain('Charity percentage must be between 0.10 (10%) and 1.00 (100%)');
            const validResult = revenueCalculator.setCharityPercentage(0.25); // 25% - valid
            expect(validResult.isValid).toBe(true);
            expect(revenueCalculator.getCharityPercentage()).toBe(0.25);
        });
        test('should generate comprehensive revenue report', () => {
            // Process some games and cash-outs
            const game1 = {
                id: 'game1', dollar1: {}, dollar2: {}, winner: {}, loser: {},
                level: 1, platformFee: 0.20, timestamp: new Date(), gameNumber: 1,
                dailySeed: 'seed1', dollar1Score: 0.8, dollar2Score: 0.6, winnings: 2.00
            };
            const game2 = {
                id: 'game2', dollar1: {}, dollar2: {}, winner: {}, loser: {},
                level: 2, platformFee: 0.20, timestamp: new Date(), gameNumber: 2,
                dailySeed: 'seed2', dollar1Score: 0.7, dollar2Score: 0.9, winnings: 4.00
            };
            revenueCalculator.processGameRevenue(game1);
            revenueCalculator.processGameRevenue(game2);
            revenueCalculator.processCashOut(50.00);
            revenueCalculator.processCashOut(30.00);
            const report = revenueCalculator.generateRevenueReport();
            expect(report.validation.isValid).toBe(true);
            expect(report.summary.totalGames).toBe(2);
            expect(report.summary.platformClickRevenue).toBe(0.40); // 2 games × 20c
            expect(report.summary.charityContributions).toBe(12.00); // 15% of $80 total cash-outs
            expect(report.summary.playerWinnings).toBe(68.00); // 85% of $80 total cash-outs
            expect(report.breakdown.averageRevenuePerGame).toBe(0.20); // 40c ÷ 2 games
        });
        test('should handle validation of zero values and maximum amounts', () => {
            // Test zero amount validation
            const zeroResult = revenueCalculator.validateAmount(0, false);
            expect(zeroResult.isValid).toBe(false);
            expect(zeroResult.errors).toContain('Amount cannot be zero');
            const zeroAllowedResult = revenueCalculator.validateAmount(0, true);
            expect(zeroAllowedResult.isValid).toBe(true);
            // Test negative amount validation
            const negativeResult = revenueCalculator.validateAmount(-10);
            expect(negativeResult.isValid).toBe(false);
            expect(negativeResult.errors).toContain('Amount cannot be negative');
            // Test maximum amount warning
            const highAmountResult = revenueCalculator.validateAmount(15000);
            expect(highAmountResult.isValid).toBe(true);
            expect(highAmountResult.warnings).toContain('Amount is unusually high');
        });
        test('should process multiple cash-outs with different charity percentages', () => {
            // Test with different charity rates
            const scenarios = [
                { percentage: 0.10, amount: 100.00, expectedCharity: 10.00, expectedPlayer: 90.00 },
                { percentage: 0.25, amount: 200.00, expectedCharity: 50.00, expectedPlayer: 150.00 },
                { percentage: 0.50, amount: 80.00, expectedCharity: 40.00, expectedPlayer: 40.00 }
            ];
            scenarios.forEach(scenario => {
                revenueCalculator.reset(scenario.percentage);
                const result = revenueCalculator.processCashOut(scenario.amount);
                expect(result.validation.isValid).toBe(true);
                expect(result.charityAmount).toBe(scenario.expectedCharity);
                expect(result.playerAmount).toBe(scenario.expectedPlayer);
            });
        });
        test('should maintain accurate game history', () => {
            const games = [
                {
                    id: 'game1', dollar1: {}, dollar2: {}, winner: {}, loser: {},
                    level: 1, platformFee: 0.20, timestamp: new Date(), gameNumber: 1,
                    dailySeed: 'seed1', dollar1Score: 0.8, dollar2Score: 0.6, winnings: 2.00
                },
                {
                    id: 'game2', dollar1: {}, dollar2: {}, winner: {}, loser: {},
                    level: 3, platformFee: 0.20, timestamp: new Date(), gameNumber: 2,
                    dailySeed: 'seed2', dollar1Score: 0.7, dollar2Score: 0.9, winnings: 8.00
                }
            ];
            games.forEach(game => {
                revenueCalculator.processGameRevenue(game);
            });
            const history = revenueCalculator.getGameHistory();
            expect(history).toHaveLength(2);
            expect(history[0].id).toBe('game1');
            expect(history[1].id).toBe('game2');
            expect(history[0].level).toBe(1);
            expect(history[1].level).toBe(3);
        });
        test('should handle platform fee configuration correctly', () => {
            const config = revenueCalculator.getPlatformFeeConfiguration();
            expect(config.perPlayer).toBe(0.10); // 10 cents per player
            expect(config.perGame).toBe(0.20); // 20 cents per game
            expect(config.totalPlayers).toBe(2); // 2 players per game
        });
        test('should reset revenue calculator correctly', () => {
            // Add some data first
            const game = {
                id: 'testGame', dollar1: {}, dollar2: {}, winner: {}, loser: {},
                level: 1, platformFee: 0.20, timestamp: new Date(), gameNumber: 1,
                dailySeed: 'seed', dollar1Score: 0.8, dollar2Score: 0.6, winnings: 2.00
            };
            revenueCalculator.processGameRevenue(game);
            revenueCalculator.processCashOut(50.00);
            // Verify data exists
            expect(revenueCalculator.getTotalGames()).toBe(1);
            expect(revenueCalculator.getCharityContributions()).toBe(7.50);
            // Reset
            const resetResult = revenueCalculator.reset(0.20); // 20% charity
            expect(resetResult.isValid).toBe(true);
            // Verify reset worked
            expect(revenueCalculator.getTotalGames()).toBe(0);
            expect(revenueCalculator.getCharityContributions()).toBe(0);
            expect(revenueCalculator.getPlatformRevenue()).toBe(0);
            expect(revenueCalculator.getCharityPercentage()).toBe(0.20);
            expect(revenueCalculator.getGameHistory()).toHaveLength(0);
        });
        test('should handle edge cases gracefully', () => {
            // Test cash-out with zero progression
            const zeroResult = revenueCalculator.processCashOut(0);
            expect(zeroResult.validation.isValid).toBe(true);
            expect(zeroResult.playerAmount).toBe(0);
            expect(zeroResult.charityAmount).toBe(0);
            expect(zeroResult.validation.warnings).toContain('Cash-out amount is zero');
            // Test invalid game session
            const invalidGame = {
                id: '', // Invalid empty ID
                dollar1: null,
                dollar2: null,
                winner: null,
                loser: null,
                level: 1,
                platformFee: 0.15, // Wrong fee amount
                timestamp: new Date(Date.now() + 10000), // Future timestamp
                gameNumber: 1,
                dailySeed: 'seed',
                dollar1Score: 0.8,
                dollar2Score: 0.6,
                winnings: -5.00 // Negative winnings
            };
            const invalidResult = revenueCalculator.processGameRevenue(invalidGame);
            expect(invalidResult.isValid).toBe(false);
            expect(invalidResult.errors.length).toBeGreaterThan(0);
        });
    });
});
//# sourceMappingURL=revenue-calculator-integration.test.js.map