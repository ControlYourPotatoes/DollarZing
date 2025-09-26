# Presentation Project Structure

This document tracks the evolving layout for the presentation-focused refactor. It will
be updated as components migrate out of the prototype directory.

## Top-Level Feature Modules

- `src/features/timeline/`
  - Houses the SVG timeline scrubber, playback controls, and related state wiring.
  - Components under `components/` expose the production `SvgTimeline`,
    `TimelineScrubber`, and playback controls wired to the shared timeline store.
  - Hooks under `hooks/` provide autoplay, keyboard shortcuts, and selectors for
    active day/scenario data.
  - Barrel file (`index.ts`) exposes public components/state hooks for consumers.
- `src/features/financial-flow/`
  - Contains the Financial Distribution Workflow diagram implementation and helpers
    for workflow nodes, links, and layered progress arcs.
  - `components/` exposes the production `FinancialWorkflowDiagram` with Framer
    Motion transitions, playback-aware hover state, and summary metadata.
  - `primitives/` contains reusable SVG building blocks for workflow nodes and
    cubic-curve connectors.
- `src/features/distribution-charts/`
  - Provides the financial distribution and accumulation chart components that consume
    the shared snapshot selectors.

## Shared Layer

- `src/shared/ui/`
  - Reusable SVG primitives, layout utilities, and presentation-only visual tokens.
- `src/shared/hooks/`
  - Cross-feature hooks such as the global timeline store, playback helpers, and
    snapshot selectors. Hooks should be typed against the presentation data contract.
- `src/shared/presentation/`
  - Snapshot schema validators, loaders, interpolation helpers, and normalization
    utilities used by the timeline store and feature modules.
- `src/shared/index.ts`
  - (Future) Optional barrel aggregating shared exports for convenience.

## Data & State Integration

- Snapshot loader module (planned under `src/state` or `src/shared/hooks`) ingests the
  presentation snapshot JSON and seeds the timeline store.
- Feature modules import selectors/hooks instead of touching raw JSON files directly.

## Migration Notes

- Existing prototype components (`src/components/prototype/`) are being superseded by
  the feature modules above. Leave legacy code in place until replacement components
  are wired through the app entry points.
- Keep new files colocated with their feature directories to simplify future testing
  and code ownership.
