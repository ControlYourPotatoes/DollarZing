# Spec Requirements Document

> Spec: Simulation Architecture Refactor
> Created: 2025-09-01
> Status: Planning

## Overview

Refactor the simulation architecture to improve code organization, maintainability, and clarity by moving the cluttered SimulationController from the types directory to the simulation directory, breaking it into focused classes, and clarifying the roles of the two existing simulation engines.

## User Stories

### Business Stakeholder Story

As a business stakeholder using DollarZing for financial analysis, I want the simulation engine to be reliable and maintainable, so that I can trust the accuracy of my financial projections and the platform can evolve to meet changing business requirements.

The current simulation architecture has become cluttered with a 770+ line SimulationController in the wrong location (types directory) and unclear separation between two different simulation approaches. This refactor will create a clean, maintainable architecture that supports both statistical modeling and component integration testing.

### Developer Story

As a developer working on DollarZing, I want a well-organized simulation architecture with clear separation of concerns, so that I can easily understand, modify, and extend the simulation functionality without breaking existing features.

The refactor will break down the monolithic SimulationController into focused classes, move implementations out of the types directory, and create a clear distinction between the statistical SimulationEngine and the component-integration GameEngineSimulator.

## Spec Scope

1. **File Organization** - Move SimulationController from types/ to simulation/ directory and rename to GameEngineSimulator
2. **Class Decomposition** - Break down the 770+ line SimulationController into smaller, focused classes (DayProcessor, PlayerManager, GameProcessor)
3. **Architecture Clarification** - Establish clear roles for SimulationEngine (statistical modeling) vs GameEngineSimulator (component integration)
4. **Import Updates** - Update all cross-references and imports throughout the codebase
5. **Types Directory Cleanup** - Move all implementations out of types/ directory, keeping only type definitions

## Out of Scope

- Changes to the core simulation logic or algorithms
- Modifications to the existing SimulationEngine in simulation/index.ts
- Changes to the frontend React components
- Database or API modifications
- Performance optimizations (separate concern)

## Expected Deliverable

1. Clean, well-organized simulation architecture with SimulationEngine for statistical modeling and GameEngineSimulator for component integration
2. All simulation-related implementations moved to simulation/ directory with proper separation of concerns
3. Types directory containing only type definitions, no implementations
4. All existing functionality preserved with updated imports and references

## Spec Documentation

- Tasks: @.agent-os/specs/2025-09-01-simulation-architecture-refactor/tasks.md
- Technical Specification: @.agent-os/specs/2025-09-01-simulation-architecture-refactor/sub-specs/technical-spec.md
- Tests Specification: @.agent-os/specs/2025-09-01-simulation-architecture-refactor/sub-specs/tests.md
