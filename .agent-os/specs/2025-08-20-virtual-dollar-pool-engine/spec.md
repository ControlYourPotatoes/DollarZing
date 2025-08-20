# Spec Requirements Document

> Spec: Virtual Dollar Pool Game Engine
> Created: 2025-08-20
> Status: Planning

## Overview

Build a completely new game simulation engine that models the actual dollar bill scanning game mechanics with virtual dollars entering a pool for 1v1 matching based on algorithmic scores. This engine replaces the old linear approximation system with authentic game mechanics including serial number scanning, daily seeded scoring, progressive betting levels, and comprehensive revenue tracking.

## User Stories

### Investment Analyst Game Mechanics Validation

As an investment analyst, I want to simulate the actual dollar scanning game mechanics so that I can validate the economic model with realistic player behavior and revenue generation patterns.

The simulation must model individual virtual dollars with generated serial numbers (like "L12345678A") that receive algorithmic scores based on daily seeds. These dollars enter a pool where they're matched 1v1 with higher scores winning. Winners progress through betting levels ($1→$2→$4→...→$1024) and decide whether to cash out or continue, directly impacting platform revenue through 20c per game click fees and charity percentages.

### Business Development Team Revenue Modeling

As a business development executive, I want to analyze platform revenue streams separately from pot distributions so that I can present accurate financial projections to stakeholders and investors.

The engine must distinguish between platform click revenue (20c per game) and charity contributions (adjustable 10-100% of cash-outs, defaulting to 10-15%), providing clear visibility into all revenue streams including player winnings, platform earnings, and charitable contributions.

### Regulatory Compliance Documentation

As a regulatory compliance officer, I want to track individual game sessions and dollar lifecycles so that I can demonstrate transparent gameplay mechanics and fair revenue distribution to regulatory authorities.

The system must maintain detailed records of each virtual dollar's journey through the system, including scanning events, algorithmic scoring, game matching, win/loss outcomes, and cash-out decisions, providing full audit trails for regulatory documentation.

## Spec Scope

1. **Virtual Dollar Management System** - Generate virtual dollars with realistic serial numbers and manage their lifecycle through scanning, scoring, pooling, and game participation
2. **Daily Seeded Scoring Algorithm** - Implement deterministic scoring system that assigns scores to each serial number + daily seed combination for consistent gameplay
3. **1v1 Game Matching Engine** - Create automated matching system that pairs virtual dollars from the pool and executes games based on algorithmic scores
4. **Progressive Betting Level System** - Manage 11-level progression ($1→$2→$4→$8→$16→$32→$64→$128→$256→$512→$1024) with cash-out decision points
5. **Revenue Calculation Engine** - Track platform click revenue (20c per game), charity contributions (adjustable percentage of cash-outs), and player winnings separately

## Out of Scope

- Real physical dollar bill scanning integration
- User authentication or account management systems
- Real money transactions or payment processing
- Multiplayer networking or real-time communication
- Mobile app development (web-based simulation only)
- Database persistence (in-memory simulation data only)

## Expected Deliverable

1. **Functional Game Engine** - Complete simulation engine that can process 1 month of game activity with realistic player counts and generate comprehensive revenue reports
2. **Performance Optimized Architecture** - Modular TypeScript system that can simulate thousands of virtual dollars and games while maintaining 60fps UI performance
3. **Comprehensive Data Output** - Rich dataset including individual game sessions, dollar lifecycles, revenue streams, and player behavior patterns suitable for financial analysis and visualization