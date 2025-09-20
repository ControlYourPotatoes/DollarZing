# Spec Requirements Document

> Spec: Presentation Front-End Refactor
> Created: 2025-09-19
> Status: Planning

## Overview

Deliver a presentation-ready DollarZing front end with a coherent project structure, shared timeline state, and refinished visual components. The prototype must consume the new pre-aggregated simulation snapshots, replace the legacy real-time sim hooks, and showcase the Financial Distribution Workflow and timeline scrubber as polished centerpiece visuals.

## Assumptions

- Simulation snapshot aggregator already emits daily snapshot JSON with workflow nodes, timeline ticks, chart series, and scenario parameter metadata (anchor coordinates for at least a 3×3×3 grid).
- Loader logic must be flexible enough to scale to denser grids (e.g., 5×5×5) without structural refactors; interpolation helpers will operate on the provided scenario metadata.
- Prototype runs against pregenerated data; no live simulation engine will be invoked by the UI.
- Presentation usability and visual impact take priority over full accessibility hardening.

## User Stories

### Executive Timeline Walkthrough

As a business stakeholder preparing an investor presentation, I want a fluid SVG timeline scrubber that scrubs through up to 365 days of pregenerated data so I can demonstrate platform growth and upcoming milestones during a live pitch.

**Flow:** Stakeholder loads the presentation build, the scrubber defaults to the first snapshot, dragging or autoplay advances the active date, and all connected charts update instantly using shared snapshot state.

### Financial Flow Deep Dive

As an investment analyst, I want a rich Financial Distribution Workflow diagram that visualizes revenue, fees, and charitable allocations at the selected date so I can pinpoint how funds move through the system without reading raw logs.

**Flow:** Analyst selects a day on the timeline, the workflow graph highlights aggregate values, layered comparisons, and animations depicting fund movement; hovering nodes surfaces key metrics shared with supporting charts.

### Prototype Developer Iteration

As a front-end developer iterating on the presentation prototype, I need a clean project structure with feature folders, shared SVG primitives, and TypeScript contracts so I can extend or swap components without wading through deprecated real-time sim code.

**Flow:** Developer imports snapshot loaders from a shared data module, edits feature-local components, and relies on documented contracts to ensure timeline, workflow, and chart modules stay in sync.

## Spec Scope

In scope: defining the presentation project structure; integrating the shared snapshot loader and global timeline store; refactoring the SVG timeline scrubber to consume shared state; rebuilding the Financial Distribution Workflow component atop reusable SVG primitives; updating dependent charts to read from the same snapshot data; documenting architecture and migration guidance; supporting scenario manifests enabling interpolation across anchor datasets.

Out of scope: back-end simulation changes beyond the completed aggregator; accessibility conformance work; generalized dataset generation tooling; production deployment automation.

## Architecture Outline

- **Data Layer:** Snapshot loader module that reads pregenerated JSON and a scenario manifest describing parameter coordinates, exposes typed selectors, and seeds a lightweight store (Zustand or equivalent) for active date, playback state, and derived aggregates.
- **Interpolation Support:** Utility helpers that map requested parameter combinations to nearest anchors (or blended values) using the manifest metadata so future 5×5×5 grids drop in without code churn.
- **State Management:** Timeline store controlling current index, play/pause, and scrub shift; selectors feeding charts, workflow, and any forthcoming components.
- **UI Composition:** Feature folders (`timeline`, `financial-flow`, `distribution-charts`) exporting container components plus shared SVG primitives under `src/shared/ui`.
- **Styling & Motion:** Framer Motion (or equivalent) for scrubber and workflow animations, Tailwind tokens for consistent theming, and utility hooks for animation timing.
- **Documentation:** `STRUCTURE.md` capturing folder purpose, state contracts, data pipeline references, and instructions for ingesting additional anchor datasets.

## Dependencies & Risks

- Requires validated snapshot JSON and scenario manifest before front-end tasks begin (tracked as gating task).
- Potential performance concerns when scrubbing through year-long datasets; may need memoization or virtualization for heavy charts.
- Interpolation helpers must gracefully handle missing combinations while remaining performant during presentations.
- Removing legacy real-time sim code must avoid breaking any still-referenced utilities; audit required before deletion.

## Expected Deliverables

- Updated project structure with feature modules and shared UI/state layers.
- Timeline scrubber refactored to consume the shared snapshot store with play/pause, scrub, and label updates.
- Financial Distribution Workflow component rebuilt with reusable SVG primitives, animations, and data bindings to snapshot aggregates.
- Connected chart components updated to read from the same snapshot contracts, reflecting the active timeline date.
- Scenario manifest loader and interpolation utilities supporting future anchor expansions.
- Documentation (`STRUCTURE.md`, component API notes) explaining architecture decisions, data contract, interpolation strategy, and migration path from the prototype.
