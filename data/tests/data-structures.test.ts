import { 
  SimulationDataset, 
  DailySnapshot, 
  PlayerJourney, 
  LevelProgressionData, 
  FinancialFlowRecord
} from '../src/types/index';

describe('Enhanced Data Structures', () => {
  describe('SimulationDataset', () => {
    it('should create dataset with metadata', () => {
      const dataset: SimulationDataset = {
        id: 'test-dataset-001',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        parameters: {
          cashOutStrategy: 'average',
          adoptionRate: 0.05,
          growthMultiplier: 1.2,
          panamaAdoption: true
        },
        metadata: {
          generationDurationMs: 4500,
          dataPoints: 365,
          memoryUsageMB: 85,
          accuracy: 0.99
        },
        dailySnapshots: [],
        aggregations: {
          weekly: [],
          monthly: [],
          yearly: null
        }
      };

      expect(dataset.id).toBe('test-dataset-001');
      expect(dataset.parameters.cashOutStrategy).toBe('average');
      expect(dataset.metadata.generationDurationMs).toBe(4500);
    });

    it('should validate parameter constraints', () => {
      // Test will be expanded once validation is implemented
      expect(true).toBe(true);
    });
  });

  describe('DailySnapshot', () => {
    it('should create complete daily snapshot', () => {
      const snapshot: DailySnapshot = {
        day: 100,
        date: new Date('2025-04-10'),
        playerMetrics: {
          totalPlayers: 50000,
          activePlayers: 12500,
          newPlayers: 500,
          churnedPlayers: 100,
          retentionRate: 0.92
        },
        financialMetrics: {
          totalRevenue: 125000,
          platformEarnings: 25000,
          charityContributions: 25000,
          governmentEarnings: 50000,
          playerWinnings: 50000,
          gamesPlayed: 8750
        },
        levelProgression: Array.from({ length: 10 }, (_, i) => ({
          level: i + 1,
          gamesAtLevel: 1000 - (i * 90),
          successRate: 0.5 - (i * 0.02),
          avgTimeAtLevel: 5 + (i * 2),
          bottleneckScore: i * 0.1
        })),
        playerJourneys: []
      };

      expect(snapshot.day).toBe(100);
      expect(snapshot.playerMetrics.totalPlayers).toBe(50000);
      expect(snapshot.financialMetrics.totalRevenue).toBe(125000);
      expect(snapshot.levelProgression).toHaveLength(10);
    });

    it('should maintain financial consistency', () => {
      const snapshot: DailySnapshot = {
        day: 50,
        date: new Date(),
        playerMetrics: {
          totalPlayers: 25000,
          activePlayers: 6250,
          newPlayers: 250,
          churnedPlayers: 50,
          retentionRate: 0.95
        },
        financialMetrics: {
          totalRevenue: 120000,
          platformEarnings: 20000,
          charityContributions: 20000, 
          governmentEarnings: 40000,
          playerWinnings: 40000,
          gamesPlayed: 7000
        },
        levelProgression: [],
        playerJourneys: []
      };

      const { financialMetrics } = snapshot;
      const calculatedTotal = financialMetrics.platformEarnings + 
                            financialMetrics.charityContributions + 
                            financialMetrics.governmentEarnings + 
                            financialMetrics.playerWinnings;
      
      expect(calculatedTotal).toBe(financialMetrics.totalRevenue);
    });
  });

  describe('PlayerJourney', () => {
    it('should track complete player progression', () => {
      const journey: PlayerJourney = {
        playerId: 'player-12345',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-30'),
        totalGamesPlayed: 45,
        maxLevelReached: 7,
        totalWinnings: 2500,
        totalLosses: 1800,
        netGain: 700,
        cashOutEvents: [
          {
            day: 5,
            level: 3,
            amount: 400,
            strategy: 'average'
          },
          {
            day: 15,
            level: 5,
            amount: 1200,
            strategy: 'average'
          }
        ],
        levelProgression: [
          { level: 1, gamesAtLevel: 12, timeSpentMinutes: 240 },
          { level: 2, gamesAtLevel: 8, timeSpentMinutes: 180 },
          { level: 3, gamesAtLevel: 10, timeSpentMinutes: 220 },
          { level: 4, gamesAtLevel: 6, timeSpentMinutes: 140 },
          { level: 5, gamesAtLevel: 7, timeSpentMinutes: 160 },
          { level: 6, gamesAtLevel: 2, timeSpentMinutes: 50 },
          { level: 7, gamesAtLevel: 0, timeSpentMinutes: 0 }
        ]
      };

      expect(journey.playerId).toBe('player-12345');
      expect(journey.maxLevelReached).toBe(7);
      expect(journey.netGain).toBe(700);
      expect(journey.cashOutEvents).toHaveLength(2);
      expect(journey.levelProgression).toHaveLength(7);
    });

    it('should calculate accurate progression metrics', () => {
      const journey: PlayerJourney = {
        playerId: 'player-67890',
        startDate: new Date('2025-02-01'),
        endDate: new Date('2025-02-28'),
        totalGamesPlayed: 30,
        maxLevelReached: 5,
        totalWinnings: 1800,
        totalLosses: 1200,
        netGain: 600,
        cashOutEvents: [
          { day: 10, level: 4, amount: 800, strategy: 'high' },
          { day: 20, level: 5, amount: 1600, strategy: 'high' }
        ],
        levelProgression: [
          { level: 1, gamesAtLevel: 10, timeSpentMinutes: 200 },
          { level: 2, gamesAtLevel: 8, timeSpentMinutes: 160 },
          { level: 3, gamesAtLevel: 6, timeSpentMinutes: 120 },
          { level: 4, gamesAtLevel: 4, timeSpentMinutes: 80 },
          { level: 5, gamesAtLevel: 2, timeSpentMinutes: 40 }
        ]
      };

      const totalGamesFromProgression = journey.levelProgression.reduce(
        (sum, level) => sum + level.gamesAtLevel, 0
      );
      
      expect(totalGamesFromProgression).toBe(journey.totalGamesPlayed);
      expect(journey.totalWinnings - journey.totalLosses).toBe(journey.netGain);
    });
  });

  describe('LevelProgressionData', () => {
    it('should provide comprehensive level analytics', () => {
      const levelData: LevelProgressionData = {
        level: 5,
        gamesAtLevel: 2500,
        successRate: 0.48,
        avgTimeAtLevel: 12,
        bottleneckScore: 0.35,
        playerDistribution: {
          newPlayers: 800,
          returningPlayers: 1200,
          advancedPlayers: 500
        },
        cashOutPatterns: {
          low: { count: 600, avgAmount: 800, successRate: 0.52 },
          average: { count: 1200, avgAmount: 1200, successRate: 0.48 },
          high: { count: 700, avgAmount: 2000, successRate: 0.44 }
        },
        financialImpact: {
          totalRevenue: 87500,
          platformShare: 17500,
          charityShare: 17500,
          governmentShare: 35000,
          playerShare: 35000
        }
      };

      expect(levelData.level).toBe(5);
      expect(levelData.successRate).toBe(0.48);
      expect(levelData.bottleneckScore).toBe(0.35);
      
      const totalPlayers = levelData.playerDistribution.newPlayers + 
                          levelData.playerDistribution.returningPlayers + 
                          levelData.playerDistribution.advancedPlayers;
      expect(totalPlayers).toBe(levelData.gamesAtLevel);

      const totalCashOuts = levelData.cashOutPatterns.low.count + 
                           levelData.cashOutPatterns.average.count + 
                           levelData.cashOutPatterns.high.count;
      expect(totalCashOuts).toBe(levelData.gamesAtLevel);
    });
  });

  describe('FinancialFlowRecord', () => {
    it('should track detailed revenue flows', () => {
      const flowRecord: FinancialFlowRecord = {
        timestamp: new Date(),
        transactionId: 'txn-abc123',
        level: 6,
        playerCount: 1,
        baseAmount: 3200,
        revenueBreakdown: {
          platform: { amount: 640, percentage: 0.2 },
          charity: { amount: 640, percentage: 0.2 },
          government: { amount: 1280, percentage: 0.4 },
          players: { amount: 640, percentage: 0.2 }
        },
        flowType: 'cashout',
        metadata: {
          cashOutStrategy: 'high',
          playerExperience: 'advanced',
          timeAtLevel: 8
        }
      };

      expect(flowRecord.level).toBe(6);
      expect(flowRecord.baseAmount).toBe(3200);
      
      const totalRevenue = Object.values(flowRecord.revenueBreakdown)
        .reduce((sum, breakdown) => sum + breakdown.amount, 0);
      expect(totalRevenue).toBe(flowRecord.baseAmount);

      const totalPercentage = Object.values(flowRecord.revenueBreakdown)
        .reduce((sum, breakdown) => sum + breakdown.percentage, 0);
      expect(totalPercentage).toBeCloseTo(1.0, 2);
    });

    it('should handle different transaction types', () => {
      const lossRecord: FinancialFlowRecord = {
        timestamp: new Date(),
        transactionId: 'txn-def456',
        level: 8,
        playerCount: 5,
        baseAmount: 12800,
        revenueBreakdown: {
          platform: { amount: 2560, percentage: 0.2 },
          charity: { amount: 2560, percentage: 0.2 },
          government: { amount: 5120, percentage: 0.4 },
          players: { amount: 2560, percentage: 0.2 } // Different distribution for losses
        },
        flowType: 'loss',
        metadata: {
          cashOutStrategy: 'low',
          playerExperience: 'beginner',
          timeAtLevel: 15
        }
      };

      expect(lossRecord.flowType).toBe('loss');
      expect(lossRecord.playerCount).toBe(5);
      expect(lossRecord.revenueBreakdown.players.percentage).toBe(0.2);
    });
  });
});

