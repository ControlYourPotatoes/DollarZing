/**
 * Tests for GameEventHandler - Game Resolution with CryptoZing Game Rules
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { EventBus } from "../event-bus";
import { GameEventHandler } from "./game-event-handler";
import { GameMatchingEngine } from "../../core/game-matching-engine";
import { RevenueCalculator } from "../../core/revenue-calculator";
import {
  GameCreatedEvent,
  GameResolvedEvent,
  EVENT_TYPES,
  RevenueGameProcessedEvent,
} from "../event-types";
import {
  VirtualDollar,
  DollarState,
  BettingLevel,
  getBettingLevelValue,
} from "../../types/virtual-dollar-engine";

// Mock implementations
const createMockVirtualDollar = (
  id: string,
  ownerId: string,
  level: BettingLevel = 1,
  state: DollarState = DollarState.IN_GAME
): VirtualDollar => ({
  id,
  serialNumber: `L${Math.random().toString().substr(2, 8)}A`,
  currentScore: Math.random(),
  currentLevel: level,
  state,
  ownerId,
  runId: `run-${ownerId}`,
  createdAt: new Date(),
  gameHistory: [],
  gamesInThisRun: 1,
  currentRunWinnings: getBettingLevelValue(level) * 1.8, // CryptoZing winnings formula
  isIndependentRun: false,
  potValue: getBettingLevelValue(level), // Required field
});

const createMockGameSession = (
  id: string,
  dollar1: VirtualDollar,
  dollar2: VirtualDollar,
  level: BettingLevel = 1
) => ({
  id,
  dollar1,
  dollar2,
  winner: dollar1, // Set a winner for completed game sessions
  loser: dollar2,
  level,
  platformFee: 0.2, // $0.20 per game (game rules)
  timestamp: new Date(),
  gameNumber: 1,
  dailySeed: "2025-09-08",
  dollar1Score: 0,
  dollar2Score: 0,
  winnings: getBettingLevelValue(level) * 1.8, // CryptoZing winnings formula
  isCompleted: true,
  duration: 0,
  randomSeed: 12345,
});

describe("GameEventHandler", () => {
  let eventBus: EventBus;
  let gameEventHandler: GameEventHandler;
  let mockGameMatchingEngine: Partial<GameMatchingEngine>;
  let mockRevenueCalculator: Partial<RevenueCalculator>;

  beforeEach(() => {
    eventBus = new EventBus({ enableTracing: true });

    // Mock GameMatchingEngine
    mockGameMatchingEngine = {
      resolveGame: vi.fn(),
      getGameSession: vi.fn(),
    };

    // Mock RevenueCalculator
    mockRevenueCalculator = {
      processGameRevenue: vi.fn(),
    };

    gameEventHandler = new GameEventHandler(
      eventBus,
      mockGameMatchingEngine as GameMatchingEngine,
      mockRevenueCalculator as RevenueCalculator
    );
  });

  afterEach(() => {
    gameEventHandler.dispose();
    eventBus.dispose();
  });

  describe("Game Resolution Scenarios", () => {
    it("should handle basic game resolution with CryptoZing winnings formula", async () => {
      // Arrange
      const dollar1 = createMockVirtualDollar("dollar-1", "player-1", 3); // Level 3 = $4 bet (2^(3-1) = 4)
      const dollar2 = createMockVirtualDollar("dollar-2", "player-2", 3);
      const gameSession = createMockGameSession("game-1", dollar1, dollar2, 3);

      // Mock successful game resolution
      (mockGameMatchingEngine.resolveGame as any).mockReturnValue({
        success: true,
        gameId: "game-1",
        winner: dollar1,
        loser: dollar2,
        winnings: 7.2, // Level 3 value (4) × 1.8 = $7.20 (CryptoZing formula)
      });

      (mockGameMatchingEngine.getGameSession as any).mockReturnValue({
        ...gameSession,
        winner: dollar1,
        loser: dollar2,
      });

      const gameResolvedHandler = vi.fn();
      eventBus.on<GameResolvedEvent>(
        EVENT_TYPES.GAME_RESOLVED,
        gameResolvedHandler
      );

      // Act
      const gameCreatedEvent: GameCreatedEvent = {
        type: EVENT_TYPES.GAME_CREATED,
        timestamp: new Date(),
        gameId: "game-1",
        player1Id: "player-1",
        player2Id: "player-2",
        player1Level: 3,
        player2Level: 3,
        virtualDollar1Id: "dollar-1",
        virtualDollar2Id: "dollar-2",
      };

      await eventBus.emit(EVENT_TYPES.GAME_CREATED, gameCreatedEvent);

      // Assert
      expect(mockGameMatchingEngine.resolveGame).toHaveBeenCalledWith(
        "game-1",
        "2025-09-08"
      );
      expect(gameResolvedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EVENT_TYPES.GAME_RESOLVED,
          gameId: "game-1",
          winnerId: "player-1",
          loserId: "player-2",
          winnerLevel: 3,
          loserLevel: 3,
          winnerDollarId: "dollar-1",
          loserDollarId: "dollar-2",
          winnings: 7.2, // CryptoZing winnings formula
          gameResult: "WIN",
        })
      );
    });

    it("should handle jackpot level (10) with special $1024 winnings", async () => {
      // Arrange - Level 10 (jackpot level, value = $512)
      const dollar1 = createMockVirtualDollar("dollar-1", "player-1", 10);
      const dollar2 = createMockVirtualDollar("dollar-2", "player-2", 10);
      const gameSession = createMockGameSession(
        "game-jackpot",
        dollar1,
        dollar2,
        10
      );

      // Mock jackpot resolution - both players get jackpot in the rules
      (mockGameMatchingEngine.resolveGame as any).mockReturnValue({
        success: true,
        gameId: "game-jackpot",
        winner: dollar1,
        loser: dollar2,
        winnings: 1024, // Jackpot amount from game rules
      });

      (mockGameMatchingEngine.getGameSession as any).mockReturnValue({
        ...gameSession,
        winner: dollar1,
        loser: dollar2,
        winnings: 1024,
      });

      const gameResolvedHandler = vi.fn();
      eventBus.on<GameResolvedEvent>(
        EVENT_TYPES.GAME_RESOLVED,
        gameResolvedHandler
      );

      // Act
      const jackpotGameEvent: GameCreatedEvent = {
        type: EVENT_TYPES.GAME_CREATED,
        timestamp: new Date(),
        gameId: "game-jackpot",
        player1Id: "player-1",
        player2Id: "player-2",
        player1Level: 10,
        player2Level: 10,
        virtualDollar1Id: "dollar-1",
        virtualDollar2Id: "dollar-2",
      };

      await eventBus.emit(EVENT_TYPES.GAME_CREATED, jackpotGameEvent);

      // Assert
      expect(gameResolvedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          winnings: 1024, // Jackpot winnings
          winnerLevel: 10,
          loserLevel: 10,
        })
      );
    });

    it("should emit revenue processing events with $0.20 platform fee", async () => {
      // Arrange
      const dollar1 = createMockVirtualDollar("dollar-1", "player-1", 2);
      const dollar2 = createMockVirtualDollar("dollar-2", "player-2", 2);
      const gameSession = createMockGameSession("game-1", dollar1, dollar2, 2);

      (mockGameMatchingEngine.resolveGame as any).mockReturnValue({
        success: true,
        gameId: "game-1",
        winner: dollar1,
        loser: dollar2,
        winnings: 3.6, // Level 2 × 1.8 = $3.60
      });

      (mockGameMatchingEngine.getGameSession as any).mockReturnValue({
        ...gameSession,
        winner: dollar1,
        loser: dollar2,
      });

      const revenueProcessedHandler = vi.fn();
      eventBus.on<RevenueGameProcessedEvent>(
        EVENT_TYPES.REVENUE_GAME_PROCESSED,
        revenueProcessedHandler
      );

      // Act
      const gameCreatedEvent: GameCreatedEvent = {
        type: EVENT_TYPES.GAME_CREATED,
        timestamp: new Date(),
        gameId: "game-1",
        player1Id: "player-1",
        player2Id: "player-2",
        player1Level: 2,
        player2Level: 2,
        virtualDollar1Id: "dollar-1",
        virtualDollar2Id: "dollar-2",
      };

      await eventBus.emit(EVENT_TYPES.GAME_CREATED, gameCreatedEvent);

      // Assert
      expect(mockRevenueCalculator.processGameRevenue).toHaveBeenCalled();
      expect(revenueProcessedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EVENT_TYPES.REVENUE_GAME_PROCESSED,
          gameId: "game-1",
          platformRevenue: 0.2, // Fixed $0.20 platform fee per game
          gameRevenue: expect.any(Number),
        })
      );
    });

    it("should handle game resolution errors gracefully", async () => {
      // Arrange
      // Mock failed resolution
      (mockGameMatchingEngine.resolveGame as any).mockReturnValue({
        success: false,
        gameId: "game-error",
        winnings: 0,
        error: "Game resolution failed - invalid daily seed",
      });

      const errorHandler = vi.fn();
      eventBus.on("EVENT_ERROR", errorHandler);

      // Act
      const gameCreatedEvent: GameCreatedEvent = {
        type: EVENT_TYPES.GAME_CREATED,
        timestamp: new Date(),
        gameId: "game-error",
        player1Id: "player-1",
        player2Id: "player-2",
        player1Level: 1,
        player2Level: 1,
        virtualDollar1Id: "dollar-1",
        virtualDollar2Id: "dollar-2",
      };

      await eventBus.emit(EVENT_TYPES.GAME_CREATED, gameCreatedEvent);

      // Assert
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "EVENT_ERROR",
          eventType: "GAME_RESOLUTION_ERROR",
          error: "Game resolution failed - invalid daily seed",
        })
      );
    });

    it("should handle missing game session data", async () => {
      // Arrange
      (mockGameMatchingEngine.resolveGame as any).mockReturnValue({
        success: true,
        gameId: "game-missing",
        winnings: 0,
      });

      // Mock missing game session
      (mockGameMatchingEngine.getGameSession as any).mockReturnValue(null);

      const errorHandler = vi.fn();
      eventBus.on("EVENT_ERROR", errorHandler);

      // Act
      const gameCreatedEvent: GameCreatedEvent = {
        type: EVENT_TYPES.GAME_CREATED,
        timestamp: new Date(),
        gameId: "game-missing",
        player1Id: "player-1",
        player2Id: "player-2",
        player1Level: 1,
        player2Level: 1,
        virtualDollar1Id: "dollar-1",
        virtualDollar2Id: "dollar-2",
      };

      await eventBus.emit(EVENT_TYPES.GAME_CREATED, gameCreatedEvent);

      // Assert
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "GAME_RESOLUTION_ERROR",
          error: expect.stringContaining("missing winner/loser data"),
        })
      );
    });
  });

  describe("Integration with Game Rules", () => {
    it("should validate betting levels match game rules [1,2,4,8,16,32,64,128,256,512]", async () => {
      const validLevels: BettingLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // BettingLevel 1-10 maps to values [1,2,4,8,16,32,64,128,256,512]

      for (const level of validLevels) {
        const dollar1 = createMockVirtualDollar("dollar-1", "player-1", level);
        const dollar2 = createMockVirtualDollar("dollar-2", "player-2", level);
        const expectedWinnings =
          level === 10 ? 1024 : getBettingLevelValue(level) * 1.8;

        (mockGameMatchingEngine.resolveGame as any).mockReturnValue({
          success: true,
          gameId: `game-level-${level}`,
          winner: dollar1,
          loser: dollar2,
          winnings: expectedWinnings,
        });

        (mockGameMatchingEngine.getGameSession as any).mockReturnValue(
          createMockGameSession(`game-level-${level}`, dollar1, dollar2, level)
        );

        const gameResolvedHandler = vi.fn();
        eventBus.on<GameResolvedEvent>(
          EVENT_TYPES.GAME_RESOLVED,
          gameResolvedHandler
        );

        const gameCreatedEvent: GameCreatedEvent = {
          type: EVENT_TYPES.GAME_CREATED,
          timestamp: new Date(),
          gameId: `game-level-${level}`,
          player1Id: "player-1",
          player2Id: "player-2",
          player1Level: level,
          player2Level: level,
          virtualDollar1Id: "dollar-1",
          virtualDollar2Id: "dollar-2",
        };

        await eventBus.emit(EVENT_TYPES.GAME_CREATED, gameCreatedEvent);

        expect(gameResolvedHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            winnings: expectedWinnings,
            winnerLevel: level,
            loserLevel: level,
          })
        );

        // Clean up handler for next iteration
        eventBus.off(EVENT_TYPES.GAME_RESOLVED, gameResolvedHandler);
      }
    });

    it("should use deterministic daily seed for consistent resolution", async () => {
      // Arrange
      const dollar1 = createMockVirtualDollar("dollar-1", "player-1", 1);
      const dollar2 = createMockVirtualDollar("dollar-2", "player-2", 1);

      (mockGameMatchingEngine.resolveGame as any).mockReturnValue({
        success: true,
        gameId: "game-seed-test",
        winner: dollar1,
        loser: dollar2,
        winnings: 1.8,
      });

      // Act
      const gameCreatedEvent: GameCreatedEvent = {
        type: EVENT_TYPES.GAME_CREATED,
        timestamp: new Date(),
        gameId: "game-seed-test",
        player1Id: "player-1",
        player2Id: "player-2",
        player1Level: 1,
        player2Level: 1,
        virtualDollar1Id: "dollar-1",
        virtualDollar2Id: "dollar-2",
      };

      await eventBus.emit(EVENT_TYPES.GAME_CREATED, gameCreatedEvent);

      // Assert - Daily seed should be passed for deterministic resolution
      expect(mockGameMatchingEngine.resolveGame).toHaveBeenCalledWith(
        "game-seed-test",
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) // YYYY-MM-DD format
      );
    });
  });

  describe("Event Flow Integration", () => {
    it("should maintain proper event order: GAME_CREATED → GAME_RESOLVED → REVENUE_GAME_PROCESSED", async () => {
      // Arrange
      const eventOrder: string[] = [];
      const dollar1 = createMockVirtualDollar("dollar-1", "player-1", 1);
      const dollar2 = createMockVirtualDollar("dollar-2", "player-2", 1);

      (mockGameMatchingEngine.resolveGame as any).mockReturnValue({
        success: true,
        gameId: "game-flow",
        winner: dollar1,
        loser: dollar2,
        winnings: 1.8,
      });

      (mockGameMatchingEngine.getGameSession as any).mockReturnValue(
        createMockGameSession("game-flow", dollar1, dollar2, 1)
      );

      // Track event order
      eventBus.on(EVENT_TYPES.GAME_RESOLVED, () => {
        eventOrder.push("GAME_RESOLVED");
      });
      eventBus.on(EVENT_TYPES.REVENUE_GAME_PROCESSED, () => {
        eventOrder.push("REVENUE_GAME_PROCESSED");
      });

      // Act
      const gameCreatedEvent: GameCreatedEvent = {
        type: EVENT_TYPES.GAME_CREATED,
        timestamp: new Date(),
        gameId: "game-flow",
        player1Id: "player-1",
        player2Id: "player-2",
        player1Level: 1,
        player2Level: 1,
        virtualDollar1Id: "dollar-1",
        virtualDollar2Id: "dollar-2",
      };

      await eventBus.emit(EVENT_TYPES.GAME_CREATED, gameCreatedEvent);

      // Assert proper event flow
      expect(eventOrder).toEqual(["GAME_RESOLVED", "REVENUE_GAME_PROCESSED"]);
    });
  });
});
