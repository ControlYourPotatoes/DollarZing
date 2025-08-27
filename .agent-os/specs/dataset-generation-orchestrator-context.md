# Dataset Generation Orchestrator - Context

> Context file for future spec creation
> Created: 2025-08-27

## Intent

Create a simple orchestrator tool that generates the 27 anchor datasets needed by the curated dataset system by running the game engine with different parameter combinations and organizing the output for consumption by the data interpolation engine.

## Core Responsibilities

- **Parameter Matrix Management**: Define and manage the 3×3×3 parameter combinations (Growth × Risk × Charity)
- **Batch Generation**: Run game engine 27 times with different configurations
- **Progress Tracking**: Show generation progress and handle any failures
- **Output Organization**: Structure generated datasets for consumption by data engine
- **Validation**: Ensure all 27 datasets meet quality and size requirements

## Parameter Configuration

The orchestrator will be the single source of truth for parameter definitions:

- **Growth Rates**: Base (15%), Mid (35%), High (60%)
- **Risk Levels**: Low (conservative cash-out), Mid (balanced), High (aggressive)  
- **Charity Percentages**: Low (10%), Mid (20%), High (30%)

## Technical Considerations

- **Tool Type**: CLI/Node.js script for developer use
- **Input**: Game engine configuration parameters
- **Output**: 27 organized anchor datasets ready for Git storage
- **Dependencies**: Game engine access, file system operations
- **Performance**: Batch processing with progress reporting

## Integration Points

- **Game Engine**: Must accept configurable Growth/Risk/Charity parameters
- **Data Engine**: Outputs must match expected anchor dataset format
- **Storage System**: Generated datasets integrate with Git storage approach

## Success Criteria

- Single command generates all 27 anchor datasets
- Output datasets are properly organized and validated
- Integration with existing game engine requires minimal changes
- Generated datasets work seamlessly with data interpolation engine

---

*This context file provides the foundation for creating a comprehensive orchestrator spec when ready to implement dataset generation capabilities.*