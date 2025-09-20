import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createSimulationProfile,
  DEFAULT_RUNTIME_OPTIONS,
  DEFAULT_SIMULATION_PROFILE_NAME,
  SimulationProfileOverrides,
} from "./simulation-profiles";
import { GameEngineSimulator } from "./game-engine-simulator";
import type { SimulationConfig } from "./game-engine-simulator";
import { EventBus } from "../events/event-bus";
import { CashOutStrategy } from "../types/virtual-dollar-engine";
import { RevenueCalculator } from "../core/revenue-calculator";

const strategies = {
  [CashOutStrategy.CONSERVATIVE]: 0.4,
  [CashOutStrategy.BALANCED]: 0.4,
  [CashOutStrategy.AGGRESSIVE]: 0.2,
};

describe("Simulation Profile Builder", () => {
  it("should create a profile with default configuration and runtime options", () => {
    const profile = createSimulationProfile();

    expect(profile.name).toBe(DEFAULT_SIMULATION_PROFILE_NAME);
    expect(profile.config.durationDays).toBe(1);
    expect(profile.config.initialPlayerCount).toBe(10);
    expect(profile.config.charityPercentage).toBeCloseTo(0.2);
    expect(profile.config.playerStrategies).toEqual(strategies);
    expect(profile.config.maxSimulationTimeMs).toBe(60000);
    expect(profile.config.growthModel.midpointDay).toBe(1);

    expect(profile.runtime.enablePooling).toBe(true);
    expect(profile.runtime.attachDebugger).toBe(false);
    expect(profile.runtime.virtualDollarsPerPlayer).toBe(1);
    expect(profile.runtime.enableSanityMetrics).toBe(true);
  });

  it("should merge configuration overrides and recompute growth midpoint", () => {
    const profile = createSimulationProfile({
      name: "custom",
      config: {
        durationDays: 14,
        initialPlayerCount: 50,
        dailySeed: "custom-seed",
        charityPercentage: 0.15,
        playerStrategies: {
          [CashOutStrategy.CONSERVATIVE]: 0.2,
          [CashOutStrategy.BALANCED]: 0.5,
          [CashOutStrategy.AGGRESSIVE]: 0.3,
        },
        initialDonationAmount: 100,
        enableProgressReporting: true,
      },
    });

    expect(profile.name).toBe("custom");
    expect(profile.config.durationDays).toBe(14);
    expect(profile.config.initialPlayerCount).toBe(50);
    expect(profile.config.dailySeed).toBe("custom-seed");
    expect(profile.config.charityPercentage).toBeCloseTo(0.15);
    expect(profile.config.initialDonationAmount).toBe(100);
    expect(profile.config.enableProgressReporting).toBe(true);
    expect(profile.config.growthModel.midpointDay).toBe(7);
  });

  it("should merge runtime overrides without losing defaults", () => {
    const profile = createSimulationProfile({
      runtime: {
        enablePooling: false,
        virtualDollarsPerPlayer: 4,
      },
    } satisfies SimulationProfileOverrides);

    expect(profile.runtime.enablePooling).toBe(false);
    expect(profile.runtime.virtualDollarsPerPlayer).toBe(4);
    expect(profile.runtime.attachDebugger).toBe(false);
    expect(profile.runtime.enableSanityMetrics).toBe(true);
  });
});

