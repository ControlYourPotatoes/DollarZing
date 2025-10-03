# Logging Cleanup and Verbose Flag Integration Plan

## Overview

The current event-driven simulation produces excessive console output during runs, making it difficult to monitor progress. We need to implement conditional logging controls while preserving debug capabilities. This plan outlines a systematic approach to clean up logging across handlers, integrate verbose flags into the CLI, and enhance progress visualization.

## Current State Analysis

### Handler Logging Patterns

Evaluated all console.log statements across handlers, core components, and simulation directory:

#### CashOutDecisionHandler (4 logs)

- **General logs (2)**: Handler attachment, decision summary → **Recommendation: verbose** (shows key decisions)
- **Debug logs (2)**: Duplicate event logs, probability details → **Recommendation: debug** (internal processing)

#### GameEventHandler (3 logs)

- **All logs**: Game resolution start/end, error handling → **Recommendation: debug** (detailed game processing)

#### LevelTrackingHandler (10 logs)

- **Initialization (2)**: Handler init, subscriptions → **Recommendation: verbose** (system startup)
- **Event tracking (8 logs)**: Game creation, level changes, cash-outs → **Recommendation: debug** (per-event details)

#### PlayerProgressionHandler (8 logs)

- **Handler attachment (1)**: Init message → **Recommendation: verbose** (system startup)
- **Event processing (7)**: Game resolution, progression details → **Recommendation: debug** (internal state changes)

#### MatchmakingEventHandler (5 logs)

- **All logs**: Pool additions, match creation, queue processing → **Recommendation: debug** (matching algorithm details)

#### RevenueTrackingHandler (3 logs)

- **All logs**: Revenue calculations, charity distributions → **Recommendation: debug** (financial processing details)

#### Core Components (1 log)

- **GameMatchingEngine (1)**: Dollar added to pool → **Recommendation: debug** (pool management details)

#### Simulation Directory (16 logs)

- **DayProcessor (5 logs)**: Day processing, pool stats, event stabilization → **Recommendation: debug** (simulation internals) - _Note: Already has progression.dayStarted() call_
- **GameProcessor (3 logs)**: Game creation events → **Recommendation: debug** (game emission details)
- **GameEngineSimulator (8 logs)**: Handler attachment, listener summary → **Recommendation: verbose** (system initialization)

**Overall Recommendation**: Only 6 logs classified as verbose (handler/system initialization). All others (34+ logs) should be debug-only to minimize normal run chatter while preserving debugging capability.

### Debug System Integration

- **EventDebugInterface**: Provides comprehensive debugging with logger, debugger, visualizer, and performance monitor
- Currently only used in CashOutDecisionHandler for verbose decision-making details
- Needs to be extended to other handlers for consistent debug logging

### CLI and Script State

- **run-orchestrator.ts**: Has --debug-events flag, but no --verbose for general logs
- **CLI simulate command**: Already has --verbose flag for per-day progress, but doesn't control handler logs
- Progress indication is minimal (% completion), needs enhancement for better monitoring

## Proposed Solution

### Logging Control Strategy

1. **Three-Tier Logging**:

   - **Progression**: Structured logs using Winston for CLI visual feedback (day started/ended, player growth, games completed, revenue)
   - **Verbose**: General handler logs (e.g., "Handler attached", "Cash-out decision: CONTINUE") controlled by `--verbose`
   - **Debug**: Detailed internal logs (e.g., probability calculations, event traces) controlled by `--debug-events`

2. **Handler Integration**:

   - Add `verbose?: boolean` parameter to all handler constructors
   - Wrap general `console.log` in `if (this.verbose)`
   - Keep debug logs in `if (this.debugInterface)`
   - Progression logs use Winston logger for structured output

3. **Core Integration**:

   - Add `verbose?: boolean` parameter to core components if they log
   - Wrap logs appropriately based on classification

4. **Progress Enhancement**:
   - Move progress indication to CLI level via progress callbacks
   - Show: current day, active players, games processed, % complete
   - Integrate Winston progression logs for richer visual feedback
   - CLI can parse structured progression logs for enhanced displays

### Dependencies

- **Winston**: For structured progression logging (already installed)
- Provides JSON output for CLI parsing and human-readable formatting
- Separate logger instance for progression to avoid interfering with console.log

### Implementation Tasks

#### Phase 1: Core Infrastructure

1. **Install Winston**

   - ✅ Done: `npm install winston`

2. **Create Progression Logger**

   - ✅ Done: Created `/workspace/engine/src/utils/progression-logger.ts`
   - ✅ Done: Configured with custom 'progression' level for CLI feedback
   - ✅ Done: Includes helper functions for common progression events
   - ✅ Done: Outputs both human-readable (colored) and JSON formats

