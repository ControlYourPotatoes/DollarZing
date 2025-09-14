# Event System Integration Specification

> Spec: Complete Event-Driven Architecture Integration
> Created: 2025-09-07
> Status: Planning
> Context: Agent-assisted coding continuation

## Overview

Complete the event-driven architecture transformation by properly integrating the event system throughout the simulation components, starting from the bottom of the dependency tree (DayProcessor, GameEngineSimulator) and working up to their parent orchestrators.

**Note**: This spec is fully aligned with the event-driven-data-flow.md documentation, incorporating all critical fixes and architectural clarifications from v1.1.2.

## Current State Analysis

### ✅ What's Working

- **Event System Foundation**: Comprehensive event types and EventBus implementation
- **Event Handlers**: Complete set of event handlers (GameEventHandler, PlayerProgressionHandler, etc.)
- **MatchmakingEventHandler**: NEW - Fully implemented matchmaking logic with FIFO ordering
- **GameMatchingEngine**: Pool management with event emission (attemptMatching method removed)
- **Event Types**: Rich event type definitions with proper TypeScript interfaces
- **Event Flow Documentation**: Comprehensive event-driven data flow patterns defined
- **Event Priority System**: Well-defined priority system (15→12→10→8→0)
- **Event Naming**: Updated to use VIRTUAL*DOLLAR*\* events for clarity
- **Legacy Deprecation**: Properly marked deprecated methods and patterns

### ❌ Critical Issues Found

#### 1. **DayProcessor Event Integration Incomplete**

- **Problem**: DayProcessor still has references to old direct method calls (now deprecated)
- **Evidence**: Lines 99-120 in `day-processor.ts` have comments about deprecated `attemptMatching()` approach
- **Impact**: ✅ RESOLVED - Now uses MatchmakingEventHandler automatically via events
- **Status**: DayProcessor correctly relies on event-driven matchmaking through MatchmakingEventHandler

#### 2. **GameEngineSimulator Mixed Architecture**

- **Problem**: GameEngineSimulator mixes event-driven and direct component access
- **Evidence**: Lines 310-366 create components directly instead of using event system
- **Impact**: Creates tight coupling, defeats purpose of event-driven architecture

#### 3. **Missing Event Flow Chains**

- **Problem**: No clear event flow from DAY_STARTED → GAME_CREATED → GAME_RESOLVED → VIRTUAL_DOLLAR_ADVANCED
- **Evidence**: DayProcessor emits DAY_STARTED but doesn't trigger game creation events
- **Impact**: Event handlers are registered but never receive events

#### 4. **Component Creation Anti-Pattern**

- **Problem**: GameEngineSimulator creates DayProcessor and PlayerManager instances directly
- **Evidence**: Lines 311-356 use dynamic imports and direct instantiation
- **Impact**: Violates dependency injection, makes testing difficult

#### 5. **Test Files Reference Deprecated Methods**

- **Problem**: Test files still mock and test deprecated methods that no longer exist
- **Evidence**: `day-processor.test.ts` references `attemptMatching`, `player-progression-handler.test.ts` references `ProgressionManager`
- **Impact**: Tests may fail or provide false confidence about deprecated functionality

### ✅ Issues Resolved Since Last Analysis

#### **MatchmakingEventHandler Implementation**

- **Status**: ✅ **IMPLEMENTED** - Complete matchmaking logic now handled by dedicated event handler
- **Location**: `/workspace/engine/src/events/handlers/matchmaking-event-handler.ts`
- **Improvement**: FIFO ordering, detailed event emission, concurrent game limits

#### **GameMatchingEngine Abstraction**

- **Status**: ✅ **CLEANED UP** - Removed `attemptMatching()` method, now focuses on pool management
- **Location**: `/workspace/engine/src/types/game-matching-engine.ts:233`
- **Improvement**: Clear separation of concerns - pool management vs matchmaking logic

#### **PoolManagementHandler Removal**

- **Status**: ✅ **REMOVED** - Redundant handler eliminated, re-pooling logic moved to PlayerProgressionHandler
- **Location**: `/workspace/engine/src/events/handlers/pool-management-handler.ts` (deleted)
- **Improvement**: Fixed state mismatch issue where handler expected POOLED state but received WON state
- **Fix Applied**: Re-pooling logic now integrated directly into PlayerProgressionHandler.rePoolAdvancedWinner()

