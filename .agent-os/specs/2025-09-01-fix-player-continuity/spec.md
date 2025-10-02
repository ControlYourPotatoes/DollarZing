# Spec Requirements Document

> Spec: Fix Player Game Continuity
> Created: 2025-09-01
> Status: Planning

## Overview

Fix the core game behavior to implement the Virtual Dollar Pool Engine mechanics where players continue playing until they either win big enough to cash out or lose all their funds, instead of stopping gameplay after day 2 due to incorrect fund flow and fee processing.

## Current vs Target Architecture

### Current Incorrect Behavior
- **Double Fee Charging**: Player balance is charged fees + virtual dollars also pay fees
- **Wrong Fee Model**: Player balance pays flat $1.10 for all games regardless of level
- **Missing Pot Accumulation**: Winners don't absorb loser's virtual dollar pot value
- **Incorrect Fund Flow**: Players can't create new virtual dollars due to drained balances
- **Level Cost Mismatch**: Level 2 costs $2.20 but only charges $1.10, creating economic inconsistencies

### Target Virtual Dollar Pool Engine Behavior  
- **Self-Contained Virtual Dollars**: Each virtual dollar has its own pot (starts at $1.00)
- **Single Fee Point**: Only virtual dollars pay platform fee (10¢ each when entering pool → pot becomes $0.90)
- **Winner Takes All**: Winning virtual dollar absorbs losing virtual dollar's pot value ($0.90 + $0.90 = $1.80)
- **Independent Runs**: Each virtual dollar represents one complete jackpot attempt (Level 1 → jackpot or loss)
- **Player Balance for Creation Only**: Player balance only used to create new virtual dollars, not for ongoing game fees
- **Multiple Concurrent Runs**: Players with sufficient funds can create multiple virtual dollars running simultaneously

## User Stories

### Gaming Platform Economics Accuracy

As a business stakeholder analyzing gaming platform viability, I want the simulation to accurately model sustained player behavior where players continue playing until natural exit conditions, so that revenue projections reflect realistic long-term engagement patterns.

Players should continue their gaming runs across multiple days, with winners using their winnings to play higher levels and losers either continuing with reduced funds or exiting when broke. The current behavior shows unrealistic immediate cessation of gameplay after just 2 days, which doesn't match real gaming platform behavior.

### Investment Analysis Reliability

As an investment analyst, I want the simulation to show realistic player lifecycle patterns where players progress through betting levels over time based on wins and losses, so that I can accurately evaluate platform sustainability and growth potential.

The simulation should demonstrate how successful players move up betting levels while unsuccessful players either recover or exit the platform naturally, providing accurate long-term revenue modeling for investment decisions.

## Spec Scope

1. **Virtual Dollar Pot System** - Implement self-contained virtual dollar pots that grow by absorbing opponent pot values when winning
2. **Single Fee Point Architecture** - Remove player balance game fee charging, only charge platform fee (10¢) when virtual dollars enter pool  
3. **Winner Takes All Mechanics** - Winning virtual dollar inherits losing virtual dollar's accumulated pot value
4. **Player Balance Separation** - Player balance only used for creating new virtual dollars ($1.00 each), not for ongoing game operations
5. **Smart Game Matching** - Prefer matching virtual dollars from different players, fallback to same-player matching to prevent pool stagnation
6. **Multiple Virtual Dollar Support** - Enable players to create and run multiple virtual dollars concurrently as independent jackpot attempts
7. **Correct Level Progression** - Virtual dollars advance through levels (1→2→4→8→16→32→64→128→256→512) based on wins, carrying accumulated pot value

## Out of Scope

- New user interface changes or visualization updates
- Performance optimizations or architectural refactors
- New features beyond fixing the core game continuation logic
- Changes to revenue distribution percentages or game rules

## Expected Deliverable

1. Test runs showing players continuing to play for 10+ days with realistic game generation patterns (not just 2 days)
2. Players advancing through betting levels (Level 1 → Level 2 → Level 4) when they win consistently
3. Some players achieving jackpots at higher levels after sustained gameplay over multiple days

## Spec Documentation

- Tasks: @.agent-os/specs/2025-09-01-fix-player-continuity/tasks.md
- Technical Specification: @.agent-os/specs/2025-09-01-fix-player-continuity/sub-specs/technical-spec.md
- Tests Specification: @.agent-os/specs/2025-09-01-fix-player-continuity/sub-specs/tests.md