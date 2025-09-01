# DollarZing Project - New Agent Context & Instructions

## Project Overview

**DollarZing** is a financial gaming simulation dashboard that models P2P multi-level betting platform economics. It's designed for business stakeholders, investors, and regulatory teams to analyze platform viability and revenue potential.

### Key Architecture
- **Language**: TypeScript
- **Framework**: Gaming simulation engine with React dashboard
- **Architecture**: Multi-component system with factory patterns and object pooling
- **Structure**: Monorepo with `/engine` (simulation core) and dashboard components

## Development Environment

### Docker Container Access
The project runs in a Docker development container. Use these commands:

```bash
# Access the running container
docker exec -it dollarzing-engine-dev bash

# Run CLI commands inside container
docker exec dollarzing-engine-dev npm run cli test-game
docker exec dollarzing-engine-dev npm run cli test-game -- --verbose

# Build the project
docker exec dollarzing-engine-dev npm run build

# Run tests
docker exec dollarzing-engine-dev npm test

# View logs
docker logs dollarzing-engine-dev
```

### Key Project Structure
```
/mnt/c/Users/alexa/Documents/Repos/DollarZing/
├── engine/                          # Core simulation engine
│   ├── src/types/                   # TypeScript type definitions & implementations
│   │   ├── simulation-controller.ts # Main simulation orchestrator
│   │   ├── game-matching-engine.ts  # Game creation and matching
│   │   ├── run-orchestrator.ts      # Player run management  
│   │   ├── virtual-dollar-types.ts  # Virtual dollar management
│   │   └── progression-manager.ts   # Game progression tracking
│   ├── cli/                         # Command-line interface
│   ├── tests/                       # Test suites
│   └── dist/                        # Built JavaScript (after npm run build)
├── .agent-os/                       # Agent OS documentation
└── CLAUDE.md                        # Project instructions
```

## Recent Bug Fix Context

### RESOLVED: Virtual Dollar State Mismatch Bug
A critical bug was recently fixed where virtual dollars were being created in `CREATED` state but the `GameMatchingEngine.addToPool()` only accepts dollars in `POOLED` state.

**Root Causes Fixed:**
1. **State Transition**: Missing state updates from `CREATED` to `POOLED` before adding to matching engine
2. **Game Resolution**: Games were created but not resolved to determine winners/losers
3. **Daily Seed Format**: Improper date format for game resolution

**Files Modified:**
- `/engine/src/types/simulation-controller.ts` (lines ~362, ~409, ~378-386)

**Current Status:**
✅ Simulation runs without crashes
✅ Virtual dollars properly transition states  
✅ Games are created, resolved, and processed
✅ 19 virtual dollars created, 9 completed runs, $9 progression funds

## Current Issue to Investigate

While the crash is fixed, there's a **game counting discrepancy**:

**Symptoms:**
- `Total Games: 0` (from RevenueCalculator.getTotalGames())
- BUT `Average Run Length: 1.0 games` and `Completed Runs: 9` 
- This suggests games ARE being played but not tracked in revenue calculator

**Investigation Needed:**
The `RevenueCalculator` component may not be receiving game completion events properly.

## Key System Components

### 1. SimulationController (`simulation-controller.ts`)
- **Purpose**: Master orchestrator coordinating all engine components
- **Key Methods**: `runSimulation()`, `processSimulationDay()`, `initializePlayers()`
- **Recent Changes**: Added game resolution step and state transitions

### 2. GameMatchingEngine (`game-matching-engine.ts`)  
- **Purpose**: Matches virtual dollars and creates game sessions
- **Key Methods**: `addToPool()`, `attemptMatching()`, `resolveGame()`
- **State Flow**: CREATED → POOLED → IN_GAME → WON/LOST

### 3. RunOrchestrator (`run-orchestrator.ts`)
- **Purpose**: Manages player runs and fund allocation
- **Key Methods**: `createNewRun()`, `processGameResult()`, `autoCreateRuns()`

### 4. RevenueCalculator (investigate this for game counting)
- **Purpose**: Tracks financial metrics and game statistics
- **Suspected Issue**: May not be receiving game completion notifications

### 5. Virtual Dollar Lifecycle
```
CREATED (new run) → POOLED (ready to match) → IN_GAME (playing) → WON/LOST (completed)
```

## Testing Commands

```bash
# Basic simulation test
docker exec dollarzing-engine-dev npm run cli test-game

# Verbose output with detailed stats  
docker exec dollarzing-engine-dev npm run cli test-game -- --verbose

# Custom Node.js debugging
docker exec dollarzing-engine-dev node -e "
const { SimulationController } = require('./dist/src/index.js');
// Your debug code here
"

# Run specific test suites
docker exec dollarzing-engine-dev npm test -- --grep "RevenueCalculator"
```

## Debug Investigation Approach

1. **Trace Game Flow**: Follow a game from creation → resolution → completion
2. **Revenue Calculator Integration**: Check if `RevenueCalculator.recordGame()` is being called
3. **Event System**: Verify game completion events are properly emitted/received  
4. **Component Communication**: Ensure all components are properly wired together

## Agent OS Standards

This project follows Agent OS patterns. Key files:
- `CLAUDE.md` - Project instructions and workflow  
- `.agent-os/product/mission.md` - Product vision
- `.agent-os/product/tech-stack.md` - Technical decisions
- Use `@~/.agent-os/standards/` for coding style and best practices

## Success Criteria

For the current investigation:
- ✅ Simulation runs without errors (DONE)
- 🎯 `Total Games > 0` matches actual game activity  
- 🎯 Revenue tracking accurately reflects simulation activity
- 🎯 All financial metrics align with game progression data

## Debugging Tips

- Always `npm run build` after code changes
- Use `--verbose` flag for detailed simulation output  
- Check both component-level stats AND overall results for discrepancies
- The factory pattern enables easy A/B testing of different implementations

---

**Ready to debug!** Start by investigating why `RevenueCalculator.getTotalGames()` returns 0 when games are clearly being played and runs completed.