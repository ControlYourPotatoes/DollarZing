# Player Allowance & Reactivation Proposal

## Context

- `engine/src/simulation/player-manager.ts`
- `engine/src/simulation/day-processor.ts`
- `engine/src/simulation/game-engine-simulator.ts`
- `engine/src/simulation/post-processing/daily-aggregator.ts`
- `engine/src/types/virtual-dollar-engine.ts`
- `engine/src/factories/pooled-factories.ts`
- `engine/generated-datasets/anchor-datasets/*/dataset.json`
- `src/shared/hooks/presentationTimelineStore.ts`
- `src/shared/presentation/normalizer.ts`

## Goals

1. Model a percentage of the player base as Daily Active Users (DAU) per scenario.
2. Provide each active player with a configurable allowance, refreshed on a weekly cadence.
3. Recycle inactive/"retired" players by re-funding them when they are selected to be active again.
4. Expose new metrics so the presentation layer can visualize allowances, reactivations, and churn.

## Behaviour Overview

### Allowance Tiers

- Use cohort-based weekly allowance ranges informed by presets. Example (Base):
  - Light: $8–$16 (mean ~$12)
  - Mid: $35–$70 (mean ~$50)
  - Whales: $160–$320 (mean ~$220)
  - Non-spenders: $0
- Presets (Conservative / Base / Aggressive) define these per cohort; profiles may override.
- Allowances can be overridden per simulation profile via orchestrator mapping.

### Daily Active Target

- Configure per scenario and per cohort via orchestrator mapping. Overall DAU bands:
  - Conservative ≈ 15–22% (mix-weighted)
  - Base ≈ 20–28%
  - Aggressive ≈ 26–34%
- Compute per-cohort target actives (`target[c] = floor(population[c] * dau[c])`).
- On each day:
  1. Check current active dollar count per cohort.
  2. Determine per-cohort deficits versus targets.
  3. Select inactive/retired players for reactivation to fill deficits.

### Reactivation Flow

1. Select candidates from the player registry who have no active runs.
2. Assign allowance budget based on their risk tier.
3. Mint integer virtual dollars equal to the weekly allowance and deposit all into the shared pool (no daily slicing or per‑player pot tracking).
4. Mark them active for the day; consumption happens from the pool (not a per‑player pot). Soft‑churn uses inactivity cycles rather than per‑player remainder.

- Apply per-cohort reactivation probabilities (weekly) prorated by day (e.g., `p_day ≈ reactivation_weekly / 7`) when drawing from retired stock; then fill with inactive pool as needed.

### Retired State

- "Retired" becomes "inactive" — player currently has no active funded run.
- Recycling is explicit: when player is selected for reactivation, remove them from inactive list, allocate allowance, and create a new run.
- Track consecutive inactive days to surface long-term churn.

---

## Research‑Aligned Presets (Cohorts, DAU/WAU, Allowances)

### Cohort Splits (share of total users)

- Conservative: Non-spenders 72%, Light 20%, Mid 7%, Whales 1%
- Base: Non-spenders 65%, Light 24%, Mid 9.5%, Whales 1.5%
- Aggressive: Non-spenders 58%, Light 26%, Mid 13%, Whales 3%

### Weekly Active and Daily Active Targets (by cohort)

- Conservative: Light DAU 14%, Mid 22%, Whales 38%, Non-spenders 6%
- Base: Light DAU 18%, Mid 26%, Whales 45%, Non-spenders 8%
- Aggressive: Light DAU 22%, Mid 31%, Whales 52%, Non-spenders 10%

### Weekly Allowance Ranges (USD, by cohort)

- Conservative: Light $6–$12, Mid $25–$50, Whales $120–$240
- Base: Light $8–$16, Mid $35–$70, Whales $160–$320
- Aggressive: Light $12–$24, Mid $50–$100, Whales $220–$460
- Non-spenders: $0 across presets

### Days Active per Week (by cohort)

- Conservative: Light 1–2, Mid 3–4, Whales 4–6
- Base: Light 2–3, Mid 3–5, Whales 5–7
- Aggressive: Light 3–4, Mid 4–6, Whales 6–7

### Churn & Reactivation

- Soft‑churn (consecutive inactive cycles): Light 2, Mid 2, Whales 3, Non‑spenders 2
- Reactivation probability per week (Base): Light 12%, Mid 16%, Whales 20%, Non‑spenders 6% (scaled per day)

### Donation Mechanic and Day Weights

- Donations are applied on cashouts, not per run spend: donation = cashOutAmount × donation_rate.
- Platform fees accrue per game session from the 1v1 pool (e.g., click/fee model) and are tracked separately from donations.
- Optional day‑of‑week weights can shape match frequency indirectly via run creation, if desired.

---

## Core Daily Flow (Implementation Notes)

- Weekly allowance refresh on configured day (e.g., Monday). For each non‑retired user, sample weekly allowance, mint that many integer virtual dollars, and deposit all into the shared matchmaking pool. No per‑player remainder is tracked.
- Determine per‑cohort target actives via DAU; sample natural actives; reactivate to fill gaps using reactivation probabilities and inactive pools.
- Matchmaking pairs 2 dollars 1v1; the loser’s dollar is absorbed into the winner’s run pot; platform fee is charged per game; cashout events trigger charity donation from the cashout amount.
- At week boundaries, update inactive cycle counters; transition to retired when thresholds met; reset in‑cycle flags.

