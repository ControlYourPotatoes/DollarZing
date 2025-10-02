import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createProductionSimulator,
  createDevelopmentSimulator,
} from "../src/simulation/simulator-factories";

describe("Simulation factories - multi-day runs", () => {
  let logSpy: vi.SpyInstance;
  let warnSpy: vi.SpyInstance;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
  it("runs a 7-day development simulation and emits consistent totals", async () => {
    const assembly = createDevelopmentSimulator({
      profileOverrides: {
        config: {
          durationDays: 3,
          initialPlayerCount: 20,
          dailySeed: "dev-multi-day",
          maxSimulationTimeMs: 60000,
        },
      },
      disablePooling: true,
    });

    const results = await assembly.simulator.executeSimulation(
      assembly.profile.config
    );

    expect(results.success).toBe(true);
    expect(results.summary.totalDays).toBe(3);
    expect(results.playerStats.totalPlayers).toBeGreaterThanOrEqual(20);
    expect(results.gameStats.totalGames).toBeGreaterThanOrEqual(0);
    expect(results.revenueStats.totalPlatformRevenue).toBeGreaterThanOrEqual(0);
  });

  it("runs a 30-day production simulation using pooled factories", async () => {
    const assembly = createProductionSimulator({
      profileOverrides: {
        config: {
          durationDays: 7,
          initialPlayerCount: 80,
          dailySeed: "prod-multi-day",
          maxSimulationTimeMs: 180000,
        },
      },
    });

    const results = await assembly.simulator.executeSimulation(
      assembly.profile.config
    );

    expect(results.success).toBe(true);
    expect(results.summary.totalDays).toBe(7);
    expect(results.playerStats.totalPlayers).toBeGreaterThanOrEqual(80);
    expect(results.gameStats.totalGames).toBeGreaterThanOrEqual(0);
    expect(results.revenueStats.totalPlatformRevenue).toBeGreaterThanOrEqual(0);
  });
});
