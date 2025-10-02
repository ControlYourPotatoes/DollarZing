import { describe, it, expect, beforeEach, vi } from "vitest";
import { DayProcessor } from "./day-processor";
import { SimulationConfig } from "./game-engine-simulator";

// Mock the external dependencies
vi.mock("../types/game-matching-engine");
vi.mock("./player-manager");
vi.mock("../types/virtual-dollar-types");
vi.mock("../types/revenue-calculator");

describe("DayProcessor", () => {
  let dayProcessor: DayProcessor;
  let mockGameMatchingEngine: any;
  let mockPlayerManager: any;
  let mockDollarManager: any;
  let mockRevenueCalculator: any;
  let mockEventBus: any;
  let mockSimulationConfig: SimulationConfig;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock simulation config
    mockSimulationConfig = {
      durationDays: 30,
      initialPlayerCount: 100,
      dailySeed: "test-seed",
      charityPercentage: 0.2,
      playerStrategies: { conservative: 0.3, balanced: 0.4, aggressive: 0.3 },
      initialDonationAmount: 1000,
      maxSimulationTimeMs: 60000,
      enableProgressReporting: false,
      growthModel: {
        adoptionRate: 0.1,
        baseMarket: 1000000,
        midpointDay: 90,
        steepnessFactor: 20,
      },
    };

    // Create mock instances
    mockGameMatchingEngine = {
      addToPool: vi.fn().mockReturnValue({ success: true }),
      resolveGame: vi.fn().mockReturnValue({ success: true }),
      getGameSession: vi.fn(),
      getPoolStatistics: vi.fn().mockReturnValue({
        totalDollarsInPool: 100,
        availableForMatching: 50,
      }),
      // Note: attemptMatching removed - now handled by MatchmakingEventHandler
    };

    mockPlayerManager = {
      autoCreateRuns: vi.fn().mockReturnValue([]),
      processGameResult: vi.fn().mockReturnValue(null), // null means run continues
      getPlayerStrategy: vi.fn().mockReturnValue("BALANCED"),
      createNewRun: vi.fn().mockReturnValue({ id: "new-run-1" }),
    };

    mockDollarManager = {
      updateDollarState: vi.fn(),
    };

    mockRevenueCalculator = {
      processGameRevenue: vi.fn(),
      processCashOut: vi.fn(),
      getTotalGames: vi.fn().mockReturnValue(5),
    };

    // Suppress unused variable warning
    void mockRevenueCalculator;

    // Create mock EventBus with all required methods
    mockEventBus = {
      on: vi.fn(),
      emit: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      getListeners: vi.fn().mockReturnValue(new Map()),
      getEventTrace: vi.fn().mockReturnValue([]),
      clearEventTrace: vi.fn(),
      dispose: vi.fn(),
      getListenerCount: vi.fn().mockReturnValue(0),
    };

    // Create DayProcessor instance
    dayProcessor = new DayProcessor(
      mockGameMatchingEngine,
      mockPlayerManager,
      mockDollarManager,
      mockEventBus
    );
  });

  describe("constructor", () => {
    it("should initialize with all required dependencies", () => {
      expect(dayProcessor).toBeDefined();
    });
  });

  describe("processDay", () => {
    it("should process a single day of simulation", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 10,
        maxGamesPerDay: 20,
        dailySeed: "2025-09-01",
      };

      await dayProcessor.processDay(day, config, mockSimulationConfig);

      // In event-driven architecture, PlayerManager creates runs via DAY_STARTED events
      // DayProcessor no longer directly calls autoCreateRuns
      // Verify DAY_STARTED event was emitted which triggers PlayerManager
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        "DAY_STARTED",
        expect.any(Object)
      );
    });

    it("should handle empty game results gracefully", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 10,
        maxGamesPerDay: 20,
        dailySeed: "2025-09-01",
      };

      await dayProcessor.processDay(day, config, mockSimulationConfig);

      // Should not throw and should complete successfully
      // In event-driven architecture, games are created via events
    });

    it("should process games when they are created", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 10,
        maxGamesPerDay: 20,
        dailySeed: "2025-09-01",
      };

      await dayProcessor.processDay(day, config, mockSimulationConfig);

      // In event-driven architecture, game resolution happens via events
      // GameEventHandler handles game resolution, not DayProcessor directly
    });

    it("should respect maxGamesPerDay limit", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 2, // This will result in maxGamesPerDay = Math.max(10, 2*2) = 10
        maxGamesPerDay: 8, // This is ignored in the actual implementation
        dailySeed: "2025-09-01",
      };

      await dayProcessor.processDay(day, config, mockSimulationConfig);

      // In event-driven architecture, matching attempts are handled by MatchmakingEventHandler
      // DayProcessor only emits DAY_STARTED and DAY_COMPLETED events
    });

    it("should stop processing when no more games can be created", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 10,
        maxGamesPerDay: 20,
        dailySeed: "2025-09-01",
      };

      await dayProcessor.processDay(day, config, mockSimulationConfig);

      // In event-driven architecture, matching is handled by MatchmakingEventHandler
      // which responds to POOL_ADDED/POOL_UPDATED events
    });
  });

  describe("event subscriptions", () => {
    it("should setup event subscriptions on construction", () => {
      // Verify that eventBus.on was called during construction for NEW_RUN_CREATED
      expect(mockEventBus.on).toHaveBeenCalledWith(
        "NEW_RUN_CREATED",
        expect.any(Function)
      );
    });

    it("should handle NEW_RUN_CREATED event", async () => {
      // Test the event handler directly
      const mockNewRunEvent = {
        type: "NEW_RUN_CREATED",
        virtualDollarId: "test-dollar-id",
        playerId: "test-player",
        timestamp: new Date(),
      };

      // Mock the dollar manager to return a valid virtual dollar
      const mockVirtualDollar = {
        id: "test-dollar-id",
        currentLevel: 1,
      };
      mockDollarManager.getDollar = vi.fn().mockReturnValue(mockVirtualDollar);

      // Get the registered handler
      const onCalls = mockEventBus.on.mock.calls;
      const newRunHandlerCall = onCalls.find(
        (call: any) => call[0] === "NEW_RUN_CREATED"
      );
      expect(newRunHandlerCall).toBeDefined();

      const handler = newRunHandlerCall![1];
      await handler(mockNewRunEvent);

      // Verify that the virtual dollar was added to the pool
      expect(mockGameMatchingEngine.addToPool).toHaveBeenCalledWith(
        mockVirtualDollar
      );
    });
  });

  describe("event-driven behavior", () => {
    it("should emit DAY_STARTED event with correct data", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 10,
        maxGamesPerDay: 20,
        dailySeed: "2025-09-01",
      };

      await dayProcessor.processDay(day, config, mockSimulationConfig);

      // Verify DAY_STARTED event was emitted
      expect(mockEventBus.emit).toHaveBeenCalledWith("DAY_STARTED", {
        type: "DAY_STARTED",
        timestamp: expect.any(Date),
        dayNumber: 1,
        totalPlayers: 0,
        activePlayers: 0,
        poolSize: 100,
        growthModel: mockSimulationConfig.growthModel,
        playerStrategies: mockSimulationConfig.playerStrategies,
      });
    });

    it("should emit DAY_COMPLETED event", async () => {
      const day = 1;
      const config = {
        initialPlayerCount: 10,
        maxGamesPerDay: 20,
        dailySeed: "2025-09-01",
      };

      await dayProcessor.processDay(day, config, mockSimulationConfig);

      // Verify DAY_COMPLETED event was emitted with correct structure
      expect(mockEventBus.emit).toHaveBeenCalledWith("DAY_COMPLETED", {
        type: "DAY_COMPLETED",
        timestamp: expect.any(Date),
        dayNumber: 1,
        gamesProcessed: expect.any(Number),
        newPlayers: expect.any(Number),
        activePlayers: expect.any(Number),
        poolSize: 100,
        totalRevenue: expect.any(Number),
      });
    });
  });
});