3. **Update run-orchestrator.ts**

   - ✅ Done: Add --verbose flag parsing
   - ✅ Done: Pass verbose to orchestrator config
   - ✅ Done: Enhance progress printer with detailed metrics

4. **Update CLI simulate command**

   - ✅ Done: Ensure verbose flag controls handler logging (if using simulate for orchestrator)
   - ✅ Done: Add orchestrator subcommand if needed
   - ✅ Done: Use progression logs for enhanced visual output

5. **Extend Debug Interface Usage**
   - ✅ Done: Ensure debugInterface is passed to all handlers when --debug-events is enabled

#### Phase 2: Handler Updates

6. **CashOutDecisionHandler** (already partially done)

   - ✅ Done: Wrap general logs in verbose check
   - ✅ Done: Confirm debug integration
   - ✅ Done: Add progression logs for cash-out summaries using Winston

7. **GameEventHandler**

   - ✅ Done: Wrap all logs in debug check (no verbose logs identified)
   - ✅ Done: Add verbose and debugInterface parameters
   - ✅ Done: Add progression logs for game completion counts using Winston

8. **LevelTrackingHandler**

   - ✅ Done: Wrap initialization logs in verbose check
   - ✅ Done: Wrap event tracking logs in debug check
   - ✅ Done: Add verbose and debugInterface parameters
   - ✅ Done: Add progression logs for daily level statistics using Winston

9. **PlayerProgressionHandler**

   - ✅ Done: Wrap initialization log in verbose check
   - ✅ Done: Wrap event processing logs in debug check
   - ✅ Done: Add verbose and debugInterface parameters
   - ✅ Done: Add progression logs for player growth metrics using Winston

10. **MatchmakingEventHandler**

    - ✅ Done: Wrap all logs in debug check (no verbose logs identified)
    - ✅ Done: Add verbose and debugInterface parameters
    - ✅ Done: Add progression logs for match completion rates using Winston

11. **RevenueTrackingHandler**
    - ✅ Done: Wrap all logs in debug check (no verbose logs identified)
    - ✅ Done: Add verbose and debugInterface parameters
    - ✅ Done: Add progression logs for revenue totals using Winston

#### Phase 3: Core and Simulation Updates

10. **GameMatchingEngine**

    - Wrap pool addition log in debug check
    - Add debugInterface parameter (verbose not needed)
    - Add progression logs for pool status updates using Winston

11. **DayProcessor**

    - ✅ Done: Wrap debug logs in debug check (controlled by existing loggingEnabled)
    - ✅ Done: Add progression calls for day completion and player growth using Winston
    - ✅ Done: Integrate with existing progression.dayStarted() call

12. **GameProcessor**

    - ✅ Done: Wrap all logs in debug check
    - ✅ Done: Add debugInterface parameter
    - ✅ Done: Add progression logs for game creation batches using Winston

13. **GameEngineSimulator**
    - ✅ Done: Wrap handler attachment logs in verbose check
    - ✅ Done: Wrap listener summary logs in verbose check
    - ✅ Done: Add verbose parameter to constructor
    - ✅ Done: Add progression logs for simulation start/completion using Winston

#### Phase 4: Testing and Validation

14. **Unit Tests**

    - Update handler tests to verify logging behavior with verbose/debug flags
    - Update simulation component tests for new logging parameters
    - Test progression logs are always output via Winston

15. **Integration Testing**

    - Test full simulation runs with different flag combinations
    - Verify progress display and log output
    - Validate CLI visual enhancements with structured logs
    - Test both orchestrator script and CLI simulate command

16. **Performance Validation**
    - Benchmark logging impact (should be minimal)
    - Ensure no regressions in simulation speed

## Benefits

- **Clean Runs**: Normal simulations show only progress without chatter
- **Debug Capability**: --debug-events provides full tracing when needed
- **Flexible Verbosity**: --verbose offers intermediate detail for monitoring
- **Enhanced Progress**: Better visual feedback with key metrics
- **Future-Proof**: Centralized in CLI, extensible to new handlers

## Risks and Mitigations

- **Over-Logging**: Risk of missing important logs. Mitigation: Code review to identify critical logs that should remain visible.
- **Performance**: Logging overhead. Mitigation: Use efficient checks, benchmark.
- **Inconsistency**: Different handlers logging differently. Mitigation: Standardized pattern across all handlers.

## Rollback Plan

- Revert handler changes to unconditional logging
- Remove verbose flag additions
- Restore original progress display

## Acceptance Criteria

- Normal run (--days 5): Only progress output, no handler chatter
- Verbose run: Progress + general handler logs
- Debug run: All logs + debug details
- Progress shows day, players, games, %
- No performance degradation
- All existing functionality preserved