#### **MatchmakingEventHandler Cleanup**
- **Status**: ✅ **CLEANED UP** - Removed unused ScoringEngine dependency
- **Location**: `/workspace/engine/src/events/handlers/matchmaking-event-handler.ts:10,43`
- **Issue**: ScoringEngine parameter was declared but never used (belongs in GameEventHandler)
- **Fix Applied**: Removed unused import and constructor parameter

## Intended Event Flow Architecture

### **Complete Event Flow Chain** (Based on event-driven-data-flow.md)

```
Simulation Start
    ↓
SIMULATION_STARTED event
    ↓
For each day:
    DAY_STARTED event (with growth model parameters)
        ↓
    PLAYER_CREATED events (S-curve growth)
        ↓
    NEW_RUN_CREATED events (virtual dollar allocation)
        ↓
    POOL_ADDED events (dollars enter matching pool)
        ↓
    POOL_UPDATED events (2+ virtual dollars at same level)
        ↓
    GAME_CREATED events (GameMatchingEngine creates 1v1 match)
        ↓
    GAME_RESOLVED events (GameEventHandler processes result)
        ↓
    GAME_COMPLETED events (individual game always completes)
        ↓
    CASH_OUT_DECISION events (winners decide at current level)
        ↓
    ┌─ CASH_OUT path ─────────────┐  ┌─ CONTINUE path ───────────┐
    │ CASH_OUT_COMPLETED          │  │ CONTINUE_PLAY             │
    │ VIRTUAL_DOLLAR_RUN_COMPLETED│  │ VIRTUAL_DOLLAR_ADVANCED   │
    │ PLAYER_TOTAL_WINNINGS_UPDATED│  │ RE_POOL_REQUEST          │
    └─────────────────────────────┘  └──────────────────────────┘
        ↓
    DAY_COMPLETED event
    ↓
SIMULATION_COMPLETED event
```

### **Event Handler Responsibilities** (Updated per event-driven-data-flow.md v1.2.0)

#### **MatchmakingEventHandler** (NEW - Fully Implemented)

- Listen to POOL_ADDED and POOL_UPDATED events
- Handle all matchmaking logic with FIFO ordering
- Emit comprehensive matchmaking events (MATCHMAKING_ATTEMPTED, PLAYER_WAITING, MATCH_FOUND, etc.)
- Manage concurrent game limits and pool capacity
- Priority 10 (high priority for responsive matching)

#### **DayProcessor** (Event Orchestrator)

- Emit DAY_STARTED and DAY_COMPLETED events
- Coordinate daily simulation flow through events only
- No direct component method calls

#### **PlayerManager** (Event Listener)

- Listen to DAY_STARTED events
- Create new runs and emit NEW_RUN_CREATED events
- Manage player lifecycle through events

#### **GameMatchingEngine** (Event Emitter)

- Listen to POOL_UPDATED events (2+ virtual dollars at same level)
- Emit GAME_CREATED events when matches found
- No direct game resolution

#### **GameEventHandler** (Event Processor)

- Listen to GAME_CREATED events
- Resolve games and emit GAME_RESOLVED, GAME_COMPLETED events
- Emit REVENUE_GAME_PROCESSED events
- Handle game logic through events
- Priority 10 (core resolution)

#### **CashOutDecisionHandler** (Event Processor)

- Listen to GAME_RESOLVED events
- Emit CASH_OUT_DECISION events (decide at current level)
- Emit CASH_OUT_COMPLETED or CONTINUE_PLAY events
- Priority 15 (highest - decisions happen first)

#### **PlayerProgressionHandler** (Event Processor)

- Listen to CONTINUE_PLAY events (winners only)
- Listen to GAME_RESOLVED events (losers)
- Emit VIRTUAL_DOLLAR_ADVANCED events
- Emit VIRTUAL_DOLLAR_RUN_COMPLETED events
- Emit PLAYER_TOTAL_WINNINGS_UPDATED events
- Priority 12 (after cash-out decisions)

#### **PoolManagementHandler** (Event Processor)

- Listen to VIRTUAL_DOLLAR_ADVANCED, CASH_OUT_COMPLETED, NEW_RUN_CREATED events
- Emit RE_POOL_REQUEST, POOL_ADDED, POOL_REMOVED, POOL_UPDATED events
- Manage virtual dollar pool state
- Priority 8 (after player progression)

