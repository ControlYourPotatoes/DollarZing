import {
  CashOutStrategy,
  createDevelopmentSimulator,
  createProductionSimulator,
  type SimulationProfile,
  type SimulationProfileOverrides,
  type SimulationResults,
  type SimulationRuntimeOptions,
} from "../../../../src/index";
import type { SimulationProgress } from "../../../../src/simulation/game-engine-simulator";
import type { SimulatorFactoryOptions } from "../../../../src/simulation/simulator-factories";
import {
  setupDevelopmentDebugging,
  setupProductionMonitoring,
  checkSystemHealth,
} from "../../../../src/events/debug/index";
import type { EventDebugInterface } from "../../../../src/events/debug/index";

export type StrategyDistribution = Partial<Record<CashOutStrategy, number>>;

export interface SimulationRunConfig {
  profile: "development" | "production";
  days: number;
  players: number;
  charityRate: number; // 0..1
  seed: string;
  verbose: boolean;
  noPooling: boolean;
  dollarsPerPlayer: number;
  initialDonation: number;
  strategies: StrategyDistribution;
  maxSimulationTimeMs: number;
  attachDebugger?: boolean;
  enableSanityMetrics?: boolean;
  profileName?: string;
  debugDashboard: boolean;
}

export interface SimulationRunOutcome {
  results: SimulationResults;
  profile: SimulationProfile;
  runtime: SimulationRuntimeOptions;
  durationMs: number;
  debugSummary?: DebugSanitySummary;
}

export interface DebugSanitySummary {
  status: "healthy" | "warning" | "critical";
  issues: string[];
  recommendations: string[];
  stats: ReturnType<EventDebugInterface["getStats"]>;
}

export const DEFAULT_STRATEGY_DISTRIBUTION: Record<CashOutStrategy, number> = {
  [CashOutStrategy.CONSERVATIVE]: 0.4,
  [CashOutStrategy.BALANCED]: 0.4,
  [CashOutStrategy.AGGRESSIVE]: 0.2,
};

export async function runSimulation(
  config: SimulationRunConfig
): Promise<SimulationRunOutcome> {
  const factoryOptions = buildFactoryOptions(config);
  const assembly =
    config.profile === "production"
      ? createProductionSimulator(factoryOptions)
      : createDevelopmentSimulator(factoryOptions);

  let debugInterface: EventDebugInterface | undefined;
  if (config.debugDashboard) {
    debugInterface =
      config.profile === "production"
        ? setupProductionMonitoring(assembly.eventBus)
        : setupDevelopmentDebugging(assembly.eventBus);
  }

  const startTime = performance.now();
  const progressCallback = config.verbose ? createProgressLogger() : undefined;

  let debugSummary: DebugSanitySummary | undefined;
  const results = await assembly.simulator
    .executeSimulation(assembly.profile.config, progressCallback)
    .finally(() => {
      if (debugInterface) {
        try {
          debugSummary = collectDebugSummary(debugInterface);
        } finally {
          debugInterface.detach();
        }
      }
    });

  const durationMs = performance.now() - startTime;

  const outcome: SimulationRunOutcome = {
    results,
    profile: assembly.profile,
    runtime: assembly.simulator.getRuntimeOptions(),
    durationMs,
  };

  if (debugSummary) {
    outcome.debugSummary = debugSummary;
  }

  return outcome;
}

export interface SimulationSummaryContext {
  successMessage?: string;
  verbose: boolean;
}