## Data Contract Changes

### `PlayerStatistics`

- Add `reactivatedPlayers` (count per day + totals).
- Add `allowanceGranted` and `allowanceConsumed` (currency totals).
- Add `inactivePlayers` and `inactiveStreakPlayers` (for churn insight).
- Add `reactivationsByCohort` and `activesByCohort` for breakdowns.
- Add `donationsToday`, `donationRate`, and cumulative donations at run level.
- Add `poolOutstandingVirtualDollars` (integer) — unexecuted runs remaining in the pool at end of day.

### `dataset.json`

- Extend `playerStats` and each `dailyResults[*].playerStatistics` with new fields above.
- Add `allowanceSummary` at top level summarizing allowance distribution per tier.
- Extend daily snapshot with:
  - `pool.depositedToday` (virtual dollars minted to pool), `pool.consumedToday` (games played × 2 dollars), `pool.outstanding` (current pool size)
  - `reactivations.total/byCohort`
  - `revenue`: `{ platformFeesToday, totalPlatformFees, playerWinningsToday, totalPlayerWinnings }`
  - `donations`: `{ rate, amountFromCashoutsToday, cumulativeFromCashouts }`
  - `cashouts`: `{ countToday, amountToday }`
  - `churn`: `{ newRetired, retiredStock, returningFromRetired }`

### Presentation Manifest / Normalizer

- Update `src/shared/presentation/normalizer.ts` to read the new fields.
- Update selectors in `src/shared/hooks/presentationTimelineStore.ts` to expose allowance and reactivation metrics.

## Engine Changes

### PlayerManager (`engine/src/simulation/player-manager.ts`)

- Maintain allowance profile per player.
- Track inactive streak counter.
- Provide helper `reactivatePlayers(targetCount: number)` returning list of players receiving funds.
- Maintain per‑cohort indexes for inactive vs retired pools and expose counts to simulator.

### DayProcessor (`engine/src/simulation/day-processor.ts`)

- Before processing games, call PlayerManager to reactivate players based on configured DAU target.
- Emit `PLAYER_REACTIVATED` events containing player id, allowance budget, and day.
- Compute per‑cohort targets and fill deficits in priority order (undershoot first), applying per‑cohort reactivation probabilities.

### Virtual Dollar Factory (`engine/src/factories/pooled-factories.ts`)

- Support resetting pot value when reactivating an existing dollar instance.
- Ensure state history logs "REFUNDED" events (optional but useful for QA).

### Game Engine Simulator (`engine/src/simulation/game-engine-simulator.ts`)

- Replace total player calculation with explicit active/inactive counters from PlayerManager.
- Aggregate allowance metrics each day and at run completion.

### Post Processing (`engine/src/simulation/post-processing/daily-aggregator.ts`)

- Include new allowance and reactivation metrics in daily snapshots.
- Aggregate breakdowns by cohort and compute ARPDAU.

## Orchestrator Mapping

- Extend `ParameterMappingConfig` with:
  - `cohorts.{non_spender|light|mid|whale}` objects containing:
    - `share`, `wau`, `dau`, `weekly_allowance_mean`, `weekly_allowance_range`, `active_days_per_week`, `soft_churn_cycles`, `reactivation_weekly`
  - `donation_rate`
  - `day_of_week_weights` (optional)
  - `allowance_refresh_day` (e.g., "monday")
  - `reactivation_priority` (e.g., `undershoot_dau_target_first`)
  - `random_seed`
- Provide preset packs (Conservative/Base/Aggressive) that populate the above; allow per‑profile overrides.

## QA & Telemetry

- Add integration tests covering:
  - Reactivation counts matching DAU targets.
  - Allowance totals equaling configured budget.
  - Retired players reappearing with refreshed runs.
- Update `engine/tests/player-continuity-fixes.test.ts` (or add new spec) to verify streak counters.
- Add checks for:
  - Per‑cohort DAU/WAU targets within tolerance across runs.
  - Donation amount == revenue × donation_rate (± rounding).
  - Soft‑churn transitions after configured inactive cycles.
  - Reactivation probability adherence (statistical bounds over long runs).
  - Front‑end normalizer reads new fields without regressions.

## Rollout Plan

1. Implement engine-side data structures and events.
2. Update orchestrator mapping and regenerate anchor datasets.
3. Update front-end normalizers/selectors and add UI presentation for allowance metrics.
4. Document behaviour in repo (README/STRUCTURE updates).

---

## Scope Notes

- In scope (v1): Per‑cohort DAU targeting, weekly allowance budgets, explicit reactivation of inactive/retired players, donation calculation, new metrics and presentation wiring.
- Optional (defer unless needed): Day‑of‑week spend shaping, promo events, loyalty coefficients that lift DAU/allowances/reactivation. Mapping supports these fields; keep disabled by default to maintain focus.
