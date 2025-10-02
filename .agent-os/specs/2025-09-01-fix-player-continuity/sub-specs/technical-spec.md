# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-01-fix-player-continuity/spec.md

> Created: 2025-09-01
> Version: 1.0.0

## Technical Requirements

### Virtual Dollar Pool Engine Implementation
- **Add pot value tracking to VirtualDollar interface** - Each virtual dollar must have `potValue: number` starting at $1.00
- **Implement platform fee deduction on pool entry** - Deduct 10¢ from virtual dollar pot when entering matching pool (pot becomes $0.90)
- **Winner takes all pot logic** - Winning virtual dollar absorbs losing virtual dollar's pot value ($0.90 + $0.90 = $1.80)
- **Remove player balance game fee charging** - Eliminate `PlayerBalanceManager.processGameFee()` calls from game resolution
- **Player balance creation-only model** - Player balance only used for creating new virtual dollars ($1.00 each)

### Current Architecture Issues to Fix
- **Double fee charging in `GameMatchingEngine.resolveGame()`** - Currently charges both player balance AND virtual dollar fees
- **Incorrect flat fee in `PlayerBalanceManager`** - Uses $1.10 for all games instead of level-specific costs
- **Missing pot accumulation in game resolution** - Winners don't inherit loser's accumulated pot value
- **Wrong fund source in `RunOrchestrator`** - Checks player balance for level progression instead of virtual dollar pot value

### Game Matching Enhancements
- **Smart matching algorithm** - Prefer different-owner virtual dollar pairings, fallback to same-owner if needed
- **Multiple virtual dollar support** - Enable concurrent independent runs per player with unique `runId` tracking
- **Level progression with pot carrying** - Virtual dollars advance levels (1→2→4→8...) while maintaining accumulated pot value

## Approach Options

**Option A:** Patch existing player balance fee system to handle level-specific costs
- Pros: Minimal interface changes, preserves current architecture
- Cons: Doesn't address fundamental architecture mismatch, still mixing concerns

**Option B:** Implement Virtual Dollar Pool Engine architecture (Selected)  
- Pros: Matches intended game mechanics, eliminates double charging, cleaner separation of concerns
- Cons: Requires interface changes, more extensive testing needed

**Option C:** Hybrid approach keeping both systems
- Pros: Backward compatibility maintained
- Cons: Maintains architectural confusion, complex maintenance, double the testing burden

**Rationale:** Option B aligns with the Virtual Dollar Pool Engine spec from @.agent-os/specs/2025-08-20-virtual-dollar-pool-engine and fixes the root cause architectural mismatch. The current implementation incorrectly treats player balances as the primary fund source, when virtual dollars should be self-contained with their own pot values. This change eliminates the double fee charging bug and creates the correct economic model for sustained gameplay.

## External Dependencies

No new external dependencies required. All fixes will be implemented using existing TypeScript classes and the established factory pattern architecture.