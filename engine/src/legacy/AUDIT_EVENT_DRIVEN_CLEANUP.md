# Event-Driven Architecture Cleanup Audit

**Date:** 2025-01-14
**Context:** Fixing test-game.ts CLI to use proper event-driven architecture
**Issue:** Components in `/types` directory contain mix of event-driven and legacy/outdated code

## Executive Summary

The `/simulation` directory components (`player-manager.ts`, `day-processor.ts`) are **already event-driven** but have broken dependencies on outdated `/types` components. The main issue is missing concrete implementations and legacy dependencies that need cleanup.

---

## Component Audit Results

### ✅ **CONFIRMED EVENT-DRIVEN & CURRENT**

#### Core Working Components
- **`direct-factories.ts`** ✅
  - Contains `UnifiedVirtualDollarFactory` and `DirectGameSessionFactory`
  - Fully event-driven and integrated
  - Used successfully in integration tests
  - **Status:** Keep, no changes needed

- **`factory-interfaces.ts`** ✅
  - Core interfaces for factory pattern
  - Contains `VirtualDollarFactory`, `GameSessionFactory`, `PerformanceConfig`
  - **Status:** Keep, no changes needed

- **`virtual-dollar-engine.ts`** ✅
  - Core types and interfaces (`VirtualDollar`, `GameSession`, etc.)
  - Foundation of the event system
  - **Status:** Keep, no changes needed

- **`game-matching-engine.ts`** ✅
  - Contains `GameMatchingEngine` class
  - Event-integrated (has `setEventBus()` method)
  - Used successfully in integration tests
  - **Status:** Keep, no changes needed

- **`revenue-calculator.ts`** ✅
  - Contains `RevenueCalculator` class
  - Working in event-driven context
  - **Status:** Keep, no changes needed

### ❌ **DEPRECATED/LEGACY - READY FOR REMOVAL**

#### Broken Dependencies
- **`player-run-manager.ts`** ❌
  - **Problem:** Interface-only, no concrete implementation
  - **Used by:** `/simulation/player-manager.ts` (but shouldn't be)
  - **Status:** Remove or create implementation
  - **Action:** Remove dependency from PlayerManager

- **`player-balance-manager.ts`** ❌
  - **Problem:** Legacy 3-part balance system, not event-driven
  - **Contains:** Old-style direct state management
  - **Used by:** `/simulation/player-manager.ts` (but shouldn't be)
  - **Status:** Replace with event-driven approach
  - **Action:** Remove dependency from PlayerManager

- **`simulation-types.ts`** ❌
  - **Problem:** Many interfaces likely superseded by event system
  - **Contains:** Legacy simulation interfaces
  - **Status:** Review and deprecate unused interfaces
  - **Action:** Audit which interfaces are still needed

### 🤔 **UNCLEAR STATUS - NEEDS INVESTIGATION**

#### Components Requiring Confirmation

- **`scoring-engine.ts`**
  - **Question:** Is this event-integrated or legacy?
  - **Contains:** `ScoringEngine` class with `calculateScore()` method
  - **Task:** Confirm if this integrates with event system or needs updating
  - **Used by:** GameMatchingEngine constructor

- **`pooled-factories.ts`**
  - **Question:** Still needed or replaced by direct-factories?
  - **Contains:** `PooledVirtualDollarFactory`, `PooledGameSessionFactory`
  - **Task:** Confirm usage vs DirectFactories and performance implications
  - **Status:** May be alternative implementation for performance

- **`object-pool.ts`**
  - **Question:** Still actively used for performance optimization?
  - **Contains:** Object pooling utilities
  - **Task:** Confirm if this is used by pooled-factories and if we need it
  - **Status:** Performance optimization utility

- **`lazy-statistics.ts`**
  - **Question:** Still needed or superseded by event-driven statistics?
  - **Contains:** `LazyStatisticsManager` for caching statistics
  - **Task:** Confirm if this fits with event-driven architecture
  - **Status:** Caching utility, may still be relevant

- **`validation.ts`**
  - **Task:** Confirm this exists and its purpose
  - **Status:** Utilities, likely still needed

---

## Current Problem Analysis

### Root Cause: Broken Dependencies in Event-Driven Components

The `/simulation` components are **already properly event-driven** but have constructor dependencies on legacy `/types` components:

```typescript
// /simulation/player-manager.ts - ALREADY EVENT-DRIVEN ✅
constructor(
  private playerBalanceManager: PlayerBalanceManager,  // ❌ Legacy dependency
  private runOrchestrator: PlayerRunManager,          // ❌ No implementation
  private eventBus: EventBus                          // ✅ Event-driven
) { }

// /simulation/day-processor.ts - ALREADY EVENT-DRIVEN ✅
constructor(
  private gameMatchingEngine: GameMatchingEngine,     // ✅ Event-driven
  private playerManager: PlayerManager,               // ✅ Event-driven (but broken deps)
  private dollarManager: UnifiedVirtualDollarFactory, // ✅ Event-driven
  private eventBus: EventBus                          // ✅ Event-driven
) { }
```

---

## Proposed Solution

### Phase 1: Fix Dependencies (Immediate)
1. **Remove legacy dependencies from PlayerManager**
   - Remove `PlayerBalanceManager` dependency
   - Remove `PlayerRunManager` dependency
   - Keep only `EventBus` and `VirtualDollarFactory`

2. **Move logic into PlayerManager itself**
   - PlayerManager should manage player runs via events
   - Use VirtualDollarFactory for creating/managing virtual dollars

3. **Update test-game.ts**
   - Use existing event-driven components after fixing deps
   - Follow integration test pattern exactly

### Phase 2: Cleanup /types Directory (After Phase 1 works)
1. **Move confirmed working components out of /types**
   - Move to appropriate directories based on functionality
   - Update imports across codebase

2. **Remove deprecated components**
   - Delete or deprecate unused interfaces/classes

3. **Resolve unclear status components**
   - Confirm which are needed and update accordingly

---

## Tasks for Confirmation

### High Priority - Needed for Phase 1

- [ ] **Confirm ScoringEngine integration**
  - Check if ScoringEngine has event system integration
  - Verify it works with current GameMatchingEngine

- [ ] **Confirm DirectGameSessionFactory status**
  - Verify this is the preferred factory vs pooled variants
  - Check performance implications

### Medium Priority - Needed for Phase 2

- [ ] **Audit simulation-types.ts interfaces**
  - Identify which interfaces are still used
  - Map to event system equivalents where applicable

- [ ] **Confirm pooled-factories usage**
  - Determine if these are performance alternatives or legacy
  - Check if object-pool.ts is required dependency

- [ ] **Review lazy-statistics.ts relevance**
  - Determine if caching statistics fits event-driven model
  - Check if it's still used anywhere

### Low Priority - Cleanup

- [ ] **Verify validation.ts existence and purpose**
- [ ] **Create migration plan for confirmed working components**
- [ ] **Update documentation and imports**

---

## Implementation Notes

### Do NOT Break
- Integration tests are passing - preserve exact event flow
- Event handlers are working - don't modify them
- Factory pattern is working - don't change interfaces

### Safe to Modify
- PlayerManager constructor dependencies
- DayProcessor usage of PlayerManager
- test-game.ts implementation
- Legacy /types components that aren't in integration tests

---

**Next Step:** Get confirmation on unclear components, then implement Phase 1 fixes.