import { describe, it, expect, beforeEach, vi } from "vitest";
import type { EventDebugInterface } from "../src/events/debug";

const executeSimulationMock = vi.fn(async () => ({
  success: true,
  simulationDurationMs: 100,
  summary: {
    totalDays: 1,
    totalPlayers: 1,
    simulationCompleted: true,
  },
  config: {},
  playerStats: {
    totalPlayers: 1,
    activePlayers: 1,
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
    charityPercentage: 0,
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
}));

const runtimeOptions = {
  enablePooling: true,
  attachDebugger: true,
  virtualDollarsPerPlayer: 1,
  enableSanityMetrics: true,
};

const devAssembly = {
  simulator: {
    executeSimulation: executeSimulationMock,
    getRuntimeOptions: () => runtimeOptions,
  },
  profile: {
    config: {},
    runtime: runtimeOptions,
    name: "development",
  },
  eventBus: {},
} as any;

const prodAssembly = {
  simulator: {
    executeSimulation: executeSimulationMock,
    getRuntimeOptions: () => runtimeOptions,
  },
  profile: {
    config: {},
    runtime: runtimeOptions,
    name: "production",
  },
  eventBus: {},
} as any;

const debugInterfaceMock = {
  endSession: vi.fn(() => ({
    id: "session",
    name: "dev",
    startTime: 0,
    endTime: 10,
    traces: [],
    logs: [],
    performanceSnapshots: [],
  })),
  getStats: vi.fn(() => ({
    totalSessions: 1,
    currentSessionDuration: undefined,
    avgSessionDuration: 10,
    totalEventsProcessed: 5,
    avgEventsPerSession: 5,
    errorRate: 0,
  })),
  detach: vi.fn(),
} as unknown as EventDebugInterface;

const setupDevelopmentDebuggingMock = vi.fn(() => debugInterfaceMock);
const setupProductionMonitoringMock = vi.fn(() => debugInterfaceMock);
const checkSystemHealthMock = vi.fn(() => ({
  status: "healthy" as const,
  issues: [],
  recommendations: [],
}));

vi.mock("@engine/index", async () => {
  const actual = await vi.importActual<any>("@engine/index");
  return {
    ...actual,
    createDevelopmentSimulator: vi.fn(() => devAssembly),
    createProductionSimulator: vi.fn(() => prodAssembly),
  };
});

vi.mock("@engine/events/debug/index", () => ({
  setupDevelopmentDebugging: setupDevelopmentDebuggingMock,
  setupProductionMonitoring: setupProductionMonitoringMock,
  checkSystemHealth: checkSystemHealthMock,
}));

describe("simulation runner debug integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (devAssembly.simulator.executeSimulation as vi.Mock).mockClear();
  });

  it("attaches development debugger when enabled", async () => {
    const { runSimulation } = await import(
      "../cli/src/commands/shared/simulation-runner.js"
    );

    const outcome = await runSimulation({
      profile: "development",
      days: 1,
      players: 10,
      charityRate: 0.2,
      seed: "dev",
      verbose: false,
      noPooling: false,
      dollarsPerPlayer: 1,
      initialDonation: 10,
      strategies: {},
      maxSimulationTimeMs: 60000,
      debugDashboard: true,
    });

    expect(setupDevelopmentDebuggingMock).toHaveBeenCalled();
    expect(setupProductionMonitoringMock).not.toHaveBeenCalled();
    expect(checkSystemHealthMock).toHaveBeenCalled();
    expect(outcome.debugSummary?.status).toBe("healthy");
    expect(debugInterfaceMock.detach).toHaveBeenCalled();
  });

  it("skips debugger when disabled", async () => {
    const { runSimulation } = await import(
      "../cli/src/commands/shared/simulation-runner.js"
    );

    await runSimulation({
      profile: "development",
      days: 1,
      players: 10,
      charityRate: 0.2,
      seed: "dev",
      verbose: false,
      noPooling: false,
      dollarsPerPlayer: 1,
      initialDonation: 10,
      strategies: {},
      maxSimulationTimeMs: 60000,
      debugDashboard: false,
    });

    expect(setupDevelopmentDebuggingMock).not.toHaveBeenCalled();
    expect(checkSystemHealthMock).not.toHaveBeenCalled();
  });
});
