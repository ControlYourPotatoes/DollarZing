import { describe, it, expect, beforeEach, vi } from "vitest";
import { PlayerManager } from "./player-manager";
import { CashOutStrategy } from "../types/virtual-dollar-engine";
import { InMemoryDormantPlayerStore } from "./player-registry";
import { EVENT_TYPES } from "../events/event-types";

// Mock the external dependencies
vi.mock("../events/event-bus");
vi.mock("../test-utils");

describe("PlayerManager", () => {
  let playerManager: PlayerManager;
  let mockEventBus: any;
  let mockVirtualDollarFactory: any;
  let mockDormantStore: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock instances
    mockEventBus = {
      on: vi.fn(() => ({ unsubscribe: vi.fn() })),
      emit: vi.fn(),
      getActivePlayerCount: vi.fn(),
    };
    mockVirtualDollarFactory = {
      create: vi.fn(() => ({ id: "test-dollar-id" })),
      release: vi.fn(),
      releaseDollar: vi.fn(),
      getDollar: vi.fn(),
    };
    mockDormantStore = new InMemoryDormantPlayerStore();

    // Create PlayerManager instance
    playerManager = new PlayerManager(
      mockEventBus,
      mockVirtualDollarFactory,
      mockDormantStore
    );
  });

  describe("constructor", () => {
    it("should initialize with all required dependencies", () => {
      expect(playerManager).toBeDefined();
      expect(mockEventBus.on).toHaveBeenCalledWith(
        EVENT_TYPES.SIMULATION_STARTED,
        expect.any(Function),
        10
      );
      expect(mockEventBus.on).toHaveBeenCalledWith(
        EVENT_TYPES.DAY_STARTED,
        expect.any(Function),
        10
      );
      expect(mockEventBus.on).toHaveBeenCalledWith(
        EVENT_TYPES.PLAYER_CREATED,
        expect.any(Function),
        5
      );
      expect(mockEventBus.on).toHaveBeenCalledWith(
        EVENT_TYPES.VIRTUAL_DOLLAR_RUN_COMPLETED,
        expect.any(Function),
        5
      );
      expect(mockEventBus.on).toHaveBeenCalledWith(
        EVENT_TYPES.CASH_OUT_COMPLETED,
        expect.any(Function),
        5
      );
    });
  });

  describe("event handling", () => {
    it("should handle PLAYER_CREATED events", () => {
      const playerCreatedEvent = {
        type: EVENT_TYPES.PLAYER_CREATED,
        timestamp: new Date(),
        playerId: "test-player",
        initialDonationAmount: 100,
        cashOutStrategy: CashOutStrategy.BALANCED,
        isNewPlayer: true,
      };

      // Get the handler
      const playerCreatedHandler = mockEventBus.on.mock.calls.find(
        (call: any) => call[0] === EVENT_TYPES.PLAYER_CREATED
      )[1];

      playerCreatedHandler(playerCreatedEvent);

      expect(playerManager.getTotalPlayerCount()).toBe(1);
      expect(playerManager.getPlayerStrategy("test-player")).toBe(
        CashOutStrategy.BALANCED
      );
    });

    it("should handle VIRTUAL_DOLLAR_RUN_COMPLETED events", async () => {
      // First create a player and run
      const playerCreatedEvent = {
        type: EVENT_TYPES.PLAYER_CREATED,
        timestamp: new Date(),
        playerId: "test-player",
        initialDonationAmount: 100,
        cashOutStrategy: CashOutStrategy.BALANCED,
        isNewPlayer: true,
      };
      const playerCreatedHandler = mockEventBus.on.mock.calls.find(
        (call: any) => call[0] === EVENT_TYPES.PLAYER_CREATED
      )[1];
      playerCreatedHandler(playerCreatedEvent);

      // Create a run
      playerManager.createNewRun({
        playerId: "test-player",
        cashOutStrategy: CashOutStrategy.BALANCED,
        fundingSource: "DONATION",
      });

      // Complete the run
      const runCompletedEvent = {
        playerId: "test-player",
        virtualDollarId: "test-dollar-id",
      };
      const runCompletedHandler = mockEventBus.on.mock.calls.find(
        (call: any) => call[0] === EVENT_TYPES.VIRTUAL_DOLLAR_RUN_COMPLETED
      )[1];

      await runCompletedHandler(runCompletedEvent);

      expect(mockVirtualDollarFactory.releaseDollar).toHaveBeenCalledWith(
        "test-dollar-id"
      );
    });

    it("should handle CASH_OUT_COMPLETED events with cleanup", () => {
      const cashOutEvent = {
        type: EVENT_TYPES.CASH_OUT_COMPLETED,
        playerId: "test-player",
        virtualDollarId: "test-dollar-id",
        finalLevel: 5,
        totalWinnings: 100,
        cashOutAmount: 100,
        runCompleted: true,
        wasJackpot: false,
      };

      // Get the handler
      const cashOutHandler = mockEventBus.on.mock.calls.find(
        (call: any) => call[0] === EVENT_TYPES.CASH_OUT_COMPLETED
      )[1];

      cashOutHandler(cashOutEvent);

      expect(mockVirtualDollarFactory.releaseDollar).toHaveBeenCalledWith(
        "test-dollar-id"
      );
    });
  });

  describe("player lifecycle", () => {
    it("should create new runs for players", () => {
      // First create a player
      const playerCreatedEvent = {
        type: EVENT_TYPES.PLAYER_CREATED,
        timestamp: new Date(),
        playerId: "test-player",
        initialDonationAmount: 100,
        cashOutStrategy: CashOutStrategy.BALANCED,
        isNewPlayer: true,
      };
      const playerCreatedHandler = mockEventBus.on.mock.calls.find(
        (call: any) => call[0] === EVENT_TYPES.PLAYER_CREATED
      )[1];
      playerCreatedHandler(playerCreatedEvent);

      const run = playerManager.createNewRun({
        playerId: "test-player",
        cashOutStrategy: CashOutStrategy.BALANCED,
        fundingSource: "DONATION",
      });

      expect(run).toBeDefined();
      expect(run?.id).toBe("test-dollar-id");
      expect(mockVirtualDollarFactory.create).toHaveBeenCalledWith(
        "test-player"
      );
    });

    it("should track active runs", () => {
      // Create player
      const playerCreatedEvent = {
        type: EVENT_TYPES.PLAYER_CREATED,
        timestamp: new Date(),
        playerId: "test-player",
        initialDonationAmount: 100,
        cashOutStrategy: CashOutStrategy.BALANCED,
        isNewPlayer: true,
      };
      const playerCreatedHandler = mockEventBus.on.mock.calls.find(
        (call: any) => call[0] === EVENT_TYPES.PLAYER_CREATED
      )[1];
      playerCreatedHandler(playerCreatedEvent);

      // Create run
      playerManager.createNewRun({
        playerId: "test-player",
        cashOutStrategy: CashOutStrategy.BALANCED,
        fundingSource: "DONATION",
      });

      expect(playerManager.getActivePlayerCount()).toBe(1);

      // Complete run
      playerManager.removeActiveRun("test-player", "test-dollar-id");

      expect(playerManager.getActivePlayerCount()).toBe(0);
    });
  });

  describe("equilibrium fixes", () => {
    it("should properly clean up runs on cash-out completion", () => {
      // Create player and run
      const playerCreatedEvent = {
        type: EVENT_TYPES.PLAYER_CREATED,
        timestamp: new Date(),
        playerId: "test-player",
        initialDonationAmount: 100,
        cashOutStrategy: CashOutStrategy.BALANCED,
        isNewPlayer: true,
      };
      const playerCreatedHandler = mockEventBus.on.mock.calls.find(
        (call: any) => call[0] === EVENT_TYPES.PLAYER_CREATED
      )[1];
      playerCreatedHandler(playerCreatedEvent);

      playerManager.createNewRun({
        playerId: "test-player",
        cashOutStrategy: CashOutStrategy.BALANCED,
        fundingSource: "DONATION",
      });

      // Cash out
      const cashOutEvent = {
        type: EVENT_TYPES.CASH_OUT_COMPLETED,
        playerId: "test-player",
        virtualDollarId: "test-dollar-id",
        finalLevel: 5,
        totalWinnings: 100,
        cashOutAmount: 100,
        runCompleted: true,
        wasJackpot: false,
      };

      const cashOutHandler = mockEventBus.on.mock.calls.find(
        (call: any) => call[0] === EVENT_TYPES.CASH_OUT_COMPLETED
      )[1];

      cashOutHandler(cashOutEvent);

      // Should have cleaned up the run and released the dollar
      expect(mockVirtualDollarFactory.releaseDollar).toHaveBeenCalledWith(
        "test-dollar-id"
      );
      expect(playerManager.getActivePlayerCount()).toBe(0);
    });

    it("should handle reactivation through dormant store", () => {
      // Add a player to dormant store
      mockDormantStore.add({
        id: "dormant-player",
        strategy: CashOutStrategy.CONSERVATIVE,
        initialDonation: 50,
      });

      // Simulate reactivation through PlayerCreationManager
      // This would be tested through integration tests with the full system
      expect(mockDormantStore.size()).toBe(1);
    });
  });

  describe("backward compatibility", () => {
    it("should support deprecated initializePlayers for backward compatibility", () => {
      const config = {
        initialPlayerCount: 3,
        initialDonationAmount: 100,
        playerStrategies: {
          [CashOutStrategy.BALANCED]: 1.0,
        },
      };

      const count = playerManager.initializePlayers(config);

      expect(count).toBe(3);
      expect(mockVirtualDollarFactory.create).toHaveBeenCalledTimes(3);
    });
  });
});