describe('Data Structure Serialization', () => {
  it('should serialize and deserialize SimulationDataset', () => {
    const originalDataset: SimulationDataset = {
      id: 'serialize-test-001',
      version: '1.0.0',
      createdAt: new Date('2025-03-15T10:30:00Z'),
      updatedAt: new Date('2025-03-15T10:35:00Z'),
      parameters: {
        cashOutStrategy: 'high',
        adoptionRate: 0.08,
        growthMultiplier: 1.5,
        panamaAdoption: true
      },
      metadata: {
        generationDurationMs: 3200,
        dataPoints: 365,
        memoryUsageMB: 92,
        accuracy: 0.97
      },
      dailySnapshots: [],
      aggregations: {
        weekly: [],
        monthly: [],
        yearly: null
      }
    };

    const serialized = JSON.stringify(originalDataset);
    const deserialized: SimulationDataset = JSON.parse(serialized);

    // Restore Date objects after JSON parsing
    deserialized.createdAt = new Date(deserialized.createdAt);
    deserialized.updatedAt = new Date(deserialized.updatedAt);

    expect(deserialized.id).toBe(originalDataset.id);
    expect(deserialized.createdAt.getTime()).toBe(originalDataset.createdAt.getTime());
    expect(deserialized.parameters.cashOutStrategy).toBe(originalDataset.parameters.cashOutStrategy);
    expect(deserialized.metadata.generationDurationMs).toBe(originalDataset.metadata.generationDurationMs);
  });

  it('should handle large dataset serialization efficiently', () => {
    const largeDailySnapshots: DailySnapshot[] = Array.from({ length: 365 }, (_, i) => ({
      day: i + 1,
      date: new Date(2025, 0, i + 1),
      playerMetrics: {
        totalPlayers: 10000 + (i * 100),
        activePlayers: 2500 + (i * 25),
        newPlayers: 100 + (i * 2),
        churnedPlayers: 20 + Math.floor(i * 0.5),
        retentionRate: 0.9 + (i * 0.0001)
      },
      financialMetrics: {
        totalRevenue: 50000 + (i * 1000),
        platformEarnings: 10000 + (i * 200),
        charityContributions: 10000 + (i * 200),
        governmentEarnings: 20000 + (i * 400),
        playerWinnings: 20000 + (i * 400),
        gamesPlayed: 3500 + (i * 50)
      },
      levelProgression: Array.from({ length: 10 }, (_, level) => ({
        level: level + 1,
        gamesAtLevel: 500 - (level * 40) + (i * 5),
        successRate: 0.5 - (level * 0.02),
        avgTimeAtLevel: 5 + (level * 2),
        bottleneckScore: level * 0.1
      })),
      playerJourneys: []
    }));

    const dataset: SimulationDataset = {
      id: 'large-dataset-001',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      parameters: {
        cashOutStrategy: 'average',
        adoptionRate: 0.05,
        growthMultiplier: 1.2,
        panamaAdoption: false
      },
      metadata: {
        generationDurationMs: 4800,
        dataPoints: 365,
        memoryUsageMB: 95,
        accuracy: 0.98
      },
      dailySnapshots: largeDailySnapshots,
      aggregations: {
        weekly: [],
        monthly: [],
        yearly: null
      }
    };

    const startTime = performance.now();
    const serialized = JSON.stringify(dataset);
    const serializationTime = performance.now() - startTime;

    const deserializeStart = performance.now();
    const deserialized = JSON.parse(serialized);
    const deserializationTime = performance.now() - deserializeStart;

    expect(serialized.length).toBeGreaterThan(0);
    expect(deserialized.dailySnapshots).toHaveLength(365);
    expect(serializationTime).toBeLessThan(100); // Should serialize in under 100ms
    expect(deserializationTime).toBeLessThan(50); // Should deserialize in under 50ms
  });
});