export function printSimulationSummary(
  outcome: SimulationRunOutcome,
  context: SimulationSummaryContext
): void {
  const { results, durationMs, debugSummary } = outcome;

  console.log("");
  console.log("📈 Results Summary:");
  console.log("==================");

  if (results.success) {
    console.log("✅ Simulation completed successfully");
    console.log(`⏱️  Duration: ${Math.round(durationMs)}ms`);
    console.log("");

    console.log("👥 Players:");
    console.log(`  Total: ${results.playerStats.totalPlayers}`);
    console.log(`  Active: ${results.playerStats.activePlayers}`);
    console.log(`  Retired: ${results.playerStats.retiredPlayers}`);
    console.log("");

    console.log("🎮 Games:");
    console.log(`  Total: ${results.gameStats.totalGames}`);
    console.log(
      `  Per Day: ${results.gameStats.averageGamesPerDay.toFixed(1)}`
    );
    console.log(`  Virtual Dollars: ${results.gameStats.totalVirtualDollars}`);
    console.log(`  Jackpots Won: ${results.gameStats.jackpotsWon}`);
    console.log("");

    console.log("💰 Revenue:");
    console.log(
      `  Platform: $${results.revenueStats.totalPlatformRevenue.toFixed(2)}`
    );
    console.log(
      `  Charity: $${results.revenueStats.totalCharityContributions.toFixed(
        2
      )} (${(results.revenueStats.charityPercentage * 100).toFixed(1)}%)`
    );
    console.log(
      `  Player Payouts: $${results.revenueStats.totalPlayerPayouts.toFixed(2)}`
    );
    console.log(
      `  Per Game: $${results.revenueStats.revenuePerGame.toFixed(2)}`
    );

    if (context.verbose) {
      console.log("");
      console.log("📊 Detailed Statistics:");
      console.log(
        `  Average Games per Player: ${results.playerStats.averageGamesPerPlayer.toFixed(
          1
        )}`
      );
      console.log(
        `  Player Retirement Rate: ${(
          results.playerStats.playerRetirementRate * 100
        ).toFixed(1)}%`
      );
      console.log(
        `  Average Run Length: ${results.gameStats.averageRunLength.toFixed(
          1
        )} games`
      );
      console.log(`  Completed Runs: ${results.gameStats.completedRuns}`);
      console.log(`  Active Runs: ${results.gameStats.activeRuns}`);

      console.log("");
      console.log("💵 Fund Distribution:");
      console.log(
        `  Donation Funds: $${results.playerStats.totalCharityContributions.toFixed(
          2
        )}`
      );
      console.log(
        `  Winnings Funds: $${results.playerStats.totalPlayerPayouts.toFixed(
          2
        )}`
      );
      console.log(
        `  Progression Funds: $${results.playerStats.totalProgressionFunds.toFixed(
          2
        )}`
      );
    }

    console.log("");
    console.log(
      context.successMessage ?? "🎉 Simulation completed successfully!"
    );

    if (results.gameStats.totalGames === 0) {
      console.log("⚠️  Warning: No games were played");
    }
    if (results.revenueStats.totalPlatformRevenue < 0) {
      console.log("❌ Error: Negative platform revenue detected");
    }
  } else {
    console.log("❌ Simulation failed");
    console.log(`Error: ${results.error}`);
    console.log(`Duration: ${Math.round(durationMs)}ms`);
  }

  if (debugSummary) {
    printSanityDashboard(debugSummary);
  }
}

function buildFactoryOptions(
  config: SimulationRunConfig
): SimulatorFactoryOptions {
  const profileOverrides: SimulationProfileOverrides = {
    config: buildConfigOverrides(config),
    runtime: buildRuntimeOverrides(config),
  };

  if (config.profileName) {
    profileOverrides.name = config.profileName;
  }

  const factoryOptions: SimulatorFactoryOptions = {
    profileOverrides,
  };

  if (config.noPooling) {
    factoryOptions.disablePooling = true;
  }

  return factoryOptions;
}

function buildConfigOverrides(
  config: SimulationRunConfig
): NonNullable<SimulationProfileOverrides["config"]> {
  const clampedDays = Math.max(1, Math.floor(config.days));
  const midpoint = Math.max(1, Math.floor(clampedDays / 2));
  const normalizedStrategies = normalizeStrategies(config.strategies);

  return {
    durationDays: clampedDays,
    initialPlayerCount: Math.max(1, Math.floor(config.players)),
    dailySeed: config.seed,
    charityPercentage: clampFraction(config.charityRate),
    playerStrategies: normalizedStrategies,
    initialDonationAmount: Math.max(0, config.initialDonation),
    maxSimulationTimeMs: Math.max(1000, config.maxSimulationTimeMs),
    enableProgressReporting: config.verbose,
    growthModel: {
      adoptionRate: 0.1,
      baseMarket: 10000,
      midpointDay: midpoint,
      steepnessFactor: 20,
    },
  };
}

