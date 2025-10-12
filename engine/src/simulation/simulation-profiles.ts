import { CashOutStrategy } from "../types/virtual-dollar-engine";
import type { SimulationConfig } from "./game-engine-simulator";

export const DEFAULT_SIMULATION_PROFILE_NAME = "default";

export interface SimulationRuntimeOptions {
  enablePooling: boolean;
  attachDebugger: boolean;
  virtualDollarsPerPlayer: number;
  enableSanityMetrics: boolean;
  collectDailySnapshots: boolean;
  collectEventTraces: boolean;
}

export interface SimulationProfile {
  name: string;
  description?: string;
  config: SimulationConfig;
  runtime: SimulationRuntimeOptions;
}

export type SimulationProfileOverrides = {
  name?: string;
  description?: string;
  config?: PartialConfigOverrides;
  runtime?: Partial<SimulationRuntimeOptions>;
};

interface PartialConfigOverrides
  extends Partial<Omit<SimulationConfig, "playerStrategies" | "growthModel">> {
  playerStrategies?: Partial<Record<CashOutStrategy, number>>;
  growthModel?: Partial<SimulationConfig["growthModel"]>;
}

const DEFAULT_PLAYER_STRATEGIES: Record<CashOutStrategy, number> = {
  [CashOutStrategy.CONSERVATIVE]: 0.4,
  [CashOutStrategy.BALANCED]: 0.4,
  [CashOutStrategy.AGGRESSIVE]: 0.2,
};

const DEFAULT_GROWTH_MODEL: SimulationConfig["growthModel"] = {
  adoptionRate: 0.1,
  baseMarket: 10000,
  midpointDay: 1,
  steepnessFactor: 20,
};

export const DEFAULT_RUNTIME_OPTIONS: SimulationRuntimeOptions = {
  enablePooling: true,
  attachDebugger: false,
  virtualDollarsPerPlayer: 1,
  enableSanityMetrics: true,
  collectDailySnapshots: false,
  collectEventTraces: false,
};

/**
 * Create a simulation profile by merging overrides with sensible defaults.
 */
export function createSimulationProfile(
  overrides: SimulationProfileOverrides = {}
): SimulationProfile {
  const config = buildSimulationConfig(overrides.config);
  const runtime = buildRuntimeOptions(overrides.runtime);
  const name = overrides.name ?? DEFAULT_SIMULATION_PROFILE_NAME;

  const profile: SimulationProfile = {
    name,
    config,
    runtime,
  };

  if (overrides.description !== undefined) {
    profile.description = overrides.description;
  }

  return profile;
}

export function buildRuntimeOptions(
  overrides: Partial<SimulationRuntimeOptions> = {}
): SimulationRuntimeOptions {
  return {
    enablePooling:
      overrides.enablePooling ?? DEFAULT_RUNTIME_OPTIONS.enablePooling,
    attachDebugger:
      overrides.attachDebugger ?? DEFAULT_RUNTIME_OPTIONS.attachDebugger,
    virtualDollarsPerPlayer:
      overrides.virtualDollarsPerPlayer ??
      DEFAULT_RUNTIME_OPTIONS.virtualDollarsPerPlayer,
    enableSanityMetrics:
      overrides.enableSanityMetrics ??
      DEFAULT_RUNTIME_OPTIONS.enableSanityMetrics,
    collectDailySnapshots:
      overrides.collectDailySnapshots ??
      DEFAULT_RUNTIME_OPTIONS.collectDailySnapshots,
    collectEventTraces:
      overrides.collectEventTraces ??
      DEFAULT_RUNTIME_OPTIONS.collectEventTraces,
  };
}

function buildSimulationConfig(
  overrides: PartialConfigOverrides = {}
): SimulationConfig {
  const durationDays = overrides.durationDays ?? 1;
  const playerStrategies = normalizeStrategies(
    overrides.playerStrategies ?? DEFAULT_PLAYER_STRATEGIES
  );

  const baseConfig: SimulationConfig = {
    durationDays,
    initialPlayerCount: overrides.initialPlayerCount ?? 10,
    dailySeed: overrides.dailySeed ?? "dollarzing-sim",
    charityPercentage: overrides.charityPercentage ?? 0.2,
    playerStrategies,
    initialDonationAmount: overrides.initialDonationAmount ?? 25,
    maxSimulationTimeMs: overrides.maxSimulationTimeMs ?? 60000,
    enableProgressReporting: overrides.enableProgressReporting ?? false,
    growthModel: {
      adoptionRate:
        overrides.growthModel?.adoptionRate ??
        DEFAULT_GROWTH_MODEL.adoptionRate,
      baseMarket:
        overrides.growthModel?.baseMarket ?? DEFAULT_GROWTH_MODEL.baseMarket,
      midpointDay:
        overrides.growthModel?.midpointDay ?? computeMidpoint(durationDays),
      steepnessFactor:
        overrides.growthModel?.steepnessFactor ??
        DEFAULT_GROWTH_MODEL.steepnessFactor,
    },
  };

  // Add initialPlayerSpreadDays if provided
  if (overrides.initialPlayerSpreadDays !== undefined) {
    (baseConfig as any).initialPlayerSpreadDays = overrides.initialPlayerSpreadDays;
  }

  return baseConfig;
}

function computeMidpoint(durationDays: number): number {
  return Math.max(1, Math.round(durationDays / 2));
}

function normalizeStrategies(
  distribution: Partial<Record<CashOutStrategy, number>>
): Record<CashOutStrategy, number> {
  const merged = {
    [CashOutStrategy.CONSERVATIVE]:
      distribution[CashOutStrategy.CONSERVATIVE] ??
      DEFAULT_PLAYER_STRATEGIES[CashOutStrategy.CONSERVATIVE],
    [CashOutStrategy.BALANCED]:
      distribution[CashOutStrategy.BALANCED] ??
      DEFAULT_PLAYER_STRATEGIES[CashOutStrategy.BALANCED],
    [CashOutStrategy.AGGRESSIVE]:
      distribution[CashOutStrategy.AGGRESSIVE] ??
      DEFAULT_PLAYER_STRATEGIES[CashOutStrategy.AGGRESSIVE],
  };

  const total = Object.values(merged).reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return { ...DEFAULT_PLAYER_STRATEGIES };
  }

  return {
    [CashOutStrategy.CONSERVATIVE]:
      merged[CashOutStrategy.CONSERVATIVE] / total,
    [CashOutStrategy.BALANCED]: merged[CashOutStrategy.BALANCED] / total,
    [CashOutStrategy.AGGRESSIVE]: merged[CashOutStrategy.AGGRESSIVE] / total,
  };
}

export function isSimulationProfile(
  input: SimulationConfig | SimulationProfile
): input is SimulationProfile {
  return (input as SimulationProfile).config !== undefined;
}
