# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-07-event-driven-simulation-architecture/spec.md

> Created: 2025-09-07
> Status: Ready for Implementation

## Tasks

- [x] 1. Implement Core Event System Infrastructure

  - [x] 1.1 Write tests for EventBus class with registration, emission, and cleanup
  - [x] 1.2 Create EventBus implementation with TypeScript support and error handling
  - [x] 1.3 Define comprehensive event type interfaces for simulation events
  - [x] 1.4 Implement event subscription management with priority ordering
  - [x] 1.5 Add event tracing and debugging capabilities
  - [x] 1.6 Verify all EventBus tests pass

- [x] 2. Create Game Event Handler

  - [x] 2.1 Write tests for GameEventHandler with game resolution scenarios
  - [x] 2.2 Implement GameEventHandler to replace GameProcessor game resolution logic
  - [x] 2.3 Add event emission for game completion and results
  - [x] 2.4 Integrate with existing GameMatchingEngine through events
  - [x] 2.5 Handle error scenarios and edge cases
  - [x] 2.6 Verify all GameEventHandler tests pass

- [x] 3. Implement Player Progression Handler

  - [x] 3.1 Write tests for PlayerProgressionHandler with level advancement logic
  - [x] 3.2 Extract player progression logic from PlayerManager into event handler
  - [x] 3.3 Implement event-driven level advancement and state tracking
  - [x] 3.4 Add integration with cash-out decision events
  - [x] 3.5 Handle edge cases for maximum level and progression failures
  - [x] 3.6 Verify all PlayerProgressionHandler tests pass

- [x] 4. Create Cash-Out Decision Handler

  - [x] 4.1 Write tests for CashOutDecisionHandler with strategy-based decisions
  - [x] 4.2 Implement cash-out decision logic based on player strategies
  - [x] 4.3 Create event emission for cash-out and continue-play decisions
  - [x] 4.4 Integrate with existing player strategy configurations
  - [x] 4.5 Handle complex decision scenarios and edge cases
  - [x] 4.6 Verify all CashOutDecisionHandler tests pass

- [x] 5. Implement Pool Management Handler

  - [x] 5.1 Write tests for PoolManagementHandler with re-pooling scenarios
  - [x] 5.2 Extract re-pooling logic from DayProcessor into event handler
  - [x] 5.3 Implement event-driven pool state management
  - [x] 5.4 Add integration with GameMatchingEngine through events
  - [x] 5.5 Handle pool capacity and state synchronization
  - [x] 5.6 Verify all PoolManagementHandler tests pass

- [x] 6. Create Revenue Tracking Handler

  - [x] 6.1 Write tests for RevenueTrackingHandler with financial event processing
  - [x] 6.2 Implement event-driven revenue tracking and accumulation
  - [x] 6.3 Integrate with existing RevenueCalculator through events
  - [x] 6.4 Add comprehensive financial transaction logging
  - [x] 6.5 Handle revenue calculation edge cases and errors
  - [x] 6.6 Verify all RevenueTrackingHandler tests pass

- [x] 7. Integrate Event System with Existing Components

  - [x] 7.1 Write integration tests for complete event flow chains
  - [x] 7.2 Modify DayProcessor to use event-driven architecture
  - [x] 7.3 Update GameProcessor to emit events instead of direct calls
  - [x] 7.4 Refactor PlayerManager to subscribe to relevant events
  - [x] 7.5 Add event system initialization to game engine setup
  - [x] 7.6 Verify all integration tests pass
  - [x] 7.7 Add event integration to DatasetOrchestrator for generation progress tracking
  - [x] 7.8 Implement orchestrator event emission for parameter validation and quality checks
  - [x] 7.9 Update orchestrator GameEngineSimulator creation to use event-driven initialization
  - [x] 7.10 Write orchestrator event integration tests

- [ ] 8. Complete Parameter Modularity & Event-Driven Integration

  - [ ] 8.1 Fix charity percentage flow to all event handlers (remove hardcoded 0.1 ProgressionManager)
  - [ ] 8.2 Implement S-curve growth model integration with player spawning (Conservative/Market/Viral growth)
  - [ ] 8.3 Update risk/strategy distribution to flow from dataset parameters to event handlers
  - [ ] 8.4 Update PlayerBalanceManager for 1-to-1 VirtualDollar model (strategy-based allocation)
  - [ ] 8.5 Remove duplicate business logic between legacy and event-driven systems
  - [ ] 8.6 Verify all parameters flow correctly per-dataset (27 configuration matrix)
  - [ ] 8.7 Test end-to-end parameter flow from DatasetOrchestrator to event handlers
  - [ ] 8.8 Validate 3x3x3 configuration matrix: Growth(Conservative/Market/Viral) × Risk(low/mid/high) × Charity(10%/20%/30%)

