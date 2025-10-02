# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-01-fix-player-continuity/spec.md

> Created: 2025-09-01
> Status: Ready for Implementation

## Tasks

- [x] 1. Fix Winner Fund Flow and Game Resolution Logic
  - [x] 1.1 Write tests for GameSession winner fund distribution (level × 1.8)
  - [x] 1.2 Fix GameSession.resolveGame() to properly distribute winnings to winner
  - [x] 1.3 Fixed winnings calculation formula from 2^(level-1) to level × 1.8 (matching game rules)
  - [x] 1.4 Corrected test assumptions about game funding model (donation balance vs winnings)
  - [x] 1.5 Verify all game resolution tests pass

- [x] 2. Implement Virtual Dollar Pot System
  - [x] 2.1 Add `potValue: number` field to VirtualDollar interface (starts at $1.00)
  - [x] 2.2 Implement platform fee deduction when virtual dollars enter pool (10¢ → pot becomes $0.90)
  - [x] 2.3 Implement winner-takes-all pot absorption logic (winner gets loser's pot value)
  - [x] 2.4 Write comprehensive tests for pot value tracking and accumulation
  - [x] 2.5 Verify virtual dollars carry pot value through level progression

- [x] 3. Remove Player Balance Game Fee Charging
  - [x] 3.1 Remove `PlayerBalanceManager.processGameFee()` calls from `GameMatchingEngine.resolveGame()`
  - [x] 3.2 Remove level cost deduction from `RunOrchestrator.createNewRun()` (eliminate double charging)
  - [x] 3.3 Update player balance to only be used for creating new virtual dollars ($1.00 each)
  - [x] 3.4 Write tests to verify no game fees are charged to player balance during gameplay
  - [x] 3.5 Verify player balance remains stable during virtual dollar gameplay

- [ ] 4. Implement Smart Game Matching and Multiple Virtual Dollar Support  
  - [ ] 4.1 Write tests for smart matching (only different owners)
  - [ ] 4.2 Update GameMatchingEngine to only different-owner virtual dollar pairings
  - [ ] 4.3 Enable multiple concurrent virtual dollars per player with unique runId tracking
  - [ ] 4.4 Write tests for multiple virtual dollars from same player running simultaneously
  - [ ] 4.5 Verify same-owner matching fails, no available player. 

- [ ] 5. Integration Testing and Virtual Dollar Pool Engine Validation
  - [ ] 5.1 Write comprehensive tests for virtual dollar lifecycle (creation → pool entry → battles → pot accumulation → cash-out)
  - [ ] 5.2 Test multi-day simulation with virtual dollar pool engine (players should continue beyond day 2)
  - [ ] 5.3 Validate sustained gameplay patterns with multiple concurrent virtual dollars per player
  - [ ] 5.4 Verify correct revenue distribution using virtual dollar pot values (not player balance fees)
  - [ ] 5.5 Test that players can create new virtual dollars from winnings accumulated in cashed-out virtual dollars
  - [ ] 5.6 Run full test suite and ensure all Virtual Dollar Pool Engine mechanics work correctly