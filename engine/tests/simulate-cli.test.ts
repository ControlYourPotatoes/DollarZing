import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { CashOutStrategy } from "../src/index";

import {
  buildSimulateConfig,
  executeSimulateCommand,
  parseStrategyDistribution,
  type SimulateCliOptions,
} from "../cli/src/commands/simulate";

vi.mock("../cli/src/commands/shared/simulation-runner.js", () => {
  return {
    runSimulation: vi.fn(async () => ({
      results: {
        success: true,
        simulationDurationMs: 100,
        summary: {
          totalDays: 1,
          totalPlayers: 10,
          simulationCompleted: true,
        },
        config: {},
        playerStats: {
          totalPlayers: 10,
          activePlayers: 10,
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
          charityPercentage: 0.2,
          averageRevenuePerDay: 0,
        },
        gameStats: {
          totalGames: 0,
          averageGamesPerDay: 0,
          totalVirtualDollars: 0,
          completedRuns: 0,
          activeRuns: 0,
          jackpotsWon: 0,
          averageRunLength: 0,
        },
        dailyResults: [],
        completedAt: new Date(),
      },
      profile: {
        name: "development",
        description: undefined,
        config: {
          durationDays: 7,
          initialPlayerCount: 50,
          charityPercentage: 0.2,
          growthModel: {
            adoptionRate: 0.1,
            baseMarket: 10000,
            midpointDay: 3,
            steepnessFactor: 20,
          },
          playerStrategies: {},
          dailySeed: "seed",
          initialDonationAmount: 25,
          maxSimulationTimeMs: 60000,
          enableProgressReporting: false,
        },
        runtime: {
          enablePooling: true,
          attachDebugger: true,
          virtualDollarsPerPlayer: 1,
          enableSanityMetrics: true,
        },
      },
      runtime: {
        enablePooling: true,
        attachDebugger: true,
        virtualDollarsPerPlayer: 1,
        enableSanityMetrics: true,
      },
      durationMs: 100,
    })),
    printSimulationSummary: vi.fn(),
    DEFAULT_STRATEGY_DISTRIBUTION: {
      CONSERVATIVE: 0.4,
      BALANCED: 0.4,
      AGGRESSIVE: 0.2,
    },
  };
});

let mockedRunnerModule: Awaited<
  ReturnType<typeof import("../cli/src/commands/shared/simulation-runner.js")>
>;

beforeAll(async () => {
  mockedRunnerModule = await import(
    "../cli/src/commands/shared/simulation-runner.js"
  );
});

describe("simulate CLI config builder", () => {
  it("should build default configuration", () => {
    const config = buildSimulateConfig({});

    expect(config.profile).toBe("development");
    expect(config.days).toBe(7);
    expect(config.players).toBe(50);
    expect(config.charityRate).toBeCloseTo(0.2);
    expect(config.dollarsPerPlayer).toBe(1);
    expect(config.noPooling).toBe(false);
    expect(config.initialDonation).toBe(25);
    expect(config.maxSimulationTimeMs).toBe(60000);
    expect(config.debugDashboard).toBe(true);
  });

  it("should parse production profile with overrides", () => {
    const config = buildSimulateConfig({
      profile: "production",
      days: "30",
      players: "200",
      dollarsPerPlayer: "3",
      charity: "15",
      seed: "custom-seed",
      pooling: false,
      verbose: true,
      initialDonation: "40",
      maxSimulationTime: "120000",
    });

    expect(config.profile).toBe("production");
    expect(config.days).toBe(30);
    expect(config.players).toBe(200);
    expect(config.dollarsPerPlayer).toBe(3);
    expect(config.charityRate).toBeCloseTo(0.15);
    expect(config.seed).toBe("custom-seed");
    expect(config.noPooling).toBe(true);
    expect(config.verbose).toBe(true);
    expect(config.initialDonation).toBe(40);
    expect(config.maxSimulationTimeMs).toBe(120000);
    expect(config.debugDashboard).toBe(false);
  });

  it("should parse strategy distribution string", () => {
    const distribution = parseStrategyDistribution(
      "conservative=0.25,balanced=0.5,aggressive=0.25"
    );

    expect(distribution).toEqual({
      [CashOutStrategy.CONSERVATIVE]: 0.25,
      [CashOutStrategy.BALANCED]: 0.5,
      [CashOutStrategy.AGGRESSIVE]: 0.25,
    });
  });

  it("should normalise percentage-based strategy input", () => {
    const distribution = parseStrategyDistribution(
      "conservative=40,balanced=40,aggressive=20"
    );

    expect(distribution).toEqual({
      [CashOutStrategy.CONSERVATIVE]: 0.4,
      [CashOutStrategy.BALANCED]: 0.4,
      [CashOutStrategy.AGGRESSIVE]: 0.2,
    });
  });

  it("should throw on invalid profile", () => {
    expect(() => buildSimulateConfig({ profile: "qa" })).toThrow(
      "Profile must be either 'development' or 'production'"
    );
  });

  it("should throw on invalid numeric values", () => {
    expect(() => buildSimulateConfig({ days: "0" })).toThrow(
      "Days must be between 1 and 365"
    );
  });
});

describe("executeSimulateCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should execute simulation with parsed configuration", async () => {
    const options = {
      profile: "production",
      days: "10",
      players: "100",
      dollarsPerPlayer: "2",
      charity: "25",
      seed: "abc",
      pooling: false,
      verbose: true,
      initialDonation: "30",
      strategies: "conservative=0.3,balanced=0.4,aggressive=0.3",
      maxSimulationTime: "90000",
    } satisfies SimulateCliOptions;

    await executeSimulateCommand(options);

    const runSimulationMock =
      mockedRunnerModule.runSimulation as unknown as vi.Mock;
    const summaryMock =
      mockedRunnerModule.printSimulationSummary as unknown as vi.Mock;

    expect(runSimulationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: "production",
        days: 10,
        players: 100,
        charityRate: 0.25,
        seed: "abc",
        noPooling: true,
        dollarsPerPlayer: 2,
        initialDonation: 30,
        maxSimulationTimeMs: 90000,
        debugDashboard: false,
      })
    );
    expect(summaryMock).toHaveBeenCalled();
  });
});
