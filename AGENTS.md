# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Vite + React frontend in TypeScript. Key folders: `components/` (UI primitives), `features/` (screens + domain logic), `store/` (Zustand state), `shared/` (utilities/hooks), `styles/` (Tailwind presets).
- `engine/`: Node-based simulation layer. Sources live in `src/`, CLI entry points in `cli/`, support scripts in `scripts/`, and compiled assets in `dist/`.
- `tests/` (root) and `engine/tests/`: Vitest suites covering UI flows and engine behavior respectively. Static assets reside in `public/`; project docs in `docs/` and topic deep dives in `src/STRUCTURE.md` and `Front-End_Research.md`.

## Build, Test, and Development Commands
- Frontend: `npm run dev` for Vite HMR, `npm run build` for type-check + production bundle, `npm run preview` for smoke-testing the build, `npm test` or `npm run test:watch` for Vitest.
- Engine: `cd engine && npm run build` bundles TypeScript with esbuild after cleaning and type-checking; `cd engine && npm test` executes threaded Vitest suites; `cd engine && npm run simulate -- --days 7 --debug-dashboard` runs a sample scenario.
- Docker & Make: `npm run docker:dev` / `npm run docker:prod` manage compose stacks. The `Makefile` mirrors these flows (`make dev`, `make test`, `make clean`) and is handy when running inside containers.

## Coding Style & Naming Conventions
- TypeScript everywhere; adhere to the repo ESLint config (2-space indentation, semicolons, camelCase for functions/variables, PascalCase for React components). Prefer kebab-case filenames unless an existing pattern differs.
- Use Tailwind utility classes and `class-variance-authority` helpers; keep style logic close to the component. Run `npx eslint . --fix` or rely on format-on-save before submitting changes.

## Testing Guidelines
- Co-locate new Vitest specs near the code or under `tests/` / `engine/tests/`. Describe intent with `describe`/`it`, reset Zustand stores between cases, and cover both happy paths and error states.
- Aim for >80% coverage on critical modules. Run `npm test -- --coverage` at the root and `cd engine && npm test -- --coverage` for the engine prior to PRs. For simulations, assert against generated datasets to prevent regressions.

## Collaboration Workflow
- Branch naming: `feature/<slug>`, `fix/<ticket>`, or `chore/<scope>`. Write imperative commits (e.g., `Add daily balance chart`) and reference issues where applicable.
- PR checklist: confirm lint, type-check, and relevant tests pass locally; document any TODOs inline (`// TODO(username):`) and attach UI screenshots when visuals change. Use `/status` in the CLI to confirm the current container context before running heavyweight commands.

