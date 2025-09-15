// Test Game Command - Run a single game for debugging and validation
// This is the simplest CLI command to verify the simulation engine works

import { Command } from "commander";
import {
  GameEngineSimulator,
  type SimulationConfig,
  type SimulationProgress,
  CashOutStrategy,
} from "../../../src/index";

// Import orchestrator components for proper factory integration
import { createGameEngineSimulator } from "../orchestrator/execution/dataset-orchestrator";

/**
 * Create GameEngineSimulator using orchestrator factory pattern
 * This leverages the established CLI orchestrator architecture
 */
function createTestGameSimulator(): GameEngineSimulator {
  // Use the orchestrator's factory pattern for proper component integration
  // Create a minimal simulation config for the orchestrator function
  const config: SimulationConfig = {
    durationDays: 1,
    initialPlayerCount: 10,
    dailySeed: "test",
    charityPercentage: 0.2,
    playerStrategies: {
      [CashOutStrategy.CONSERVATIVE]: 0.4,
      [CashOutStrategy.BALANCED]: 0.4,
      [CashOutStrategy.AGGRESSIVE]: 0.2,
    },
    initialDonationAmount: 25,
    maxSimulationTimeMs: 60000,
    enableProgressReporting: false,
    growthModel: {
      adoptionRate: 0.1,
      baseMarket: 10000,
      midpointDay: 1,
      steepnessFactor: 20,
    },
  };

  // Use the orchestrator's createGameEngineSimulator function
  // This ensures proper factory integration and event system setup
  return createGameEngineSimulator(config);
}

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
  const startTime = performance.now();

  // Create simulation configuration
  const config: SimulationConfig = {
    durationDays: days,
    initialPlayerCount: players,
    dailySeed: seed,
    charityPercentage: charityPercentage / 100,
    playerStrategies: {
      [CashOutStrategy.CONSERVATIVE]: 0.4,
      [CashOutStrategy.BALANCED]: 0.4,
      [CashOutStrategy.AGGRESSIVE]: 0.2,
    },
    initialDonationAmount: 25,
    maxSimulationTimeMs: 60000, // 1 minute timeout
    enableProgressReporting: verbose,
    // Add growth model for S-curve player adoption
    growthModel: {
      adoptionRate: 0.1, // Market adoption rate
      baseMarket: 10000, // Base market size
      midpointDay: Math.floor(days / 2), // Midpoint at half duration
      steepnessFactor: 20, // Standard steepness
    },
  };

  // Create GameEngineSimulator using the orchestrator factory pattern
  const simulator = createTestGameSimulator();

  // Progress callback for verbose mode
  const progressCallback = verbose
    ? (progress: SimulationProgress) => {
        console.log(
          `Day ${progress.currentDay}/${progress.totalDays} (${(
            progress.completionPercentage * 100
          ).toFixed(1)}%) - Games: ${progress.gamesCompleted}, Pool: ${
            progress.dollarsInPool
          }`
        );
      }
    : undefined;

  // Execute simulation
  const results = await simulator.executeSimulation(config, progressCallback);

  const endTime = performance.now();
  const duration = Math.round(endTime - startTime);

  // Display results
  console.log("");
  console.log("📈 Results Summary:");
  console.log("==================");

  if (results.success) {
    console.log("✅ Simulation completed successfully");
    console.log(`⏱️  Duration: ${duration}ms`);
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

    if (verbose) {
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
        `  Donation Funds: $${results.playerStats.totalDonationsFunds.toFixed(
          2
        )}`
      );
      console.log(
        `  Winnings Funds: $${results.playerStats.totalWinningsFunds.toFixed(
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
    console.log("🎉 Test game completed successfully!");

    // Quick validation checks
    if (results.gameStats.totalGames === 0) {
      console.log("⚠️  Warning: No games were played");
    }
    if (results.revenueStats.totalPlatformRevenue < 0) {
      console.log("❌ Error: Negative platform revenue detected");
    }
  } else {
    console.log("❌ Simulation failed");
    console.log(`Error: ${results.error}`);
    console.log(`Duration: ${duration}ms`);
  }
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