#### **RevenueTrackingHandler** (Event Processor)

- Listen to REVENUE_GAME_PROCESSED, REVENUE_CASH_OUT_PROCESSED events
- Emit REVENUE_UPDATE events
- Priority 0 (lowest - async financial tracking)

## Proposed Project Structure

```
engine/src/
├── simulation/
│   ├── game-engine-simulator.ts          # Pure event orchestrator
│   ├── day-processor.ts                  # Event-driven daily coordinator
│   ├── player-manager.ts                 # Event-driven player lifecycle
│   └── game-processor.ts                 # Event-driven game resolution
├── events/
│   ├── event-bus.ts                      # Central event dispatcher
│   ├── event-types.ts                    # Event type definitions
│   └── handlers/
│       ├── game-event-handler.ts         # Game resolution events
│       ├── player-progression-handler.ts # Player advancement events
│       ├── pool-management-handler.ts    # Pool management events
│       ├── cash-out-decision-handler.ts  # Cash-out decision events
│       └── revenue-tracking-handler.ts   # Revenue tracking events
├── types/
│   ├── game-matching-engine.ts           # Event-emitting game matching
│   ├── virtual-dollar-factory.ts         # Event-emitting dollar creation
│   └── revenue-calculator.ts             # Event-emitting revenue tracking
└── cli/
    └── orchestrator/
        ├── mapping/
        │   ├── parameter-mapper.ts        # Core mapping (100 lines)
        │   ├── growth-model-mapper.ts     # Growth mapping (80 lines)
        │   └── strategy-mapper.ts         # Strategy mapping (60 lines)
        └── execution/
            ├── dataset-orchestrator.ts   # Event-driven dataset generation
            └── game-engine-adapter.ts    # Event-driven simulation adapter
```

## Task Breakdown

### **Phase 1: Fix DayProcessor Event Integration** ✅ COMPLETED

- [x] 1.1 Remove direct `gameMatchingEngine.attemptMatching()` calls ✅ DONE
- [x] 1.2 Replace with event emission via MatchmakingEventHandler ✅ DONE
- [x] 1.3 MatchmakingEventHandler listens to POOL_ADDED/POOL_UPDATED events ✅ DONE
- [x] 1.4 GAME_CREATED events flow from MatchmakingEventHandler ✅ DONE
- [x] 1.5 Complete event flow: POOL_UPDATED → GAME_CREATED → GAME_RESOLVED ✅ DONE

### **Phase 2: Refactor GameEngineSimulator to Pure Event Orchestrator**

- [ ] 2.1 Remove direct component instantiation (lines 310-356)
- [ ] 2.2 Use dependency injection for all components
- [ ] 2.3 Emit SIMULATION_STARTED event at beginning
- [ ] 2.4 Emit SIMULATION_COMPLETED event at end
- [ ] 2.5 Remove direct method calls to components

### **Phase 3: Complete Event Handler Integration** ✅ MOSTLY COMPLETED

- [x] 3.1 All event handlers are properly registered ✅ DONE
- [x] 3.2 Event handlers receive and process events correctly ✅ DONE
- [x] 3.3 Complete event types implemented ✅ DONE
- [x] 3.4 Event handler isolation achieved ✅ DONE
- [ ] 3.5 Add event tracing and debugging capabilities ⚠️ PENDING

### **Phase 4: Update Parent Orchestrators**

- [ ] 4.1 Update DatasetOrchestrator to use event-driven GameEngineSimulator
- [ ] 4.2 Update GameEngineAdapter to use event-driven architecture
- [ ] 4.3 Ensure all CLI commands work with event-driven system
- [ ] 4.4 Test complete end-to-end event flow

### **Phase 5: Testing and Validation** ⚠️ HIGH PRIORITY

- [ ] 5.1 Update test files to remove deprecated method mocks ⚠️ **CRITICAL**
- [ ] 5.2 Fix `day-processor.test.ts` - Remove `attemptMatching` references
- [ ] 5.3 Fix `player-progression-handler.test.ts` - Remove `ProgressionManager` references
- [ ] 5.4 Test error handling and event recovery
- [ ] 5.5 Verify all existing functionality preserved with new event system

## **IMMEDIATE ACTION ITEMS** ⚠️

### **1. Test File Updates (HIGH PRIORITY)**

