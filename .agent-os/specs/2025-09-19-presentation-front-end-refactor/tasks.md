# Spec Tasks

## Tasks

- [x] 0. Confirm simulation snapshot aggregator output is available for presentation data pipeline
  - [x] 0.1 Validate snapshot JSON schema against expected front-end contract
  - [x] 0.2 Generate sample dataset for timeline + workflow components
  - [x] 0.3 Verify scenario manifest enumerates parameter coordinates for all anchor datasets

- [x] 1. Establish presentation project structure
  - [x] 1.1 Create feature folders for timeline, financial-flow, and distribution charts
  - [x] 1.2 Add shared UI primitives and hooks under `src/shared`
  - [x] 1.3 Draft `STRUCTURE.md` documenting new layout and module responsibilities

- [x] 2. Implement shared snapshot data layer
  - [x] 2.1 Build snapshot loader/normalizer module with TypeScript contracts
  - [x] 2.2 Seed global timeline store (active index, playback state, derived aggregates)
  - [x] 2.3 Write smoke tests covering snapshot parsing and selectors
  - [x] 2.4 Implement scenario manifest loader and parameter indexing utilities
  - [x] 2.5 Add interpolation helper to map arbitrary parameter requests to nearest anchors or blended datasets

- [x] 3. Refactor timeline scrubber
  - [x] 3.1 Connect SvgTimeline to shared store (play/pause, scrub shift, labels)
  - [x] 3.2 Implement playback controls and keyboard shortcuts within SVG UX constraints
  - [x] 3.3 Ensure connected charts react smoothly to timeline updates (animation + performance)

- [x] 4. Rebuild Financial Distribution Workflow component
  - [x] 4.1 Extract SVG primitives for nodes, connectors, and layered progress arcs
  - [x] 4.2 Bind snapshot aggregates to workflow visualization and hover interactions
  - [x] 4.3 Integrate Framer Motion (or equivalent) for node/link transitions

- [ ] 5. Align supporting charts and documentation
  - [ ] 5.1 Update financial distribution chart to consume shared selectors
  - [ ] 5.2 Remove deprecated real-time sim wiring and unused prototype code
  - [ ] 5.3 Finalize docs (component APIs, data contracts, presentation workflow, interpolation usage)
