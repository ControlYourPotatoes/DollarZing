import {
  GameEngineSimulator,
} from "./game-engine-simulator";
import {
  createSimulationProfile,
  type SimulationProfile,
  type SimulationProfileOverrides,
  type SimulationRuntimeOptions,
} from "./simulation-profiles";
import { EventBus } from "../events/event-bus";
import {
  createDebugInterface,
  type DebugInterfaceConfig,
  type EventDebugInterface,
} from "../events/debug/index";
import { GameMatchingEngine } from "../core/game-matching-engine";
import { ScoringEngine } from "../core/scoring-engine";
import { RevenueCalculator } from "../core/revenue-calculator";
import { DayProcessor } from "./day-processor";
import { PlayerManager } from "./player-manager";
import {
  PooledVirtualDollarFactory,
  PooledGameSessionFactory,
} from "../factories";
import {
  DirectGameSessionFactory,
  UnifiedVirtualDollarFactory,
} from "../test-utils";
import type {
  GameSessionFactory,
  PerformanceConfig,
  VirtualDollarFactory,
} from "../types/factory-interfaces";
import {
  DEFAULT_PERFORMANCE_CONFIG,
  PRODUCTION_PERFORMANCE_CONFIG,
} from "../types/factory-interfaces";

export interface SimulatorComponents {
  scoringEngine: ScoringEngine;
  virtualDollarFactory: VirtualDollarFactory;
  gameSessionFactory: GameSessionFactory;
  gameMatchingEngine: GameMatchingEngine;
  revenueCalculator: RevenueCalculator;
  playerManager: PlayerManager;
  dayProcessor: DayProcessor;
}

export interface SimulatorAssembly {
  simulator: GameEngineSimulator;
  profile: SimulationProfile;
  eventBus: EventBus;
  components: SimulatorComponents;
  poolingEnabled: boolean;
  debugInterface?: EventDebugInterface;
  dispose: () => void;
}

export interface SimulatorFactoryOptions {
  eventBus?: EventBus;
  profileOverrides?: SimulationProfileOverrides;
  enablePooling?: boolean;
  disablePooling?: boolean;
  performanceOverrides?: Partial<PerformanceConfig>;
  debug?: SimulatorDebugOptions;
}

export interface SimulatorDebugOptions {
  enableEventTracing: boolean;
  config?: Partial<DebugInterfaceConfig>;
  autoStartSession?: boolean;
  sessionName?: string;
}

interface RuntimeDefaults {
  poolingDefault: boolean;
  runtime: Pick<
    SimulationRuntimeOptions,
    | "attachDebugger"
    | "enableSanityMetrics"
    | "virtualDollarsPerPlayer"
    | "collectDailySnapshots"
    | "collectEventTraces"
  >;
}

export function createDevelopmentSimulator(
  options: SimulatorFactoryOptions = {}
): SimulatorAssembly {
  return assembleSimulator(
    {
      poolingDefault: true,
      runtime: {
        attachDebugger: true,
        enableSanityMetrics: true,
        virtualDollarsPerPlayer: 1,
        collectDailySnapshots: false,
        collectEventTraces: false,
      },
    },
    options,
    DEFAULT_PERFORMANCE_CONFIG
  );
}

export function createProductionSimulator(
  options: SimulatorFactoryOptions = {}
): SimulatorAssembly {
  return assembleSimulator(
    {
      poolingDefault: true,
      runtime: {
        attachDebugger: false,
        enableSanityMetrics: false,
        virtualDollarsPerPlayer: 1,
        collectDailySnapshots: false,
        collectEventTraces: false,
      },
    },
    options,
    PRODUCTION_PERFORMANCE_CONFIG
  );
}

