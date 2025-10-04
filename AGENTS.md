Title: Agent Playbooks and Orchestration (Docs, Not Tools)

Version: 0.3.0

Last updated: 2025-10-03

Owner: Platform/Agent OS

Purpose

- Single source of truth for agent behavior in this monorepo.

- Enforce project-specific overrides (Vite/React frontend, pure TS engine).

- Prevent cross-package coupling and performance regressions.

- Treat Agent OS “agents” as playbooks/resources, not executable tools.

Instruction hierarchy (highest wins)

1. Repository standards and project docs: best-practices.md, code-style.md, STRUCTURE.md, Financial_WorkFlow.md

2. Product/spec files (sample or active): @.agent-os/specs/\*\*/{spec.md,technical-spec.md,tests.md,tasks.md}

3. This file: AGENTS.md (project-specific overrides)

4. Playbooks: @.agent-os/claude-code/agents/\*.md (context-fetcher.md, test-runner.md, git-workflow.md, etc.)

5. Inline user instructions in requests/issues/PRs

If rules conflict, ask for clarification before proceeding. Never violate higher-level rules.

Project-specific overrides (authoritative for this repo)

- Monorepo layout:

  - Backend engine: engine/ (pure TypeScript simulation engine + CLI, Node.js 22, containerized)

  - Frontend app: src/ (React 18 + TypeScript, Vite, Tailwind)

- Do not migrate frontend to Next.js. Vite is the canonical build tool.

- Engine is a library-first package with a clean public surface via engine/index.ts. Do not introduce web frameworks into engine/.

- Data flow: engine generates datasets; frontend consumes via sync mechanism (see docker-compose.yml). No direct imports from src/ into engine/ and no engine calling UI code.

Core context sources

- Standards: best-practices.md, code-style.md

- Structure & flows: STRUCTURE.md, docker-compose.yml, Financial_WorkFlow.md

- Tasks/specs: @.agent-os/specs/\*\*/{spec.md,technical-spec.md,tests.md,tasks.md} (use as reference when applicable)

- Playbooks (reference only; not tools): @.agent-os/claude-code/agents/\*.md

Context retrieval policy

- Playbooks are documents. Do not call them as commands or tools.

- When a playbook is referenced (e.g., “use context-fetcher”), read and follow the procedure from its path:

  - Context Fetcher: @.agent-os/claude-code/agents/context-fetcher.md

  - Test Runner: @.agent-os/claude-code/agents/test-runner.md

  - Date Checker: @.agent-os/claude-code/agents/date-checker.md

  - File Creator: @.agent-os/claude-code/agents/file-creator.md

  - Git Workflow: @.agent-os/claude-code/agents/git-workflow.md

  - Project Manager: @.agent-os/claude-code/agents/project-manager.md

- Mandatory retrieval discipline:

  - First check if requested content is already present in the current context; if yes, skip reading.

  - If not present, extract only specific sections using targeted reading (grep-like matches, headings), not whole files.

  - If a required file is missing, STOP and request it.

- Summarize before injecting: include minimal excerpts; link or reference paths for full text.

Active work focus (as of 2025-09-30)

- Task 9 only: legacy coupling removal and cleanup.

  - Independence tests, remove direct cross-calls, event-driven DI, refactor tests.

- Task 8 is DONE. Do not rework parameter plumbing (charity %, S-curve, risk/strategy, 1-to-1 VirtualDollar) unless fixing a confirmed bug.

Repository guardrails (do-not-break rules)

- Package boundaries:

  - No circular dependencies between engine/ and src/.

  - Public API of engine is only via engine/index.ts.

- Frontend stack: React 18, Vite, Tailwind; keep feature-based architecture with colocated components/hooks/utils.

- Engine architecture: event-driven publisher/subscriber patterns only; no framework creep.

- Containerization: Node.js 22 image/tag as currently configured; do not downgrade.

- Performance budget: maintain ≥10,000 virtual dollars and ≥50,000 games processed within 5 seconds on a standard dev machine.

- No mass reformatting or unrelated import shuffles; change only files tied to the current task.

- Dependencies: avoid new libs unless required by spec/task; justify and get approval.

Architecture enforcement

- Engine: pure TypeScript, event-driven simulation with handlers decoupled from orchestration (e.g., GameEngineSimulator coordinating DayProcessor, PlayerManager, GameProcessor via events).

