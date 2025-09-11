● Based on my analysis, I can now propose a comprehensive refactoring plan. The GameMatchingEngine is indeed in a hybrid state and needs full event-driven
  integration.

● GameMatchingEngine Event-Driven Refactoring Plan

  Current State Analysis ✅

  GameMatchingEngine Status: HYBRID
  - ✅ Has optional EventBus integration
  - ✅ Emits GAME_CREATED events to centralized EventBus
  - ❌ Still uses legacy internal event system
  - ❌ Missing detailed matchmaking events (pool updates, waiting states, etc.)
  - ❌ Has unused hybrid architecture complexity

  Event-Driven Architecture Patterns Identified

  From analyzing the existing system, I see these consistent patterns:

  1. Event Handler Pattern: GameEventHandler, PoolManagementHandler - Clean classes that subscribe to specific events with priority levels
  2. Centralized EventBus: All events flow through one EventBus with typed event interfaces
  3. Event Priority System: Handlers have priority levels (10 = high, 5 = medium)
  4. Event-First Design: Handlers listen for events rather than being called directly
  5. Comprehensive Event Types: Detailed event interfaces in event-types.ts

  Missing Matchmaking Events ❌

  The matchmaking process needs these additional events:

  // Already exists in event-types.ts but GameMatchingEngine doesn't emit them
  POOL_ADDED: "POOL_ADDED"           // ✅ Exists but not emitted
  POOL_REMOVED: "POOL_REMOVED"       // ✅ Exists but not emitted
  POOL_UPDATED: "POOL_UPDATED"       // ✅ Exists but not emitted
  POOL_CAPACITY_REACHED: "POOL_CAPACITY_REACHED"  // ✅ Exists but not emitted

  // Missing entirely - need to add
  MATCHMAKING_ATTEMPTED: "MATCHMAKING_ATTEMPTED"
  PLAYER_WAITING: "PLAYER_WAITING"
  MATCH_FOUND: "MATCH_FOUND"
  FIFO_QUEUE_UPDATED: "FIFO_QUEUE_UPDATED"

  Proposed Refactoring Plan

  Task 1: Add Missing Event Types

  File: engine/src/events/event-types.ts

  Add these new event interfaces:

  export interface MatchmakingAttemptedEvent extends BaseEvent {
    type: "MATCHMAKING_ATTEMPTED";
    poolSnapshot: {
      totalDollarsInPool: number;
      dollarsAvailableForMatching: number;
      levelDistribution: Record<number, number>;
    };
    concurrentGamesCount: number;
    maxConcurrentGames: number;
  }

  export interface PlayerWaitingEvent extends BaseEvent {
    type: "PLAYER_WAITING";
    virtualDollarId: string;
    playerId: string;
    waitingAtLevel: number;
    queuePosition: number; // 1 = first in queue
    playersNeededForMatch: number; // Usually 1 (need 1 more for pair)
  }

  export interface MatchFoundEvent extends BaseEvent {
    type: "MATCH_FOUND";
    virtualDollar1Id: string;
    virtualDollar2Id: string;
    player1Id: string;
    player2Id: string;
    matchedLevel: number;
    fifoOrder: { player1Position: number; player2Position: number };
  }

  export interface FifoQueueUpdatedEvent extends BaseEvent {
    type: "FIFO_QUEUE_UPDATED";
    level: number;
    queueLength: number;
    waitingPlayerIds: string[]; // Ordered by createdAt (FIFO)
  }

  Task 2: Create MatchmakingEventHandler

  File: engine/src/events/handlers/matchmaking-event-handler.ts

  New handler that encapsulates all matchmaking logic:

  export class MatchmakingEventHandler {
    // Listens to: POOL_ADDED, POOL_UPDATED events
    // Emits: MATCHMAKING_ATTEMPTED, PLAYER_WAITING, MATCH_FOUND, FIFO_QUEUE_UPDATED
    // Contains: attemptMatching() logic from GameMatchingEngine
  }

  Task 3: Refactor GameMatchingEngine

  File: engine/src/types/game-matching-engine.ts

  Remove:
  - Legacy internal event system (eventListeners Map)
  - attemptMatching() method (move to MatchmakingEventHandler)
  - Hybrid EventBus (make it required)

  Keep:
  - Pool management (addToPool, removeFromPool)
  - Game creation (createGameSession)
  - Game resolution (resolveGame)
  - Statistics and querying methods

  Make EventBus Required:
  constructor(
    dollarManager: VirtualDollarManager,
    scoringEngine: ScoringEngine,
    gameSessionFactory: GameSessionFactory,
    eventBus: EventBus  // Required, not optional
  )

  Task 4: Emit Detailed Events

  Update GameMatchingEngine methods to emit proper events:

  // addToPool() should emit:
  POOL_ADDED -> { virtualDollarId, playerId, currentLevel, poolSize, availableForMatching }
  FIFO_QUEUE_UPDATED -> { level, queueLength, waitingPlayerIds }

  // removeFromPool() should emit:
  POOL_REMOVED -> { virtualDollarId, playerId, reason, poolSize, availableForMatching }
  FIFO_QUEUE_UPDATED -> { level, queueLength, waitingPlayerIds }

  // When pool capacity reached:
  POOL_CAPACITY_REACHED -> { currentPoolSize, maxCapacity, rejectedDollarId }

  Task 5: Update Event Constants

  Add missing constants to EVENT_TYPES:

  // Add to EVENT_TYPES object
  MATCHMAKING_ATTEMPTED: "MATCHMAKING_ATTEMPTED",
  PLAYER_WAITING: "PLAYER_WAITING",
  MATCH_FOUND: "MATCH_FOUND",
  FIFO_QUEUE_UPDATED: "FIFO_QUEUE_UPDATED",

  Task 6: Integration Testing

  File: engine/src/events/event-system-integration.test.ts

  Update integration tests to verify:
  - Pool events are emitted properly
  - MatchmakingEventHandler receives and processes events correctly
  - FIFO queue events track odd-number scenarios
  - GameMatchingEngine no longer handles matchmaking directly

  Task 7: Clean Up Legacy Code

  Remove backward compatibility:
  - Remove GameEventType union (lines 21-25 in game-matching-engine.ts)
  - Remove GameEvent interface (lines 27-37)
  - Remove internal emit() method (lines 621-632)
  - Remove on(), off() methods (lines 598-616)

  Implementation Benefits

  1. Single Responsibility: GameMatchingEngine focuses on pool/game management, MatchmakingEventHandler handles matching logic
  2. Complete Event Visibility: All matchmaking states (waiting, queue position, FIFO order) are now observable
  3. Testability: Each component can be tested in isolation with event mocking
  4. Consistency: Follows established event-driven patterns used by other handlers
  5. Performance: No more legacy event system overhead

  Risk Mitigation

  - Keep existing GameMatchingEngine methods working during transition
  - Add comprehensive tests before removing legacy code
  - Ensure all existing GAME_CREATED events continue working
  - Validate pool statistics remain accurate throughout refactor

  Would you like me to start implementing this refactoring plan? I recommend beginning with Task 1 (adding missing event types) as it provides the foundation for    
   all subsequent changes.