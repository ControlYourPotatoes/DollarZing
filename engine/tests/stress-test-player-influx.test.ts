import { describe, it, expect } from "vitest";
import { runSimulation } from "../cli/src/commands/shared/simulation-runner.js";

// Configurable player count - change this value to test different influx sizes
const INITIAL_PLAYERS = 5000; // Change to 15000, 20000, etc. for different tests

describe("Stress Test: High Player Influx and DAU/Matchmaking Performance", () => {
  it(`should handle ${INITIAL_PLAYERS} initial players in one day simulation`, async () => {
    // Run simulation for 1 day with high initial player count
    const startTime = Date.now();

    const results = await runSimulation({
      profile: "development",
      days: 1, // Single day to focus on influx handling
      players: INITIAL_PLAYERS,
      charityRate: 0.2,
      seed: `stress-test-${INITIAL_PLAYERS}`,
      verbose: true, // Enable verbose logging to see progress
      noPooling: false,
      dollarsPerPlayer: 2, // Standard starting dollars
      initialDonation: 25, // Standard donation
      strategies: {}, // Use default strategy distribution
      maxSimulationTimeMs: 800000, // 5 minutes timeout for large simulations
      debugDashboard: false, // Disable debug dashboard for faster performance testing
      initialPlayerSpreadDays: 1, // Force immediate creation of all initial players for stress testing
    });

    const duration = Date.now() - startTime;

    console.log(`\n🎯 Stress Test Results for ${INITIAL_PLAYERS} players:`);
    console.log(`⏱️  Simulation Duration: ${duration}ms`);
    console.log(`📊 Total Players: ${results.results.playerStats.totalPlayers}`);
    console.log(`🎮 Active Players (DAU): ${results.results.playerStats.activePlayers}`);
    console.log(`🏆 Retired Players: ${results.results.playerStats.retiredPlayers}`);
    console.log(`🎲 Total Games: ${results.results.gameStats.totalGames}`);
    console.log(`⚡ Average Games Per Day: ${results.results.gameStats.averageGamesPerDay}`);
    console.log(`💰 Total Virtual Dollars: ${results.results.gameStats.totalVirtualDollars}`);
    console.log(`🏦 Total Runs Created: ${results.results.gameStats.totalRunsCreated}`);
    console.log(`✅ Completed Runs: ${results.results.gameStats.completedRuns}`);
    console.log(`🎯 Jackpots Won: ${results.results.gameStats.jackpotsWon}`);

    // Log daily breakdown if available
    if (results.results.dailyResults && results.results.dailyResults.length > 0) {
      const dayResult = results.results.dailyResults[0];
      console.log(`\n📈 Day 1 Breakdown:`);
      console.log(`   New Players: ${dayResult.newPlayers || 0}`);
      console.log(`   Active Players: ${dayResult.playerStatistics.activePlayers || 0}`);
      console.log(`   Games Played: ${dayResult.gameStatistics.totalGames || 0}`);
      console.log(`   Revenue: $${(dayResult.revenueStatistics.totalPlatformRevenue || 0).toFixed(2)}`);
      console.log(`   Charity: $${(dayResult.revenueStatistics.totalCharityContributions || 0).toFixed(2)}`);
    }

    // Basic assertions to ensure simulation completed
    expect(results.results.success).toBe(true);
    expect(results.results.summary.simulationCompleted).toBe(true);
    expect(results.results.playerStats.totalPlayers).toBeGreaterThan(0);
    expect(results.results.gameStats.totalGames).toBeGreaterThan(0);

    // Performance assertions
    expect(duration).toBeLessThan(300000); // Should complete within 5 minutes
    expect(results.results.playerStats.activePlayers).toBeGreaterThan(0); // At least some players remain active

    console.log(`\n✅ Stress test for ${INITIAL_PLAYERS} players completed successfully!`);
  }, 600000); // 10 minute timeout for the test
});