function buildRuntimeOverrides(
  config: SimulationRunConfig
): NonNullable<SimulationProfileOverrides["runtime"]> {
  const runtime: NonNullable<SimulationProfileOverrides["runtime"]> = {
    virtualDollarsPerPlayer: Math.max(1, Math.floor(config.dollarsPerPlayer)),
  };

  if (typeof config.attachDebugger === "boolean") {
    runtime.attachDebugger = config.attachDebugger;
  }
  if (typeof config.enableSanityMetrics === "boolean") {
    runtime.enableSanityMetrics = config.enableSanityMetrics;
  }

  return runtime;
}

function collectDebugSummary(
  debugInterface: EventDebugInterface
): DebugSanitySummary {
  let summary: DebugSanitySummary;
  try {
    const session = debugInterface.endSession();
    if (!session) {
      throw new Error("Debug session did not start");
    }
    const stats = debugInterface.getStats();
    const health = checkSystemHealth(debugInterface);
    summary = {
      status: health.status,
      issues: health.issues,
      recommendations: health.recommendations,
      stats,
    };
  } catch (error) {
    console.warn(
      "⚠️  Failed to collect debug summary:",
      error instanceof Error ? error.message : error
    );
    summary = {
      status: "warning",
      issues: ["Debug summary unavailable"],
      recommendations: [
        "Ensure EventDebugInterface is properly configured for CLI runs",
      ],
      stats: {
        totalSessions: 0,
        currentSessionDuration: undefined,
        avgSessionDuration: 0,
        totalEventsProcessed: 0,
        avgEventsPerSession: 0,
        errorRate: 0,
      },
    };
  }

  try {
    debugInterface.detach();
  } catch (error) {
    console.warn(
      "⚠️  Failed to detach debug interface:",
      error instanceof Error ? error.message : error
    );
  }

  return summary;
}

function normalizeStrategies(
  distribution: StrategyDistribution
): Record<CashOutStrategy, number> {
  const merged: Record<CashOutStrategy, number> = {
    ...DEFAULT_STRATEGY_DISTRIBUTION,
    ...distribution,
  };

  const total = Object.values(merged).reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    return { ...DEFAULT_STRATEGY_DISTRIBUTION };
  }

  return {
    [CashOutStrategy.CONSERVATIVE]:
      merged[CashOutStrategy.CONSERVATIVE] / total,
    [CashOutStrategy.BALANCED]: merged[CashOutStrategy.BALANCED] / total,
    [CashOutStrategy.AGGRESSIVE]: merged[CashOutStrategy.AGGRESSIVE] / total,
  };
}

function clampFraction(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function createProgressLogger() {
  return (progress: SimulationProgress) => {
    console.log(
      `Day ${progress.currentDay}/${progress.totalDays} (${(
        progress.completionPercentage * 100
      ).toFixed(1)}%) - Games: ${progress.gamesCompleted}, Pool: ${
        progress.dollarsInPool
      }`
    );
  };
}

function printSanityDashboard(summary: DebugSanitySummary): void {
  console.log("\n🧭 Sanity Dashboard");
  console.log("====================");
  console.log(`Status: ${summary.status.toUpperCase()}`);
  console.log(
    `Events Processed: ${
      summary.stats.totalEventsProcessed
    } (error rate: ${summary.stats.errorRate.toFixed(2)}%)`
  );

  if (summary.stats.currentSessionDuration !== undefined) {
    console.log(
      `Session Duration: ${Math.round(summary.stats.currentSessionDuration)}ms`
    );
  }

  if (summary.issues.length > 0) {
    console.log("Issues:");
    summary.issues.forEach((issue) => console.log(`  • ${issue}`));
  } else {
    console.log("Issues: None");
  }

  if (summary.recommendations.length > 0) {
    console.log("Recommendations:");
    summary.recommendations.forEach((rec) => console.log(`  • ${rec}`));
  }
}
