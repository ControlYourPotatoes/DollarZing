# Spec Requirements Document

> Spec: Virtual Dollar Pool Game Engine Refactor
> Created: 2025-08-20
> Status: Planning

## Overview

Refactor the DollarZing simulation engine from linear approximation calculations to a proper virtual dollar pool game system that simulates physical dollar bills being scanned to create virtual dollars, with daily seeded algorithms determining scores and 1v1 matching mechanics for progressive level gameplay.

## User Stories

### Business Stakeholder Game Mechanics Understanding

As a business stakeholder analyzing gaming platform viability, I want to understand how the virtual dollar pool mechanics work in practice, so that I can accurately assess revenue potential and present compelling investment scenarios based on actual game mechanics rather than statistical approximations.

**Detailed Workflow:** Stakeholders can configure game parameters (charity percentage, daily growth rates, adoption scenarios) and observe how virtual dollars flow through the system - from physical bill scanning to virtual dollar creation, daily score assignment, 1v1 matching, progressive level advancement, and final revenue distribution. The simulation shows realistic player behavior patterns, cash-out decisions, and platform revenue generation across different market scenarios.

### Investment Analyst Revenue Validation  

As an investment analyst conducting due diligence on gaming platforms, I want to see month-long simulations of actual game mechanics with proper separation of concerns, so that I can validate revenue projections with confidence and present accurate financial models to investment committees.

**Detailed Workflow:** Analysts can run comprehensive 1-month simulations that demonstrate the complete player lifecycle - dollar scanning rates, score distribution effects, win/loss patterns at each progressive level ($1→$2→$4→...→$1024), platform earnings from 20¢ per game click, charity contribution percentages (10-100% adjustable), and overall revenue distribution. Results provide granular data on player retention, level progression bottlenecks, and scaling potential.

### Regulatory Compliance Documentation

As a regulatory compliance officer, I want transparent documentation of game mechanics and fair revenue distribution algorithms, so that I can demonstrate platform compliance with gaming regulations and provide clear documentation for regulatory authorities.

**Detailed Workflow:** Compliance officers can access detailed algorithm documentation showing how daily seeded scoring ensures fairness, how 1v1 matching prevents manipulation, how progressive level mechanics work transparently, and how revenue distribution (platform fees, charity contributions, player winnings) operates fairly. The system provides audit trails and statistical validation of fair play mechanics.

## Spec Scope

1. **Virtual Dollar System Architecture** - Replace linear calculations with proper dollar bill simulation including serial number tracking, virtual dollar creation, and daily score assignment algorithms
2. **Game Engine Separation** - Refactor monolithic simulation/index.ts into distinct modules for dollar management, game mechanics, scoring algorithms, and revenue calculations  
3. **1v1 Matching System** - Implement proper game mechanics where virtual dollars are matched against each other with higher scores winning and losers eliminated
4. **Progressive Level Engine** - Build authentic level progression system ($1→$2→$4→$8→$16→$32→$64→$128→$256→$512→$1024) with proper advancement rules and cash-out decision points
5. **Enhanced Data Structures** - Replace real-time calculation data structures with proper game simulation structures that track virtual dollars, game states, and player progressions

## Out of Scope

- Physical dollar bill scanning UI/UX implementation (focus on backend simulation)
- Blockchain or cryptocurrency integration  
- Multi-player real-time matching (focus on simulated 1v1 mechanics)
- User authentication and account management
- Mobile app development

## Expected Deliverable

1. **Complete Game Engine Refactor** - Browser can run 1-month simulation with proper virtual dollar mechanics in under 10 seconds with realistic game progression data
2. **Separated Architecture** - Codebase has clear separation between dollar management, game mechanics, scoring, and revenue calculation modules instead of monolithic structure
3. **Authentic Game Mechanics** - Simulation demonstrates actual game flow: dollar scanning → virtual dollar creation → daily scoring → 1v1 matching → level progression → cash-out decisions → revenue distribution