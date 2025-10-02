// Test Game Command - Run a single game for debugging and validation
// This is the simplest CLI command to verify the simulation engine works

import { Command } from "commander";
import {
  DEFAULT_STRATEGY_DISTRIBUTION,
  runSimulation,
  printSimulationSummary,
  type SimulationRunConfig,
} from "./shared/simulation-runner.js";

/**
 * Create the test-game command
 */
export function createTestGameCommand(): Command {
  const command = new Command("test-game");

  command
    .description("Run a single game simulation for testing and debugging")
    .option("-d, --days <number>", "Number of days to simulate", "1")
    .option("-p, --players <number>", "Number of players", "10")
    .option("-c, --charity <percentage>", "Charity percentage (0-100)", "20")
    .option("-v, --verbose", "Show detailed game information", false)
    .option(
      "--seed <string>",
      "Random seed for reproducible results",
      "test-game"
    )
    .action(async (options) => {
      try {
        await executeTestGame(options);
      } catch (error) {
        console.error(
          "❌ Test game failed:",
          error instanceof Error ? error.message : error
        );
        process.exit(1);
      }
    });

  // Add examples
  command.addHelpText(
    "after",
    `
Examples:
  $ dollarzing test-game                    # Run simple test with defaults
  $ dollarzing test-game --days 3 --players 20 --verbose
  $ dollarzing test-game --charity 30 --seed "my-test"
`
  );

  return command;
}

/**
 * Execute a single test game using GameEngineSimulator
 */
async function executeTestGame(options: any): Promise<void> {
  console.log("🎮 DollarZing Test Game");
  console.log("======================");

  // Parse and validate options
  const days = Math.max(1, parseInt(options.days || "1", 10));
  const players = Math.max(2, parseInt(options.players || "10", 10));
  const charityPercentage = Math.max(
    0,
    Math.min(100, parseInt(options.charity || "20", 10))
  );
  const verbose = options.verbose || false;
  const seed = options.seed || "test-game";

  if (verbose) {
    console.log("⚙️ Configuration:");
    console.log(`  Days: ${days}`);
    console.log(`  Players: ${players}`);
    console.log(`  Charity: ${charityPercentage}%`);
    console.log(`  Seed: ${seed}`);
    console.log("");
  }

  console.log("🚀 Starting simulation...");
  const simulationConfig: SimulationRunConfig = {
    profile: "development",
    days,
    players,
    charityRate: charityPercentage / 100,
    seed,
    verbose,
    noPooling: false,
    dollarsPerPlayer: 1,
    initialDonation: 25,
    strategies: DEFAULT_STRATEGY_DISTRIBUTION,
    maxSimulationTimeMs: 60000,
    attachDebugger: false,
    debugDashboard: false,
  };

  const outcome = await runSimulation(simulationConfig);

  printSimulationSummary(outcome, {
    verbose,
    successMessage: "🎉 Test game completed successfully!",
  });
}

/**
 * Validate test game options
 */
export function validateTestGameOptions(options: any): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const days = parseInt(options.days || "1", 10);
  const players = parseInt(options.players || "10", 10);
  const charity = parseInt(options.charity || "20", 10);

  if (isNaN(days) || days < 1 || days > 30) {
    errors.push("Days must be a number between 1 and 30");
  }

  if (isNaN(players) || players < 2 || players > 10000) {
    errors.push("Players must be a number between 2 and 10000");
  }

  if (isNaN(charity) || charity < 0 || charity > 100) {
    errors.push("Charity percentage must be a number between 0 and 100");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
