# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-09-01-fix-player-continuity/spec.md

> Created: 2025-09-01
> Version: 1.0.0

## Test Coverage

### Unit Tests

**Player Class**
- Test fund management across multiple days with wins and losses
- Test cash-out decision logic for different player behavior types
- Test minimum fund requirements for generating new runs
- Test player state transitions (active, cashed-out, broke)

**GameSession Class**
- Test winner winnings calculation (level × 1.8)
- Test loser fund deduction logic
- Test game resolution and fund redistribution
- Test proper winner advancement to next betting level

**VirtualDollar Class**
- Test level progression from wins (Level 1 → Level 2 → Level 4, etc.)
- Test fund tracking and availability for new games
- Test dollar pool management for different betting levels

**SimulationController Integration**
- Test multi-day simulation with sustained player activity
- Test player progression through betting levels over time
- Test realistic fund flow between players, platform, charity, and government

### Integration Tests

**Player Lifecycle Workflow**
- Test complete player journey from initial funds through multiple game sessions
- Test player advancement through betting levels with consecutive wins
- Test player exit conditions (cash-out vs. broke scenarios)

**Game Resolution and Fund Flow**
- Test end-to-end game resolution with proper winner/loser fund updates
- Test platform fee deduction and redistribution accuracy
- Test charity and government revenue allocation

**Multi-Day Simulation Accuracy**
- Test 50-day simulation with continuous player activity beyond day 2
- Test jackpot achievement scenarios with high-level betting progression
- Test realistic game generation patterns across extended time periods

### Mocking Requirements

- **Random Number Generation:** Mock randomization for deterministic testing of win/loss scenarios
- **Time-based Logic:** Mock date/day progression for multi-day simulation testing
- **Player Behavior Models:** Mock cash-out strategy probabilities for controlled testing scenarios