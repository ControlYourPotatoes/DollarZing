// Core Simulation Engine for DollarZing
// Generates yearly datasets with enhanced data structures and performance optimizations

import {
  SimulationDataset,
  SimulationParameters,
  DailySnapshot,
  PlayerMetrics,
  FinancialMetrics,
  LevelStatistics,
  PlayerJourney,
  RevenueBreakdown,
  FlowType,
  CashOutStrategy,
} from "../types/simulation-types";
import { validateSimulationParameters } from "../utils/validation";

// Constants from legacy system
const LEVELS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
const PLATFORM_FEE = 0.2;

// Seeded random number generator for consistent results
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

// Player Behavior Model
export class PlayerBehaviorModel {
  private billsPerDayRanges = {
    low: { min: 1, max: 4 },
    average: { min: 5, max: 7 },
    high: { min: 8, max: 12 },
  };

  getCashOutProbability(level: number, strategy: CashOutStrategy): number {
    switch (strategy) {
      case "low":
        return Math.max(0.9 - level / 20, 0.1); // More aggressive decrease
      case "average":
        return 0.3;
      case "high":
        return Math.min(0.1 + level / 20, 0.9); // More aggressive increase
      default:
        return 0.3;
    }
  }

  getBillsPerDay(strategy: CashOutStrategy, randomValue: number): number {
    const range = this.billsPerDayRanges[strategy];
    return Math.floor(randomValue * (range.max - range.min + 1)) + range.min;
  }

  simulatePlayerJourney(
    playerId: string,
    strategy: CashOutStrategy,
    daysActive: number
  ): PlayerJourney {
    const startDate = new Date();
    const endDate = new Date(
      startDate.getTime() + daysActive * 24 * 60 * 60 * 1000
    );
    const rng = new SeededRandom(playerId.charCodeAt(0) * 1000 + daysActive);

    let totalGamesPlayed = 0;
    let maxLevelReached = 1;
    let totalWinnings = 0;
    let totalLosses = 0;
    const cashOutEvents: any[] = [];
    const levelProgression: any[] = [];

    // Simulate daily activity
    for (let day = 0; day < daysActive; day++) {
      const dailyBills = this.getBillsPerDay(strategy, rng.next());
      let currentGames = dailyBills;

      // Progress through levels
      for (
        let levelIndex = 0;
        levelIndex < LEVELS.length && currentGames > 0;
        levelIndex++
      ) {
        const level = levelIndex + 1;
        const gamesAtLevel = currentGames;
        const winnersAtLevel = Math.floor(gamesAtLevel / 2);
        const cashOutProbability = this.getCashOutProbability(level, strategy);
        const cashOutPlayers = Math.floor(winnersAtLevel * cashOutProbability);

        totalGamesPlayed += gamesAtLevel;
        maxLevelReached = Math.max(maxLevelReached, level);

        // Record level progression
        const existingLevel = levelProgression.find((l) => l.level === level);
        if (existingLevel) {
          existingLevel.gamesAtLevel += gamesAtLevel;
          existingLevel.timeSpentMinutes += gamesAtLevel * 2; // 2 mins per game
        } else {
          levelProgression.push({
            level,
            gamesAtLevel,
            timeSpentMinutes: gamesAtLevel * 2,
          });
        }

        // Handle cash-outs and winnings
        if (level === 10) {
          // Jackpot level
          totalWinnings += cashOutPlayers * 1024;
          cashOutEvents.push({
            day: day + 1,
            level: 10,
            amount: 1024,
            strategy,
          });
        } else if (cashOutPlayers > 0) {
          const winAmount = cashOutPlayers * LEVELS[levelIndex] * 2;
          totalWinnings += winAmount;
          cashOutEvents.push({
            day: day + 1,
            level,
            amount: winAmount,
            strategy,
          });
        }

        // Calculate losses (unsuccessful games)
        totalLosses += (gamesAtLevel - winnersAtLevel) * LEVELS[levelIndex];

        // Calculate next level games
        currentGames = level === 10 ? 0 : winnersAtLevel - cashOutPlayers;
      }
    }

    return {
      playerId,
      startDate,
      endDate,
      totalGamesPlayed,
      maxLevelReached,
      totalWinnings,
      totalLosses,
      netGain: totalWinnings - totalLosses,
      cashOutEvents,
      levelProgression,
    };
  }
}

