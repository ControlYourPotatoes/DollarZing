import { Command } from "commander";
import { CashOutStrategy, type SimulationResults } from "../../../src/index";
import {
  runSimulation,
  printSimulationSummary,
  type SimulationRunConfig,
  type StrategyDistribution,
} from "./shared/simulation-runner.js";

export interface SimulateCliOptions {
  profile?: string;
  days?: string;
  players?: string;
  dollarsPerPlayer?: string;
  charity?: string;
  seed?: string;
  pooling?: boolean;
  verbose?: boolean;
  initialDonation?: string;
  strategies?: string;
  maxSimulationTime?: string;
  debugDashboard?: boolean;
}

export function createSimulateCommand(): Command {
  const command = new Command("simulate");

  command
    .description("Run a configurable multi-day simulation using the event-driven engine")
    .option("-d, --days <number>", "Number of days to simulate", "7")
    .option("-p, --players <number>", "Initial player count", "50")
    .option(
      "--dollars-per-player <number>",
      "Starting virtual dollars per player",
      "1"
    )
    .option("-c, --charity <percentage>", "Charity percentage (0-100)", "20")
    .option("--seed <string>", "Random seed", "simulate-run")
    .option(
      "--profile <profile>",
      "Simulator profile (development|production)",
      "development"
    )
    .option("--no-pooling", "Disable object pooling")
    .option("--debug-dashboard", "Enable debug dashboard output")
    .option("--no-debug-dashboard", "Disable debug dashboard output")
    .option("-v, --verbose", "Show per-day progress and detailed statistics", false)
    .option(
      "--initial-donation <amount>",
      "Initial donation amount",
      "25"
    )
    .option(
      "--strategies <distribution>",
      "Cash-out strategy distribution (e.g., conservative=0.3,balanced=0.4,aggressive=0.3)",
      ""
    )
    .option(
      "--max-simulation-time <ms>",
      "Maximum simulation time in milliseconds",
      "60000"
    )
    .action(async (options) => {
      try {
        await executeSimulateCommand(options);
      } catch (error) {
        console.error(
          "❌ Simulation failed:",
          error instanceof Error ? error.message : error
        );
        process.exit(1);
      }
    });

  return command;
}

export async function executeSimulateCommand(
  rawOptions: SimulateCliOptions,
  runner = runSimulation,
  summarizer = printSimulationSummary
): Promise<SimulationResults | undefined> {
  const config = buildSimulateConfig(rawOptions);

  console.log("🎮 DollarZing Simulation");
  console.log("====================");

  if (config.verbose) {
    console.log("⚙️ Configuration:");
    console.log(`  Profile: ${config.profile}`);
    console.log(`  Days: ${config.days}`);
    console.log(`  Players: ${config.players}`);
    console.log(`  Virtual Dollars per Player: ${config.dollarsPerPlayer}`);
    console.log(`  Charity: ${(config.charityRate * 100).toFixed(1)}%`);
    console.log(`  Pooling: ${config.noPooling ? "Disabled" : "Enabled"}`);
    console.log(
      `  Debug Dashboard: ${config.debugDashboard ? "Enabled" : "Disabled"}`
    );
    console.log(`  Seed: ${config.seed}`);
    console.log("");
  }

  console.log("🚀 Starting simulation...");
  const outcome = await runner(config);

  summarizer(outcome, {
    verbose: config.verbose,
    successMessage: "🎉 Simulation completed successfully!",
  });

  return outcome.results;
}

export function buildSimulateConfig(raw: SimulateCliOptions): SimulationRunConfig {
  const profile = parseProfile(raw.profile);
  const days = parsePositiveInt(raw.days ?? "7", "Days", 1, 365);
  const players = parsePositiveInt(raw.players ?? "50", "Players", 2, 100000);
  const dollarsPerPlayer = parsePositiveInt(
    raw.dollarsPerPlayer ?? "1",
    "Dollars per player",
    1,
    100
  );
  const charityRate = parsePercentage(raw.charity ?? "20");
  const seed = raw.seed ?? "simulate-run";
  const verbose = Boolean(raw.verbose);
  const noPooling = raw.pooling === false;
  const initialDonation = parseNonNegativeNumber(
    raw.initialDonation ?? "25",
    "Initial donation"
  );
  const maxSimulationTimeMs = parsePositiveInt(
    raw.maxSimulationTime ?? "60000",
    "Max simulation time",
    1000,
    3600000
  );
  const debugDashboard = resolveDebugDashboard(raw.debugDashboard, profile);

  const strategies = raw.strategies
    ? parseStrategyDistribution(raw.strategies)
    : {};

  return {
    profile,
    days,
    players,
    charityRate,
    seed,
    verbose,
    noPooling,
    dollarsPerPlayer,
    initialDonation,
    strategies,
    maxSimulationTimeMs,
    debugDashboard,
  };
}

function parseProfile(input?: string): "development" | "production" {
  const value = (input ?? "development").toLowerCase();
  if (value === "development" || value === "dev") {
    return "development";
  }
  if (value === "production" || value === "prod") {
    return "production";
  }
  throw new Error("Profile must be either 'development' or 'production'");
}

function parsePositiveInt(
  value: string,
  label: string,
  min: number,
  max: number
): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`${label} must be a valid number`);
  }
  if (parsed < min || parsed > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
  return parsed;
}

function parseNonNegativeNumber(value: string, label: string): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return parsed;
}

function parsePercentage(value: string): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
    throw new Error("Charity percentage must be between 0 and 100");
  }
  return parsed / 100;
}

export function parseStrategyDistribution(
  input: string
): StrategyDistribution {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return {};
  }

  const entries = trimmed.split(",");
  const distribution: StrategyDistribution = {};

 for (const entry of entries) {
    const [rawKey, rawValue] = entry.split("=");
    if (!rawKey || !rawValue) {
      throw new Error(
        "Invalid strategy format. Use conservative=0.3,balanced=0.4,aggressive=0.3"
      );
    }

    const key = rawKey.trim().toLowerCase();
    const value = Number.parseFloat(rawValue.trim());

    if (Number.isNaN(value) || value < 0) {
      throw new Error(`Invalid strategy value for ${key}`);
    }

    const mapping: Record<string, CashOutStrategy> = {
      conservative: CashOutStrategy.CONSERVATIVE,
      balanced: CashOutStrategy.BALANCED,
      aggressive: CashOutStrategy.AGGRESSIVE,
    };

    const strategy = mapping[key];
    if (strategy === undefined) {
      throw new Error(`Unknown strategy '${key}'`);
    }

    distribution[strategy] = value;
  }

  const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);
  if (total === 0) {
    return {};
  }

  // If user specified percentages (e.g., 40, 30, 30), normalise by 100
  if (total > 1.5) {
    (Object.keys(distribution) as Array<keyof StrategyDistribution>).forEach(
      (key) => {
        const value = distribution[key];
        if (value !== undefined) {
          distribution[key] = value / 100;
        }
      }
    );
  }

  return distribution;
}

function resolveDebugDashboard(
  optionValue: boolean | undefined,
  profile: "development" | "production"
): boolean {
  if (typeof optionValue === "boolean") {
    return optionValue;
  }
  return profile === "development";
}