- Deterministic execution:

  - All randomness must be seeded (single source of seed truth).

  - Tests and benchmarks must set seed explicitly.

- Data structures:

  - Prefer immutable updates; use Map/Set for hot-path lookups.

  - Apply object pooling and batch processing where indicated.

- Error handling:
  - Validate inputs early; use typed errors and never swallow exceptions in handlers—emit error events or surface to caller.

Frontend standards

- Feature-based modules with colocated components, hooks, tests, and styles (see STRUCTURE.md).

- Shared presentation contracts for data loading/normalization—these must remain in a shared layer and not leak engine internals.

- SVG-first for complex visualizations and custom graphics (see Financial_WorkFlow.md).

- Tailwind classes must follow the multi-line responsive format specified in code-style.md.

Testing and fast feedback (must-do)

- TDD default: write/adjust tests before implementation for new behavior.

- Seeded tests: specify deterministic seeds; avoid time-based flakiness.

- Test layers:

  - Engine unit tests for handlers and orchestration.

  - Integration tests for full event chains.

  - Performance tests for throughput and memory.

- Each PR must include a concise test plan and updated tests when behavior changes.

Performance guardrails

- Target: process ≥50,000 games and ≥10,000 virtual dollars within 5 seconds.

- Avoid synchronous blocking in event handlers; prefer batched async or synchronous batches with back-pressure.

- Clean up listeners to prevent leaks.

- Provide a reproducible benchmark with fixed seed.

Validation commands (adjust to your scripts)

- Type checking: npm run typecheck or pnpm -w typecheck

- Lint: npm run lint

- Unit/Integration tests: npm test (allow pattern selection)

- Perf benchmark (if present): npm run bench with documented seed and expected bounds

- Build (engine): npm run build -w engine

- Build (frontend): npm run build -w web or npm run build at root for Vite

Task intake protocol (every agent must produce)

1. Context

   - Files/sections fetched via the Context Fetcher playbook path

   - Why these are sufficient

2. Plan

   - Minimal change set, risks and mitigations

3. Patch

   - Unified diffs only, one fenced block per file

4. Tests

   - What’s covered, seeds used, edge cases

5. Validation

   - Exact commands, perf expectations (time/memory)

6. Rollback
   - Revert plan if acceptance signals fail

Diff format requirements

- Use unified diffs with only changed hunks.

- No cosmetic edits. Keep diffs ≤ 300 lines when possible.

Routing rules (who should act)

- Router (default): selects specialists.

- EngineAgent: engine orchestration/handlers; upholds deterministic seeding and performance.

- FrontendAgent: Vite/React app; enforces feature-based structure and SVG-first visuals.

- ContractsAgent: maintains shared data contracts and loaders without breaking consumers.

- BenchmarkAgent: authors perf benchmarks and interprets results.

- TestAgent: unit/integration/perf tests; seeds and fixtures.

- ContextFetcherAgent: may read paths from @.agent-os/claude-code/agents/context-fetcher.md and follow its procedure. Do not execute a command named “context-fetcher”.

Monorepo data-flow rules

- Engine outputs datasets (file/stream); frontend consumes via sync defined in docker-compose.yml.

- No direct engine → frontend runtime coupling; communicate via data artifacts/contracts.

- Keep presentation contracts stable; bump version if breaking.

MCP integration (optional, future)

- If an MCP server is available later:

  - Prefer MCP tools explicitly defined by that server.

  - Treat @.agent-os/claude-code/agents/\*.md as MCP resources/docs, not tools.

  - If a tool is unavailable, fall back to reading the local playbook docs by path.

  - MCP transport: stdio; default tool timeout 60s.

- Do not add tools via MCP unless permitted by spec/task.

When to stop and ask

- Conflicting directives between this file and older tech-stack docs (e.g., Next.js vs Vite).

- Proposed dependency adds not already used in repo.

- Perf budget risk (bench trending worse than ±10%).

- Unclear engine API surface or contracts changes.

Checklist for every change

- Context fetched via the Context Fetcher playbook and summarized

- Change limited to active task scope (Task 9 cleanup)

- Code follows code-style.md and best-practices.md

- Tests added/updated (seeded) and passing locally

- Perf benchmark executed with fixed seed; within budget

- No cross-package coupling introduced

- CI passes
