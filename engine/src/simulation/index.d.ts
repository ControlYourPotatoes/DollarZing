import { SimulationDataset, SimulationParameters, LevelStatistics, PlayerJourney, RevenueBreakdown, FlowType, CashOutStrategy } from "../types/simulation-types";
export declare class PlayerBehaviorModel {
    private billsPerDayRanges;
    getCashOutProbability(level: number, strategy: CashOutStrategy): number;
    getBillsPerDay(strategy: CashOutStrategy, randomValue: number): number;
    simulatePlayerJourney(playerId: string, strategy: CashOutStrategy, daysActive: number): PlayerJourney;
}
export declare class GrowthCalculator {
    calculateOrganicGrowth(day: number, currentPlayers: number, growthMultiplier: number, randomSeed: number): number;
    calculateAdoptionGrowth(day: number, currentPlayers: number, adoptionRate: number, randomSeed: number): number;
}
export declare class LevelProgressionCalculator {
    private behaviorModel;
    calculateLevelStatistics(level: number, gamesAtLevel: number, strategy: CashOutStrategy, randomSeed: number): LevelStatistics;
}
export declare class RevenueDistributionCalculator {
    calculateRevenueBreakdown(amount: number, flowType: FlowType): RevenueBreakdown;
}
export declare class SimulationEngine {
    private parameters;
    private behaviorModel;
    private growthCalculator;
    private progressionCalculator;
    private revenueCalculator;
    constructor(parameters: SimulationParameters);
    getParameters(): SimulationParameters;
    updateParameters(newParameters: SimulationParameters): void;
    generateYearlyDataset(): Promise<SimulationDataset>;
    private simulateDay;
    private generateYearlyAggregation;
}
//# sourceMappingURL=index.d.ts.map