The following test files contain references to deprecated/removed functionality and need immediate attention:

- **`/workspace/engine/src/simulation/day-processor.test.ts`**

  - ❌ References `attemptMatching` method (removed from GameMatchingEngine)
  - ✅ Update to test event-driven approach via MatchmakingEventHandler

- **`/workspace/engine/src/events/handlers/player-progression-handler.test.ts`**
  - ❌ References `ProgressionManager` class (deleted)
  - ✅ Update to test direct PlayerProgressionHandler functionality

### **2. Legacy Code Cleanup (MEDIUM PRIORITY)**

- **`/workspace/engine/src/index.ts:50`** - Still exports `ProgressionManager` as `PlayerRunManager`
- **Deprecated method warnings** - Consider removing deprecated methods entirely
- **Event type cleanup** - Remove deprecated event types from `event-types.ts`

### **Phase 6: Mapping Separation (DatasetOrchestrator Refactor)**

- [ ] 6.1 Create `parameter-mapper.ts` - Extract core parameter mapping logic
- [ ] 6.2 Create `growth-model-mapper.ts` - Extract growth model mapping logic
- [ ] 6.3 Create `strategy-mapper.ts` - Extract strategy mapping logic
- [ ] 6.4 Update `dataset-orchestrator.ts` to use mapping modules
- [ ] 6.5 Remove mapping logic from `dataset-orchestrator.ts`
- [ ] 6.6 Test mapping separation maintains functionality
- [ ] 6.7 Update imports and dependencies across CLI tools

## Context for Agent-Assisted Coding

### **Key Files to Focus On**

1. **`engine/src/simulation/day-processor.ts`** - Primary target for event integration
2. **`engine/src/simulation/game-engine-simulator.ts`** - Remove direct component access
3. **`engine/src/types/game-matching-engine.ts`** - Ensure event emission
4. **`engine/src/events/handlers/`** - Verify all handlers work correctly
5. **`engine/cli/src/orchestrator/mapping/`** - New mapping modules (Phase 6)
6. **`engine/cli/src/orchestrator/execution/dataset-orchestrator.ts`** - Refactor to use mapping modules

### **Critical Event Flow Points** (Per event-driven-data-flow.md)

- **DAY_STARTED** → PlayerManager → NEW_RUN_CREATED → PoolManagementHandler
- **POOL_UPDATED** → GameMatchingEngine → GAME_CREATED → GameEventHandler
- **GAME_RESOLVED** → CashOutDecisionHandler → CASH_OUT_DECISION (Priority 15)
- **CASH_OUT_DECISION** → CASH_OUT_COMPLETED or CONTINUE_PLAY
- **CONTINUE_PLAY** → PlayerProgressionHandler → VIRTUAL_DOLLAR_ADVANCED (Priority 12)
- **VIRTUAL_DOLLAR_ADVANCED** → PoolManagementHandler → RE_POOL_REQUEST (Priority 8)

### **Event Priority System** (Per event-driven-data-flow.md)

```
Priority 15: CashOutDecisionHandler (decision processing - highest)
Priority 12: PlayerProgressionHandler (immediate progression)
Priority 10: GameEventHandler (core resolution)
Priority 8:  PoolManagementHandler (pool management)
Priority 0:  RevenueTrackingHandler (async financial tracking - lowest)
```

### **Testing Strategy**

- Start with unit tests for individual event handlers
- Add integration tests for event flow chains
- Test complete simulation runs with event tracing
- Verify performance doesn't degrade with event system
- Follow event-driven-data-flow.md patterns for validation

### **Success Criteria**

- All simulation logic flows through events only
- No direct component method calls in orchestrators
- Complete event flow from start to finish
- All existing functionality preserved
- Performance maintained or improved
- Follows event-driven-data-flow.md patterns

## Expected Deliverable

A fully event-driven simulation architecture where:

1. **DayProcessor** coordinates daily simulation through events only
2. **GameEngineSimulator** orchestrates simulation through events only
3. **All components** communicate through the event system
4. **Event handlers** are isolated and independently testable
5. **Complete event flow** from simulation start to completion
6. **Parent orchestrators** work seamlessly with event-driven system
7. **Follows event-driven-data-flow.md** patterns and priorities

This will provide a clean, maintainable, and extensible architecture that supports the Virtual Dollar Pool Engine mechanics and enables easy testing and debugging through event tracing.