function assembleSimulator(
  defaults: RuntimeDefaults,
  options: SimulatorFactoryOptions,
  performanceBase: PerformanceConfig
): SimulatorAssembly {
  const poolingEnabled = resolvePooling(defaults.poolingDefault, options);
  applyPoolingEnvironment(poolingEnabled);

  const profile = createProfile(defaults, poolingEnabled, options.profileOverrides);
  const eventBus = options.eventBus ?? new EventBus();
  const debugInterface =
    options.debug?.enableEventTracing === true
      ? createDebugInterface(options.debug.config)
      : undefined;

  if (debugInterface) {
    debugInterface.attachToEventBus(eventBus);
    if (options.debug?.autoStartSession) {
      debugInterface.startSession(
        options.debug.sessionName ?? "simulator-debug-session"
      );
    }
  }

  const { virtualDollarFactory, gameSessionFactory } = createFactories(
    poolingEnabled,
    performanceBase,
    options.performanceOverrides
  );

  const scoringEngine = new ScoringEngine();
  const revenueCalculator = new RevenueCalculator();
  const gameMatchingEngine = new GameMatchingEngine(
    virtualDollarFactory,
    scoringEngine,
    gameSessionFactory,
    eventBus
  );
  const playerManager = new PlayerManager(eventBus, virtualDollarFactory);
  const dayProcessor = new DayProcessor(
    gameMatchingEngine,
    playerManager,
    virtualDollarFactory,
    eventBus,
    { loggingEnabled: false }
  );

  const simulator = new GameEngineSimulator(
    gameMatchingEngine,
    virtualDollarFactory,
    revenueCalculator,
    dayProcessor,
    playerManager,
    eventBus
  );

  const dispose = (): void => {
    simulator.dispose();
    dayProcessor.dispose();
    playerManager.dispose();
    eventBus.dispose();
  };

  return {
    simulator,
    profile,
    eventBus,
    poolingEnabled,
    components: {
      scoringEngine,
      virtualDollarFactory,
      gameSessionFactory,
      gameMatchingEngine,
      revenueCalculator,
      playerManager,
      dayProcessor,
    },
    ...(debugInterface ? { debugInterface } : {}),
    dispose,
  };
}

function resolvePooling(
  defaultValue: boolean,
  options: SimulatorFactoryOptions
): boolean {
  if (options.disablePooling === true) {
    return false;
  }
  if (options.enablePooling !== undefined) {
    return options.enablePooling;
  }
  return defaultValue;
}

function applyPoolingEnvironment(enable: boolean): void {
  process.env.ENABLE_POOLING = enable ? "true" : "false";
}

function createProfile(
  defaults: RuntimeDefaults,
  poolingEnabled: boolean,
  overrides?: SimulationProfileOverrides
): SimulationProfile {
  const runtimeOverrides = overrides?.runtime ?? {};
  const runtime: SimulationRuntimeOptions = {
    attachDebugger:
      runtimeOverrides.attachDebugger ?? defaults.runtime.attachDebugger,
    enableSanityMetrics:
      runtimeOverrides.enableSanityMetrics ?? defaults.runtime.enableSanityMetrics,
    virtualDollarsPerPlayer:
      runtimeOverrides.virtualDollarsPerPlayer ??
      defaults.runtime.virtualDollarsPerPlayer,
    collectDailySnapshots:
      runtimeOverrides.collectDailySnapshots ??
      defaults.runtime.collectDailySnapshots,
    collectEventTraces:
      runtimeOverrides.collectEventTraces ??
      defaults.runtime.collectEventTraces,
    enablePooling: poolingEnabled,
  };

  return createSimulationProfile({
    ...overrides,
    runtime,
  });
}

function createFactories(
  poolingEnabled: boolean,
  base: PerformanceConfig,
  overrides?: Partial<PerformanceConfig>
): {
  virtualDollarFactory: VirtualDollarFactory;
  gameSessionFactory: GameSessionFactory;
} {
  const performanceConfig = mergePerformanceConfig(base, overrides);

  if (poolingEnabled) {
    const config = {
      ...performanceConfig,
      enableObjectPooling: true,
    };
    return {
      virtualDollarFactory: new PooledVirtualDollarFactory(config),
      gameSessionFactory: new PooledGameSessionFactory(config),
    };
  }

  const config = {
    ...performanceConfig,
    enableObjectPooling: false,
  };

  return {
    virtualDollarFactory: new UnifiedVirtualDollarFactory(config),
    gameSessionFactory: new DirectGameSessionFactory(config),
  };
}

function mergePerformanceConfig(
  base: PerformanceConfig,
  overrides?: Partial<PerformanceConfig>
): PerformanceConfig {
  if (!overrides) {
    return { ...base };
  }

  return {
    ...base,
    ...overrides,
    poolSizes: {
      ...base.poolSizes,
      ...(overrides.poolSizes ?? {}),
    },
    prewarmCounts: {
      ...base.prewarmCounts,
      ...(overrides.prewarmCounts ?? {}),
    },
  };
}
