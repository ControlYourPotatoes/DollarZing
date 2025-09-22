# Timeline Scrubber Implementation Proposal

## Intent

Deliver a coherent project structure for the presentation refactor that keeps the new
timeline scrubber, shared time-scale logic, and styling system aligned. The goal is to
let future agents extend playback behaviors or add charts without hunting through
legacy code or duplicating theme snippets.

## Recommended Directory Layout

### Shared Layer (`src/shared`)
- `time-scales/`
  - `config.ts` — Authoritative map of thresholds (days/weeks/months/quarters) and
    label formats used by the timeline, playback governor, and charts.
  - `hooks.ts` — `useTimeScale()`, `useTimeMarkers()` returning memoized tick
    geometry/state derived from the global timeline store.
  - `transitions.ts` — Helpers for easing playback-rate ramps and thumb animations
    so scale switches stay smooth.
- `timeline/`
  - `index.ts` re-exporting the existing `presentationTimelineStore`, derived selectors,
    and time-scale helpers for feature consumption.
  - `selectors.ts` — Thin reads into the Zustand store (active scenario/day, phase,
    playback tier) to keep component imports clean.
- `ui/`
  - `tokens.ts` — Central palette, spacing, elevation, and motion tokens surfaced as
    JS constants and Tailwind plugin config hooks.
  - `controls/` — Shared SVG primitives (track backgrounds, thumb shadows, tick
    components) consumed across timeline + workflow modules.

### Feature Modules
- `src/features/timeline/`
  - `components/` — Presentational pieces (`TimelineScrubber`, `TimelinePlaybackControls`,
    `TimelineOverlayIndicators`). Components receive state via selectors rather than
    pulling from the store directly.
  - `orchestrators/` — `ScrubberConductor` managing autoplay, user overrides, and
    speed-tier transitions using shared helpers.
  - `hooks/` — Interaction hooks (`useScrubHandlers`, `useKeyboardShortcuts`) that
    work with shared selectors.
  - `styles/` — Optional module-scoped Tailwind + CSS variables to keep SVG theming
    colocated but consistent with global tokens.
- `src/features/financial-flow/` and `src/features/distribution-charts/`
  - Consume the shared time-scale + selectors to align their own thresholds and
    playback behaviors.
- `src/features/presentation-shell/`
  - Container that wires together timeline, charts, and workflow components. Provides
    layout + context for syncing scroll-tracking with the scrubber.

### Legacy Isolation
- `src/legacy/` remains untouched. New functionality never imports from legacy; use
  migration helpers in `shared/timeline` if any adapter is required.

## Time-Scale & Playback Strategy

1. **Central Threshold Map** — Define breakpoints (0–30 days, 31–90, etc.) including
   label format, tick density, and playback multiplier suggestions.
2. **Phase Derivation** — Add a derived selector `selectTimelinePhase(state)` returning
   `"daily" | "weekly" | "monthly" | "quarterly"`. Components consume this instead of
   recoding breakpoint math.
3. **Tick Generation** — Supply a helper that converts the active scenario’s day count
   into tick metadata (`position`, `isMajor`, `label`) so the SVG scrubber only focuses
   on rendering.
4. **Playback Governor** — Encapsulate autodrive logic (speed ramps, auto-snap to
   milestones) in `ScrubberConductor`. It listens to manual input events and uses the
   shared transitions util to avoid abrupt jumps.

## Styling & Motion System

- Store canonical design tokens in `shared/ui/tokens.ts` (colors, radii, blurs, motion
  durations). Export them for both Tailwind config extension and direct JS usage.
- Introduce CSS variables (via `src/styles/presentation-theme.css`) to make theming
  consistent inside SVG (`fill="var(--timeline-accent)"` etc.). Tailwind can reference
  these with `theme.extend.colors`.
- Provide `timeline.css` (or a Tailwind plugin) that emits reusable classes for
  gradient tracks, shadowed thumbs, and hover glows. Components apply the classes
  rather than repeating complex style objects.
- Collect motion easing curves in `shared/ui/tokens.ts` (`TIMELINE_EASING.spring`,
  `MOTION.durations.fast`), and use them both in Framer Motion and CSS transitions.

## Proposed Agent Tasks

1. **Foundation Setup**
   - Create `src/shared/time-scales/` module with config + hooks.
   - Export selectors from `src/shared/timeline/selectors.ts` and refactor existing
     components to rely on them.
   - Add `tokens.ts` and presentation theme CSS, update Tailwind config to reference
     new tokens.

2. **Timeline Scrubber Revamp**
   - Implement `ScrubberConductor` orchestrator controlling playback tiers and
     user override hysteresis.
   - Refactor `TimelineScrubber` to read tick metadata from shared helpers and
     render dynamic ruler states.
   - Upgrade `TimelinePlaybackControls` to consume shared motion tokens and new
     selectors (drop direct store mutation in JSX where possible).

3. **Cross-Feature Integration**
   - Wire financial-flow + distribution charts to the shared phase selector and
     animation tokens.
   - Add scroll-sync logic in `presentation-shell` so the scrubber reacts to chart
     focus states.
   - Document usage patterns and extension points in an updated `STRUCTURE.md`.

4. **Polish & QA**
   - Author Storybook/Playroom scenarios or Vitest + testing-library smoke tests for
     each phase threshold.
   - Validate theme adherence via visual regression or manual QA checklist.

## Agent Guidance

- Always import state through selectors (`selectActiveDay`, `selectTimelinePhase`)
  to keep components decoupled and memo-friendly.
- Keep time-scale constants in one place; if a component needs a new threshold, add
  it to `time-scales/config.ts` and expose through helpers rather than inline numbers.
- Prefer SVG primitives from `shared/ui/controls` for ticks/thumbs so styling remains
  centralized. If a new visual is needed, add it to the primitives library before use.
- Update `STRUCTURE.md` after landing structural changes so future contributors have
  a single source of truth.
- Coordinate styling changes through `tokens.ts` and theme CSS to avoid duplicate
  Tailwind utility chains.

## Open Questions for Follow-Up

- Should playback orchestration stay inside the timeline feature or move to a dedicated
  `presentation/runtime` module for broader reuse?
- Do we need multiple theme variants (dark/light) for the presentation build?
- What level of Storybook/Chromatic coverage is expected before handoff?

Document owner: **Timeline/Presentation Guild** — keep notes in this file as the
architecture evolves.
