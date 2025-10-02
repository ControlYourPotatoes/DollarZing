# Dataset Generation Plan

## Current State
- The CLI orchestrator (`engine/cli/src/orchestrator`) drives simulations entirely in-memory; no artefacts are persisted.
- `GameEngineExecutor` + `DatasetOrchestrator` still hand-wire core components (legacy `createGameEngineSimulator`) and do not leverage the new simulator factories.
- Batch settings exist on the CLI/config layer, but execution runs combinations sequentially with ad-hoc delays; concurrency controls are not aware of pooling/runtime options.

## Goals
1. Pre-generate the 27 anchor datasets (3×3×3 parameter matrix) for the front-end, storing JSON outputs under `engine/generated-datasets/<combination>/`.
2. Reuse the new simulator factory helpers to avoid duplicating component wiring and to guarantee pooling/debug defaults that match dev/prod expectations.
3. Document the JSON payload shape and metadata so front-end consumption and git storage stay deterministic.
4. Prepare the pipeline for future persistence decisions without blocking current local-file workflows.
5. Provide a convenient CLI entry point (`dollarzing simulate`) for multi-day smoke tests before generating datasets.

## Proposed Architecture Updates
- **Simulator Assembly**: Replace the legacy `createGameEngineSimulator` helper inside `dataset-orchestrator.ts` with calls to `createProductionSimulator`/`createDevelopmentSimulator` (depending on factory preset). This removes direct dependency on internal constructors and centralises pooling/env toggles.
- **Factory Manager Simplification**: `OrchestratorFactoryManager` should consume the simulator factory output (or the `PerformanceConfig` overrides) rather than instantiating pooled factories manually. This ensures pooling decisions stay consistent with the shared helpers.
- **Execution Flow**:
  1. CLI parses config (batch size, timeouts, dry-run).
  2. Executor obtains simulator assembly via helpers and executes `GameEngineSimulator.executeSimulation` for each parameter combination.
  3. Capture `SimulationResults`, sanitizer metrics (profile runtime, pooling state), and executor metadata (duration, attempts).
  4. Emit JSON files (dataset + metadata) into the target directory structure.
- **Output Schema**: Define two files per combination:
  - `dataset.json`: full `SimulationResults` object (including `summary`, `dailyResults`, runtime profile name).
  - `metadata.json`: { generationTimestamp, parameters, runtimeOptions, simulatorProfileName, generationTimeMs, datasetSizeBytes (computed), gitCommitSha }.

## Batching & Concurrency Notes
- Keep default batch size at 1 until we validate concurrency under the event-driven engine; document that pools are sized for sequential runs.
- When `batchSize > 1`, ensure each concurrent run uses its own simulator assembly (or resets pooling between runs) to avoid shared mutable state from `process.env.ENABLE_POOLING`.
- Progress reporting should reflect batch behaviour by emitting combination-level updates (already tracked by `ProgressTracker`).

## Implementation Backlog
1. **Simulator Integration**
   - Remove redundant `createGameEngineSimulator` in `dataset-orchestrator.ts`.
   - Inject simulator assemblies from `simulator-factories` and pass the returned profile to result writers.
2. **Factory Manager Alignment**
   - Refactor `OrchestratorFactoryManager` to either (a) wrap simulator helpers per combination, or (b) operate solely on `PerformanceConfig` overrides.
   - Ensure pooling/environment toggles do not conflict with manual factory instantiation.
3. **Output Writer**
   - Implement a writer that normalises filenames (`growth-15_risk-low_charity-20/dataset.json`).
   - Add size calculation and optional compression flag (future).
4. **CLI Enhancements**
   - Update help text to mention simulator profiles and new output scheme.
   - Provide a `--profile <dev|prod>` flag to choose between the development or production simulator assembly (complete via `dollarzing simulate`).
   - Surface debug toggles (`--debug-dashboard/--no-debug-dashboard`) so developers can capture sanity metrics during dataset batches.
5. **Testing**
   - Add unit tests for the writer (snapshot JSON shape).
   - Introduce integration test that runs a single combination and verifies files are created under a temp directory.

## Open Questions / Future Work
- Decide whether to commit generated datasets to git once file sizes are known; document thresholds (e.g., keep under 50 MB total) and compression strategy if needed.
- Explore parameter-mapper extraction later if configuration mapping grows more complex; not required for initial pipeline update.
- Consider optional JSON schema validation for output to guarantee front-end compatibility.
- Investigate concurrent run safety (may require encapsulating simulator assembly per worker or spawning isolated Node processes).


You are maintaining the simulation pipeline that currently emits raw event logs (e.g., anchor-001). Front-end refactors now require a pre-aggregated daily snapshot feed.

Goal:
1. Extend the pipeline to emit a JSON structure per simulated day with:
   - date (ISO string)
   - totals: revenue, charity, fees, player counts
   - workflowNodes[]: id, label, aggregates, layer breakdowns needed for the Financial Distribution Workflow component
   - timelineTicks[]: id, label, cumulative metrics for the SVG timeline scrubber
   - charts: any series already derived for the financial distribution/accumulation charts
2. Append these snapshots alongside the existing log output (do not remove current logs yet).
3. Provide a TypeScript-friendly schema definition (JSON Schema or TS type) and sample file so the UI repo can consume it directly.
4. Document where the new aggregates live and how to regenerate them.

Constraints:
- Keep the change minimally invasive; reuse existing aggregation logic where possible.
- Ensure generation stays performant for up to 365 days of data.
- Update any pipeline config/tests impacted by the new artifact.

Deliverables:
- Code changes implementing the aggregator.
- Sample snapshot JSON matching the schema.
- README/notes describing regeneration steps and data contract.