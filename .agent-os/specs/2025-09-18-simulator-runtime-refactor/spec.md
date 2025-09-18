# Spec Requirements Document

> Spec: Simulator Runtime Refactor
> Created: 2025-09-18
> Status: Planning

## Overview

Refactor the DollarZing simulation runtime to centralize configuration in `GameEngineSimulator`, default pooling and observability for development, and expose a modular CLI command that supports configurable multi-day simulations.

## User Stories

### Simulation Architect Controls

As a simulation architect, I want to define reusable simulation profiles with runtime options, so that tests, CLI commands, and services can run consistent multi-day scenarios without duplicating configuration.

**Flow:** Architect creates a profile describing players, strategies, pooling, and debugging flags. `GameEngineSimulator` builds the scenario and runs it, returning deterministic metrics.

### Developer CLI Run

As a developer, I want a `simulate` CLI command with flags for players, virtual dollars per player, and days, so that I can stress test the engine and capture sanity metrics without editing code.

**Flow:** Developer runs `dollarzing simulate --players 50 --dollars-per-player 3 --days 7`. CLI enables pooling and debugger, prints progress, and outputs aggregated metrics plus a sanity dashboard.

### QA Debug Session

As QA, I want development runs to automatically attach the event debugger with an opt-out, so that when a simulation fails I already have traces and performance stats for investigation.

**Flow:** QA executes the CLI in dev mode; EventDebugInterface attaches, collects traces, and the command emits a condensed metrics block alongside the standard results.

## Spec Scope

In scope: refactoring `GameEngineSimulator` to accept structured profiles and runtime options; adding factory helpers for dev/prod defaults; implementing a new `simulate` CLI command (with `test-game` delegating); wiring default pooling and debugger attachment; updating integration tests to cover full-day runs; documenting new usage.

Out of scope: front-end visualization changes, dataset pre-generation architecture, enterprise analytics features, long-term storage/export pipelines.

## Expected Deliverable

- Updated `GameEngineSimulator` API and supporting factories
- New configuration builder/types shared across CLI and tests
- `simulate` CLI command with pooling/debug opt-out flags and sanity dashboard output
- Updated integration tests covering multi-day scenarios
- Developer documentation (CLI help + spec references)
