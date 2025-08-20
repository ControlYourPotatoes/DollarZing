# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-20-virtual-dollar-pool-engine/spec.md

> Created: 2025-08-20
> Version: 1.0.0

## Technical Requirements

- **Modular Architecture**: Complete separation of concerns with distinct modules for dollar generation, scoring, matching, level progression, and revenue calculation
- **TypeScript Type Safety**: Comprehensive type definitions for all game entities (VirtualDollar, GameSession, BettingLevel, RevenueStream, PlayerSession)
- **Performance Optimization**: Engine must handle 10,000+ virtual dollars and 50,000+ games in a 30-day simulation within 5 seconds
- **Deterministic Results**: All randomization must be seeded to ensure reproducible simulation results for testing and validation
- **Memory Efficiency**: Efficient data structures to minimize memory usage during large simulations while maintaining detailed tracking
- **Event-Driven Design**: Publisher/subscriber pattern for game events to enable extensible analytics and reporting
- **Immutable Data Structures**: Game state changes through immutable updates to prevent corruption during concurrent operations

## Approach Options

**Option A: Monolithic Engine with Single Class**
- Pros: Simple to implement initially, all logic in one place
- Cons: Difficult to test, hard to maintain, poor separation of concerns, not scalable

**Option B: Service-Oriented Modular Architecture (Selected)**
- Pros: Clear separation of concerns, testable individual modules, extensible design, follows SOLID principles
- Cons: More initial complexity, requires careful interface design, more files to manage

**Option C: Functional Programming Approach**
- Pros: Immutable by default, easy to test pure functions, predictable behavior
- Cons: May be less familiar to team, can be verbose for complex state management

**Rationale:** Option B provides the best balance of maintainability, testability, and extensibility. The modular architecture aligns with Agent OS best practices and allows for independent testing of each component. This approach will support future enhancements and makes the codebase more approachable for team members.

## Core Architecture Components

### VirtualDollarManager
- Generate virtual dollars with realistic serial number patterns
- Maintain dollar lifecycle states (created, pooled, in-game, won, lost, cashed-out)
- Track individual dollar journey through system

### ScoringEngine
- Implement daily seeded algorithm for consistent scoring
- Calculate algorithmic scores based on serial number + daily seed
- Provide score comparison functionality for game resolution

### GameMatchingEngine
- Manage virtual dollar pool for 1v1 matching
- Execute automatic matching based on availability
- Resolve games using algorithmic scores
- Emit game events for tracking and analytics

### ProgressionManager
- Handle 11-level betting progression ($1 to $1024)
- Manage cash-out decision logic with configurable strategies
- Track level advancement and player progression paths

### RevenueCalculator
- Calculate platform revenue (20c per game click)
- Compute charity contributions (adjustable 10-100% of cash-outs)
- Track player winnings and losses
- Generate comprehensive revenue reports

### SimulationController
- Orchestrate all components for complete simulation runs
- Manage simulation parameters (duration, player counts, strategies)
- Provide progress tracking and cancellation capabilities
- Generate final simulation datasets

## Data Structures

### VirtualDollar
```typescript
interface VirtualDollar {
  id: string;
  serialNumber: string; // e.g., "L12345678A"
  currentScore: number;
  currentLevel: BettingLevel;
  state: DollarState;
  ownerId: string;
  createdAt: Date;
  gameHistory: GameSession[];
}
```

### GameSession
```typescript
interface GameSession {
  id: string;
  dollar1: VirtualDollar;
  dollar2: VirtualDollar;
  winner: VirtualDollar;
  loser: VirtualDollar;
  level: BettingLevel;
  platformFee: number; // 20c
  timestamp: Date;
  gameNumber: number;
}
```

### RevenueStream
```typescript
interface RevenueStream {
  platformRevenue: number; // 20c per game
  charityContributions: number; // % of cash-outs
  playerWinnings: number;
  totalVolume: number;
  gameCount: number;
  cashOutCount: number;
}
```

## External Dependencies

No new external dependencies required. The engine will use existing DollarZing stack:

- **TypeScript 5.5.3** - Type safety and modern JavaScript features
- **Existing Testing Framework** - For comprehensive unit and integration tests
- **Zustand State Management** - For integration with current UI state management

**Justification:** Minimizing dependencies reduces complexity and potential conflicts. The existing tech stack provides all necessary capabilities for implementing the game engine without additional third-party libraries.

## Performance Considerations

### Optimization Strategies
- **Object Pooling**: Reuse GameSession and VirtualDollar objects to minimize garbage collection
- **Batch Processing**: Process multiple games in batches to improve throughput
- **Lazy Evaluation**: Calculate complex statistics only when requested
- **Efficient Data Structures**: Use Maps and Sets for fast lookups instead of arrays
- **Web Workers Integration**: Design for easy migration to background workers for heavy computation

### Memory Management
- **Circular Reference Prevention**: Avoid parent/child references that could cause memory leaks
- **Selective History Tracking**: Limit detailed history tracking to prevent memory bloat during long simulations
- **Progressive Cleanup**: Remove unnecessary intermediate data during simulation runs