// Growth Calculator
export class GrowthCalculator {
  calculateOrganicGrowth(
    day: number,
    currentPlayers: number,
    growthMultiplier: number,
    randomSeed: number
  ): number {
    const rng = new SeededRandom(day * 1000 + Math.floor(randomSeed * 10000));
    const baseGrowthRate = 0.01;
    const randomFactor = (rng.next() + 0.5) * 0.02; // Reduced randomness
    const timeFactor = Math.log(day + 1) / 10;
    const effectiveGrowthRate =
      (baseGrowthRate + randomFactor) * (1 + timeFactor) * growthMultiplier;

    return Math.floor(currentPlayers * (1 + effectiveGrowthRate));
  }

  calculateAdoptionGrowth(
    day: number,
    currentPlayers: number,
    adoptionRate: number,
    randomSeed: number
  ): number {
    const rng = new SeededRandom(day * 1000 + Math.floor(randomSeed * 10000));

    // S-curve adoption model for market penetration
    const baseMarket = 1000000; // Base addressable market
    const maxAdoption = baseMarket * adoptionRate;
    const midpoint = 90; // Day when adoption reaches 50%

    // Calculate adoption progress using logistic function
    const x = (day - midpoint) / 20; // Scale factor for curve steepness
    const adoptionProgress = 1 / (1 + Math.exp(-x));

    // Add randomness to adoption
    const randomFactor = 0.9 + rng.next() * 0.2; // ±10% variation

    const targetPlayers = Math.floor(
      maxAdoption * adoptionProgress * randomFactor
    );

    // Ensure monotonic growth (no player loss)
    return Math.max(currentPlayers, targetPlayers);
  }
}

// Level Progression Calculator
export class LevelProgressionCalculator {
  private behaviorModel = new PlayerBehaviorModel();

  calculateLevelStatistics(
    level: number,
    gamesAtLevel: number,
    strategy: CashOutStrategy,
    randomSeed: number
  ): LevelStatistics {
    const rng = new SeededRandom(level * 1000 + Math.floor(randomSeed * 10000));

    const successRate =
      level === 10
        ? 1.0
        : this.behaviorModel.getCashOutProbability(level, strategy);
    const avgTimeAtLevel = 5 + level * 2 + rng.next() * 3; // Base time + level factor + random

    // Calculate bottleneck score (higher at difficult transition points)
    let bottleneckScore = 0;
    if (level < 10) {
      const difficultyFactor = level / 10;
      const strategyFactor =
        strategy === "high" ? 0.8 : strategy === "low" ? 0.2 : 0.5;
      bottleneckScore = difficultyFactor * (1 - strategyFactor);
    }

    return {
      level,
      gamesAtLevel,
      successRate,
      avgTimeAtLevel,
      bottleneckScore: Math.min(1, Math.max(0, bottleneckScore)),
    };
  }
}

// Revenue Distribution Calculator
export class RevenueDistributionCalculator {
  calculateRevenueBreakdown(
    amount: number,
    flowType: FlowType
  ): RevenueBreakdown {
    let platformPerc = 0.2;
    let charityPerc = 0.2;
    let playerPerc = 0.6; // Simplified: 60% to players

    // Adjust distribution based on flow type
    if (flowType === "loss") {
      // For losses, reduce player share
      playerPerc = 0.4;
      charityPerc = 0.4;
    } else if (flowType === "jackpot") {
      // For jackpots, players get more
      playerPerc = 0.8;
      charityPerc = 0.0;
    }

    return {
      platform: { amount: amount * platformPerc, percentage: platformPerc },
      charity: { amount: amount * charityPerc, percentage: charityPerc },
      players: { amount: amount * playerPerc, percentage: playerPerc },
    };
  }
}

// Main Simulation Engine
export class SimulationEngine {
  private parameters: SimulationParameters;
  private behaviorModel: PlayerBehaviorModel;
  private growthCalculator: GrowthCalculator;
  private progressionCalculator: LevelProgressionCalculator;
  private revenueCalculator: RevenueDistributionCalculator;