describe("GameEngineSimulator profile execution", () => {
  let simulator: GameEngineSimulator;
  let runSimulationSpy: ReturnType<typeof vi.spyOn>;

  const stubResults = (config: SimulationConfig) => ({
    success: true,
    simulationDurationMs: 0,
    config,
    summary: {
      totalDays: config.durationDays,
      totalPlayers: config.initialPlayerCount,
      simulationCompleted: true,
    },
    playerStats: {
      totalPlayers: config.initialPlayerCount,
      activePlayers: config.initialPlayerCount,
      retiredPlayers: 0,
      totalDonationsFunds: 0,
      totalWinningsFunds: 0,
      totalProgressionFunds: 0,
      averageGamesPerPlayer: 0,
      playerRetirementRate: 0,
    },
    revenueStats: {
      totalPlatformRevenue: 0,
      totalCharityContributions: 0,
      totalPlayerPayouts: 0,
      revenuePerGame: 0,
      charityPercentage: config.charityPercentage,
      averageRevenuePerDay: 0,
    },
    gameStats: {
      totalGames: 0,
      averageGamesPerDay: 0,
      totalVirtualDollars: 0,
      totalRunsCreated: 0,
      completedRuns: 0,
      activeRuns: 0,
      jackpotsWon: 0,
      averageRunLength: 0,
    },
    dailyResults: [],
    completedAt: new Date(),
  });

  beforeEach(() => {
    const gameMatchingEngine = {
      setEventBus: vi.fn(),
      getPoolStatistics: vi.fn(() => ({
        totalDollarsInPool: 0,
        dollarsInGame: 0,
        availableForMatching: 0,
      })),
    };

    const virtualDollarFactory = {
      calculateLevelWinnings: vi.fn().mockReturnValue(0),
      advancePlayerLevel: vi.fn().mockReturnValue({ currentRunWinnings: 0 }),
      updateDollarState: vi.fn(),
      getDollar: vi.fn(),
      create: vi.fn(),
    };

    const revenueCalculator = new RevenueCalculator();

    const dayProcessor = { processDay: vi.fn() };
    const playerManager = {};
    const eventBus = new EventBus();

    simulator = new GameEngineSimulator(
      gameMatchingEngine as any,
      virtualDollarFactory as any,
      revenueCalculator,
      dayProcessor as any,
      playerManager as any,
      eventBus
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should apply default runtime options when receiving raw config", async () => {
    const config: SimulationConfig = {
      durationDays: 2,
      initialPlayerCount: 5,
      dailySeed: "test",
      charityPercentage: 0.2,
      playerStrategies: {
        [CashOutStrategy.CONSERVATIVE]: 0.4,
        [CashOutStrategy.BALANCED]: 0.4,
        [CashOutStrategy.AGGRESSIVE]: 0.2,
      },
      initialDonationAmount: 25,
      maxSimulationTimeMs: 1000,
      enableProgressReporting: false,
      growthModel: {
        adoptionRate: 0.1,
        baseMarket: 10000,
        midpointDay: 1,
        steepnessFactor: 20,
      },
    };

    const results = stubResults(config);
    runSimulationSpy = vi
      .spyOn(simulator as any, "runSimulation")
      .mockResolvedValue(results);

    const outcome = await simulator.executeSimulation(config);

    expect(outcome).toBe(results);
    expect(runSimulationSpy).toHaveBeenCalledTimes(1);
    expect(simulator.getRuntimeOptions()).toEqual(DEFAULT_RUNTIME_OPTIONS);
    expect((simulator as any).config).toEqual(config);
    expect(simulator.getActiveProfileName()).toBe(DEFAULT_SIMULATION_PROFILE_NAME);
  });

  it("should apply runtime overrides from simulation profile", async () => {
    const profile = createSimulationProfile({
      name: "profile-test",
      config: {
        durationDays: 3,
        initialPlayerCount: 8,
        dailySeed: "profile-seed",
      },
      runtime: {
        enablePooling: false,
        attachDebugger: true,
        virtualDollarsPerPlayer: 3,
      },
    });

    const results = stubResults(profile.config);
    runSimulationSpy = vi
      .spyOn(simulator as any, "runSimulation")
      .mockResolvedValue(results);

    const outcome = await simulator.executeSimulation(profile);

    expect(outcome).toBe(results);
    expect(runSimulationSpy).toHaveBeenCalledTimes(1);
    expect(simulator.getRuntimeOptions()).toEqual({
      enablePooling: false,
      attachDebugger: true,
      virtualDollarsPerPlayer: 3,
      enableSanityMetrics: true,
    });
    expect(simulator.getActiveProfileName()).toBe("profile-test");
    expect((simulator as any).config).toEqual(profile.config);
  });
});
