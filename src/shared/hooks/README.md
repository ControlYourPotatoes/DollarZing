# Shared Hooks

Timeline stores, playback helpers, and other cross-feature hooks live here. Hooks
should expose typed contracts that align with the presentation snapshot schema.

## Available Hooks

- `usePresentationTimelineStore` — zustand store managing presentation snapshot
  playback (scenario selection, active day index, interpolation helpers).