  constructor(parameters: SimulationParameters) {
    // Validate parameters
    const validation = validateSimulationParameters(parameters);
    if (!validation.isValid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(", ")}`);
    }

    // Additional validation for engine-specific constraints
    if (parameters.adoptionRate < 0 || parameters.adoptionRate > 1) {
      throw new Error("Invalid adoption rate");
    }
    if (parameters.growthMultiplier < 0) {
      throw new Error("Invalid growth multiplier");
    }
    if (!["low", "average", "high"].includes(parameters.cashOutStrategy)) {
      throw new Error("Invalid cash-out strategy");
    }

    this.parameters = { ...parameters };
    this.behaviorModel = new PlayerBehaviorModel();
    this.growthCalculator = new GrowthCalculator();
    this.progressionCalculator = new LevelProgressionCalculator();
    this.revenueCalculator = new RevenueDistributionCalculator();
  }

  getParameters(): SimulationParameters {
    return { ...this.parameters };
  }

  updateParameters(newParameters: SimulationParameters): void {
    const validation = validateSimulationParameters(newParameters);
    if (!validation.isValid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(", ")}`);
    }
    this.parameters = { ...newParameters };
  }

  async generateYearlyDataset(): Promise<SimulationDataset> {
    const startTime = performance.now();
    const initialMemory = process.memoryUsage().heapUsed;

    const dataset: SimulationDataset = {
      id: `simulation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      version: "1.0.0",
      createdAt: new Date(),
      updatedAt: new Date(),
      parameters: this.parameters,
      metadata: {
        generationDurationMs: 0, // Will be updated at end
        dataPoints: 365,
        memoryUsageMB: 0, // Will be updated at end
        accuracy: 0.98, // Base accuracy score
      },
      dailySnapshots: [],
      aggregations: {
        weekly: [],
        monthly: [],
        yearly: null,
      },
    };

    // Initialize state
    let currentPlayers = 1000; // Starting player count
    let activePlayers = 1000;

    // Generate daily snapshots
    for (let day = 1; day <= 365; day++) {
      const dailySnapshot = await this.simulateDay(
        day,
        currentPlayers,
        activePlayers
      );
      dataset.dailySnapshots.push(dailySnapshot);

      // Update player counts for next day
      currentPlayers = dailySnapshot.playerMetrics.totalPlayers;
      activePlayers = dailySnapshot.playerMetrics.activePlayers;

      // Progress callback for potential UI updates
      if (day % 30 === 0) {
        // Allow other operations to run
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    // Calculate final metrics
    const endTime = performance.now();
    const finalMemory = process.memoryUsage().heapUsed;

    dataset.metadata.generationDurationMs = endTime - startTime;
    dataset.metadata.memoryUsageMB =
      (finalMemory - initialMemory) / (1024 * 1024);
    dataset.updatedAt = new Date();

    // Generate aggregations (simplified for now)
    dataset.aggregations.yearly = this.generateYearlyAggregation(
      dataset.dailySnapshots
    );

    return dataset;
  }

  private async simulateDay(
    day: number,
    totalPlayers: number,
    activePlayers: number
  ): Promise<DailySnapshot> {
    const rng = new SeededRandom(day);

    // Calculate new player metrics
    let newTotalPlayers = totalPlayers;
    let newActivePlayers = activePlayers;

    if (this.parameters.adoptionRate > 0) {
      newActivePlayers = this.growthCalculator.calculateAdoptionGrowth(
        day,
        activePlayers,
        this.parameters.adoptionRate,
        rng.next()
      );
    } else {
      newActivePlayers = this.growthCalculator.calculateOrganicGrowth(
        day,
        activePlayers,
        this.parameters.growthMultiplier,
        rng.next()
      );
    }

    newTotalPlayers = Math.max(newTotalPlayers, newActivePlayers);

    const playerMetrics: PlayerMetrics = {
      totalPlayers: newTotalPlayers,
      activePlayers: newActivePlayers,
      newPlayers: Math.max(0, newActivePlayers - activePlayers),
      churnedPlayers: Math.max(0, activePlayers - newActivePlayers),
      retentionRate: activePlayers > 0 ? newActivePlayers / activePlayers : 1,
    };

    // Calculate initial games for the day
    let initialGames = 0;
    for (let i = 0; i < newActivePlayers; i++) {
      initialGames += this.behaviorModel.getBillsPerDay(
        this.parameters.cashOutStrategy,
        rng.next()
      );
    }

    // Simulate level progression and calculate financials
    let totalRevenue = 0;
    let platformEarnings = 0;
    let charityContributions = 0;
    let playerWinnings = 0;
    let totalGamesPlayed = 0;
    let jackpotWinners = 0;

    const levelProgression: LevelStatistics[] = [];
    let gamesAtCurrentLevel = initialGames;

    // Process each level
    for (let levelIndex = 0; levelIndex < LEVELS.length; levelIndex++) {
      if (gamesAtCurrentLevel <= 0) break;

      const level = levelIndex + 1;
      const levelValue = LEVELS[levelIndex];

      totalGamesPlayed += gamesAtCurrentLevel;

      // Platform earnings
      const platformAtLevel = gamesAtCurrentLevel * PLATFORM_FEE;
      platformEarnings += platformAtLevel;

      // Calculate winners and cash-outs
      let cashOutPlayers: number;
      let winningsToDistribute: number;

      if (level === 10) {
        // Jackpot level - everyone wins
        cashOutPlayers = gamesAtCurrentLevel;
        winningsToDistribute = gamesAtCurrentLevel * 1024;
        jackpotWinners += gamesAtCurrentLevel;
      } else {
        const winnersAtLevel = Math.floor(gamesAtCurrentLevel / 2);
        const cashOutProbability = this.behaviorModel.getCashOutProbability(
          level,
          this.parameters.cashOutStrategy
        );
        cashOutPlayers = Math.floor(winnersAtLevel * cashOutProbability);
        winningsToDistribute = cashOutPlayers * levelValue * 1.8; // Match CryptoZing's winnings structure
      }

      // Distribute revenue
      const breakdown = this.revenueCalculator.calculateRevenueBreakdown(
        winningsToDistribute,
        level === 10 ? "jackpot" : "cashout"
      );

      charityContributions += breakdown.charity.amount;
      playerWinnings += breakdown.players.amount;
      totalRevenue += winningsToDistribute;

      // Calculate level statistics
      const levelStats = this.progressionCalculator.calculateLevelStatistics(
        level,
        gamesAtCurrentLevel,
        this.parameters.cashOutStrategy,
        rng.next()
      );
      levelProgression.push(levelStats);

      // Calculate next level games
      gamesAtCurrentLevel =
        level === 10 ? 0 : Math.floor(gamesAtCurrentLevel / 2) - cashOutPlayers;
    }

    const financialMetrics: FinancialMetrics = {
      totalRevenue: platformEarnings + charityContributions + playerWinnings,
      platformEarnings,
      charityContributions,
      playerWinnings,
      gamesPlayed: totalGamesPlayed,
    };

    return {
      day,
      date: new Date(2025, 0, day), // January 1, 2025 + days
      playerMetrics,
      financialMetrics,
      levelProgression,
      playerJourneys: [], // Will be populated by separate process if needed
    };
  }

  private generateYearlyAggregation(dailySnapshots: DailySnapshot[]) {
    const totals = dailySnapshots.reduce(
      (acc, snapshot) => ({
        totalPlayers: Math.max(
          acc.totalPlayers,
          snapshot.playerMetrics.totalPlayers
        ),
        totalRevenue: acc.totalRevenue + snapshot.financialMetrics.totalRevenue,
        totalGames: acc.totalGames + snapshot.financialMetrics.gamesPlayed,
      }),
      { totalPlayers: 0, totalRevenue: 0, totalGames: 0 }
    );

    const avgDaily = {
      players: totals.totalPlayers / dailySnapshots.length,
      revenue: totals.totalRevenue / dailySnapshots.length,
      games: totals.totalGames / dailySnapshots.length,
    };

    // Find peak day
    const peakDay = dailySnapshots.reduce((peak, snapshot) =>
      snapshot.financialMetrics.totalRevenue >
      peak.financialMetrics.totalRevenue
        ? snapshot
        : peak
    );

    return {
      year: 2025,
      aggregatedPlayerMetrics: {
        totalPlayers: totals.totalPlayers,
        activePlayers:
          dailySnapshots[dailySnapshots.length - 1].playerMetrics.activePlayers,
        newPlayers: dailySnapshots.reduce(
          (sum, s) => sum + s.playerMetrics.newPlayers,
          0
        ),
        churnedPlayers: dailySnapshots.reduce(
          (sum, s) => sum + s.playerMetrics.churnedPlayers,
          0
        ),
        retentionRate:
          dailySnapshots.reduce(
            (sum, s) => sum + s.playerMetrics.retentionRate,
            0
          ) / dailySnapshots.length,
      },
      aggregatedFinancialMetrics: {
        totalRevenue: totals.totalRevenue,
        platformEarnings: dailySnapshots.reduce(
          (sum, s) => sum + s.financialMetrics.platformEarnings,
          0
        ),
        charityContributions: dailySnapshots.reduce(
          (sum, s) => sum + s.financialMetrics.charityContributions,
          0
        ),
        playerWinnings: dailySnapshots.reduce(
          (sum, s) => sum + s.financialMetrics.playerWinnings,
          0
        ),
        gamesPlayed: totals.totalGames,
      },
      annualGrowthRate:
        dailySnapshots.length > 1
          ? (dailySnapshots[dailySnapshots.length - 1].playerMetrics
              .activePlayers -
              dailySnapshots[0].playerMetrics.activePlayers) /
            dailySnapshots[0].playerMetrics.activePlayers
          : 0,
      totalDataPoints: dailySnapshots.length,
      performanceMetrics: {
        peakDay: peakDay.day,
        peakPlayers: peakDay.playerMetrics.activePlayers,
        peakRevenue: peakDay.financialMetrics.totalRevenue,
        averageDaily: avgDaily,
      },
    };
  }
}