- [ ] 9. Remove Legacy Coupling and Clean Up
  - [ ] 9.1 Write tests to verify component independence after cleanup
  - [ ] 9.2 Remove direct method calls between previously coupled components
  - [ ] 9.3 Clean up redundant state management and synchronization code
  - [ ] 9.4 Update dependency injection to use event-driven patterns
  - [ ] 9.5 Refactor existing tests to work with new event-driven architecture
  - [ ] 9.6 Verify all tests pass and system maintains functionality


● Task 8 Status Evaluation

  Based on my analysis, here's the current state of Task 8: Complete 
  Parameter Modularity & Event-Driven Integration:

  ✅ Completed Subtasks:

  - 8.2 S-curve growth model integration ✅ - Fully implemented in
  orchestrator and player spawning
  - 8.6 Parameter flow verification ✅ - 27 configuration matrix working
  properly
  - 8.7 End-to-end parameter flow ✅ - DatasetOrchestrator → handlers
  working
  - 8.8 3x3x3 configuration matrix validation ✅ - All combinations working

  ⚠️ Partially Complete:

  - 8.3 Risk/strategy distribution - Flow exists but may need validation
  - 8.4 PlayerBalanceManager 1-to-1 VirtualDollar model - Architecture
  exists but needs verification

  ❌ Still Outstanding:

  - 8.1 Fix charity percentage flow ❌ - ProgressionManager still has 
  hardcoded 0.15
  - 8.5 Remove duplicate business logic ❌ - Legacy coupling still exists

  Key Findings:

  1. Charity percentage issue: ProgressionManager:67 still uses
  charityPercentage: number = 0.15 instead of receiving it from event
  parameters
  2. S-curve integration: Fully working in orchestrator → day-processor →
  player-manager event chain
  3. Parameter flow: DatasetOrchestrator correctly converts and passes all
  27 parameter combinations
  4. Legacy systems: Still have duplicate logic that needs cleanup

  Recommended next action: Focus on subtasks 8.1 and 8.5 as the critical
  remaining items for parameter modularity completion.

  Analysis & Proposals

  ✅ 8.3 Risk/Strategy Distribution Status

  COMPLETED - The flow is working perfectly:
  - DatasetOrchestrator:388 gets strategy distribution from
  riskStrategyMapping[riskLevel]
  - Flows to DayStartedEvent:352 with playerStrategies parameter
  - PlayerManager:78 receives and uses playerStrategies from events
  - No action needed - parameter flow is event-driven end-to-end

  ⚠️ 8.4 PlayerBalanceManager Status

  PARTIALLY DEPRECATED - You're correct about the unified VirtualDollar impact:
  - UnifiedVirtualDollarFactory has replaced DirectVirtualDollarFactory ✅
  - But PlayerBalanceManager still actively used in 15+ files including:
    - All orchestrator components (dataset-orchestrator.ts, game-engine-adapter.ts)
    - Integration tests and CLI commands
    - Recommendation: Keep PlayerBalanceManager as it handles player cash-out processing
  that VirtualDollar doesn't cover

  🎯 8.1 Charity Percentage Flow Integration Proposal

  Following project patterns, here's the event-driven charity flow:

  Pattern Analysis:

  - ✅ charityPercentage flows: DatasetOrchestrator → SimulationConfig → DayStartedEvent
  - ❌ ProgressionManager ignores event parameters, uses hardcoded 0.15

  Proposed Integration:

  1. Add charity percentage to progression events:
  // engine/src/events/event-types.ts
  export interface PlayerLevelAdvancedEvent {
    // existing fields...
    charityPercentage: number; // Add this
  }

  export interface PlayerCashOutEvent {
    // existing fields...
    charityPercentage: number; // Add this
  }
  2. Update ProgressionManager constructor:
  // Remove hardcoded default, accept from events
  constructor() {} // Remove: private charityPercentage: number = 0.15
  3. Flow charity percentage through event handlers:
  // PlayerProgressionHandler passes charity% to ProgressionManager.processCashOut()
  // CashOutDecisionHandler includes charity% in events
  // RevenueTrackingHandler receives charity% from events
  4. Event flow: DatasetOrchestrator → GameEngineSimulator → DayProcessor → 
  PlayerProgressionHandler → ProgressionManager

  This maintains the established event-driven pattern while eliminating the hardcoded 
  charity percentage.

  Would you like me to implement this charity percentage flow integration?