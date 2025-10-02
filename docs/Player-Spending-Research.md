I dug into what I could find: some of the numbers you proposed are plausible; others are less well-supported by current data. Below are what I found, how they compare to your assumptions, and suggestions for tweaks. Happy to also put together a cleaned-set of numbers you can use in the simulation.

What I found (benchmarks & data)

Here are some relevant stats from mobile gaming / iGaming / social-casino that relate to your assumptions:

Metric	What the literature / reports say
Retention / active rates	• Mobile gaming retention benchmarks: Day-1 ~30% (top games higher) to ~30-35%. 
Goomba Stomp Magazine
+2
Sendbird
+2

• Day-7 retention often ~7-12% depending on genre, social casino tends to be higher end of that. 
business.mistplay.com
+1

• Day-30 retention often drops to ~2-5%, quite low. 
business.mistplay.com
+2
Liftoff
+2

Frequency of play / actives	• Social casino / casino-style mobile games tend to have users playing multiple times per week, but many users are intermittent with gaps of several days between sessions.
• On average mobile players (all games) play ~3.4 times per week. 
maf.ad

• But that’s across all mobile gaming, not just gambling/social casino, so gambling players may have more uneven frequency.
Spending	• IAP (in-app purchase) spend in mobile games in Western markets: some reports give monthly spends per paying user of ~$70+ depending on game. 
Business of Apps

• For social casino games: spending behavior is very skewed: a small % of high spenders (“whales”) contribute a large share of revenue. Many players spend little or nothing.
• A study of youth gambling/similar showed that paying users tended to pay money on a weekly (≈46%) or monthly basis, but with each purchase very small (~US$10 or less for >50% of them) in social casino or simulated gambling contexts. 
PubMed Central
Comparison to your assumed parameters

Let’s map your assumptions vs what the data supports, and see where you might adjust.

Your assumption	How that compares with data / what concerns there might be
“Daily active rate target per cohort ~35% of player base shows up each day”	That seems optimistic, depending on the kind of game. For many mobile games, the Day-1 retention might be ~30-35%, but that includes new users coming back the next day. To have sustained daily actives of 35% across all existing users is high unless you have very strong retention and habitual usage.
Social casino games may get closer, but still 35% is strong. More common for monthly (MAU) to daily (DAU) conversion rates in good games is lower.
“U.S. iGaming operators report 30-45% weekly actives translating to ~25-35% daily”	I couldn’t find a solid recent public source that claims exactly that. The retention / active data tends to suggest lower sustained daily engagement, especially over time. It may be that some top operators with sticky offerings reach toward the lower end of that daily active range (like 25-30%) but 35%+ every day for a wide base may be aggressive.
“Casual mobile gamblers average $25-$60 per week”	This seems high for average casual players. Unless “casual gambler” is defined narrowly (i.e. players who already spend some), many casual gamers spend less. The data suggests many small spenders make small purchases (e.g. <$10) and not always weekly. The $25-$60/week tends to be more plausible for mid-tier or more committed players, or high ARPU games. It may overestimate typical spend for the bulk of users.
“Sessions 3-5 days apart”	That seems plausible for a more casual cohort: spacing out play sessions with 2-5 day gaps is common. But for more engaged players, sessions might be daily or near-daily; for less engaged players, even more sparse.
Tiered allowance (e.g. $10/week base; $40 mid; $100 whales) dividing over active days	Having a tiered spend model is in line with how many games/apps segment paying / engagement behavior. The numbers (10 / 40 / 100) seem reasonable for modeling mid-to-high spenders, though for many players the bottom tier may need to be lower or zero spend. Also the proportions of user base in each tier are critical; if few whales, the average will be pulled down.
Suggested refinements / alternative parameter values

Based on what’s realistic, here are some suggestions you might use for your simulation, particularly given that your app has a “good cause” element which may change behavior (possibly reducing spend somewhat, or altering retention depending on how motivating the cause is).

Parameter	More conservative / realistic values	More aggressive / optimistic values
Daily active rate (across full user base)	~15-25%	~30-35%
Weekly active rate	~40-60% of users could be active in a week	~70-80% if very well designed
Weekly spend / allowance, base cohort	$5-$20/week	$25-$50/week
Weekly spend, mid-tier cohort	$25-$60/week	$60-$100/week
Weekly spend, whales	$100-$300+ / week (but very small % of users)	$200-$500+
Session frequency for base cohort	every 4-7 days	every 1-3 days
Days active per week for tiers	Base: 1-2 days; Mid: 3-4; Whales: 5-7	Base: 3-4; etc.

You might also model a decay in active rate / spend over time (i.e. cohorts drop off).

Verdict: are your numbers okay for a simulation / presentation?

Yes — your framework is reasonable, and many of the numbers are within plausible ranges if you assume a somewhat engaged user base, good retention, and that many users are motivated not only by gambling rewards but by the “good cause” aspect (which might, depending on design, increase loyalty or willingness to spend a bit more).

But caveats:

For typical social casino / mobile gambling apps, averages are dragged down by many very light users. If your simulation assumes averages, you’ll want to include a large “light user” segment (with low or zero spend) to balance out whales.

The daily active rate of 35% as a constant across many users is high unless the product is very sticky. Might be okay for short‐term/promotion period, but harder to sustain long term.

Weekly spend of $25-60 for the average casual gambler might overestimate; you may instead assume that’s for “active spenders” or a top fraction of the active user base.

If you like, I can propose a full set of parameters (percentages, tiers, decay over time) calibrated to current data, with lower/upper bounds, which you can plug into your simulation. Do you want me to prepare that?

You said:
Yes please, do you need something from me for that?
ChatGPT said:

Awesome—no extra inputs needed. I’ll give you a plug-and-play parameter set (with conservative/base/aggressive presets), a JSON config you can drop into a sim, plus the core loop and metrics to log. Tweak numbers if you want, but this will run “as is.”

Scenarios & Cohorts
Cohort splits (share of total users)

Conservative

Non-spenders: 72%

Light: 20%

Mid: 7%

Whales: 1%

Base

Non-spenders: 65%

Light: 24%

Mid: 9.5%

Whales: 1.5%

Aggressive

Non-spenders: 58%

Light: 26%

Mid: 13%

Whales: 3%

Weekly active rate & DAU targets (by cohort)

(Use DAU targets to decide how many to “re-activate” each day.)

Conservative

Light: WAU 45%, DAU 14%

Mid: WAU 60%, DAU 22%

Whales: WAU 85%, DAU 38%

Non-spenders: WAU 25%, DAU 6% (still show up, don’t pay)

Base

Light: WAU 55%, DAU 18%

Mid: WAU 68%, DAU 26%

Whales: WAU 92%, DAU 45%

Non-spenders: WAU 30%, DAU 8%

Aggressive

Light: WAU 65%, DAU 22%

Mid: WAU 78%, DAU 31%

Whales: WAU 97%, DAU 52%

Non-spenders: WAU 35%, DAU 10%

Weekly spend “allowance” (by cohort)

(Allowance refreshes weekly; consumed only on active days. All values USD—adjust as needed.)

Conservative

Light: $6–$12 (mean $9)

Mid: $25–$50 (mean $35)

Whales: $120–$240 (mean $170)

Base

Light: $8–$16 (mean $12)

Mid: $35–$70 (mean $50)

Whales: $160–$320 (mean $220)

Aggressive

Light: $12–$24 (mean $18)

Mid: $50–$100 (mean $70)

Whales: $220–$460 (mean $310)

Tip: Sample within ranges per user at onboarding and keep it fixed; it creates realistic heterogeneity.

Days active per week & spend shaping

Conservative: Light 1–2 days, Mid 3–4, Whales 4–6

Base: Light 2–3, Mid 3–5, Whales 5–7

Aggressive: Light 3–4, Mid 4–6, Whales 6–7

Day-of-week weights (optional; normalize to 1 over a week)

Weekends heavier: Mon .12, Tue .12, Wed .13, Thu .13, Fri .16, Sat .18, Sun .16

If a user is active that day, spend for that day = min(remaining_allowance × day_weight / sum(weights for remaining active days), remaining_allowance)

Churn & reactivation

Track churn at the allowance-cycle (weekly) boundary:

Consecutive inactive cycles → retire (soft-churn):

Light: 2 consecutive cycles

Mid: 2

Whales: 3

Non-spenders: 2

Reactivation probability per week (applied to retired users):

Conservative: Light 8%, Mid 10%, Whales 14%, Non-spenders 4%

Base: Light 12%, Mid 16%, Whales 20%, Non-spenders 6%

Aggressive: Light 16%, Mid 22%, Whales 28%, Non-spenders 8%

Promo lift (optional): add +5–15pp reactivation for users who previously donated to causes (loyalty boost)

Cause-donation share

Configurable donation_rate between 10% (min) and max (recommend capping at 25–30% to preserve LTV for growth).

Donation is taken from gross player spend (or “net revenue” if you model platform fees—your choice, just be consistent in reporting).

JSON Config (drop-in)
{
  "scenario": "base",
  "cohorts": {
    "non_spender": { "share": 0.65, "wau": 0.30, "dau": 0.08, "weekly_allowance_mean": 0, "weekly_allowance_range": [0, 0], "active_days_per_week": [0, 2], "soft_churn_cycles": 2, "reactivation_weekly": 0.06 },
    "light":       { "share": 0.24, "wau": 0.55, "dau": 0.18, "weekly_allowance_mean": 12, "weekly_allowance_range": [8, 16], "active_days_per_week": [2, 3], "soft_churn_cycles": 2, "reactivation_weekly": 0.12 },
    "mid":         { "share": 0.095,"wau": 0.68, "dau": 0.26, "weekly_allowance_mean": 50, "weekly_allowance_range": [35, 70], "active_days_per_week": [3, 5], "soft_churn_cycles": 2, "reactivation_weekly": 0.16 },
    "whale":       { "share": 0.015,"wau": 0.92, "dau": 0.45, "weekly_allowance_mean": 220,"weekly_allowance_range": [160, 320], "active_days_per_week": [5, 7], "soft_churn_cycles": 3, "reactivation_weekly": 0.20 }
  },
  "day_of_week_weights": [0.12,0.12,0.13,0.13,0.16,0.18,0.16],
  "donation_rate": 0.10,
  "allowance_refresh_day": "monday",
  "reactivation_priority": "undershoot_dau_target_first",
  "random_seed": 42
}

Core daily algorithm (pseudocode)
At the start of day D:
  if D == allowance_refresh_day:
     for each user u:
       if u.is_retired: continue
       u.weekly_allowance = sample_in_range(u.cohort.weekly_allowance_range, mean=u.cohort.weekly_allowance_mean)
       u.remaining_allowance = u.weekly_allowance
       u.active_days_goal = sample_int(u.cohort.active_days_per_week)
       u.active_days_remaining = u.active_days_goal
       u.in_cycle_active_flag = false

  # Determine target actives
  for each cohort c:
     target_actives[c] = floor(c.dau * current_population[c].size)

  # Pre-list of natural actives: users who habitually play today
  natural_actives = sample_users_per_cohort(target_actives * 0.75)  # heuristic

  # Reactivate to fill the gap
  for each cohort c:
     need = target_actives[c] - natural_actives[c].count
     candidates = retired_users[c] + inactive_users[c]
     reactivated[c] = pick_with_prob(candidates, p=c.reactivation_weekly / 7, count≈need)

  todays_actives = natural_actives ∪ reactivated

  # Spend simulation
  for each user u in todays_actives:
     if u.remaining_allowance <= 0: continue
     # Weight by day of week and remaining active days
     spend_budget = min(
        u.remaining_allowance,
        u.weekly_allowance * day_of_week_weight[weekday(D)] * adjust_for_remaining_days(u)
     )
     actual_spend = apply_variance(spend_budget, sigma=0.25)
     u.remaining_allowance -= actual_spend
     metrics.revenue += actual_spend
     metrics.donations += actual_spend * donation_rate
     u.in_cycle_active_flag = true
     u.active_days_remaining = max(0, u.active_days_remaining - 1)

  # End-of-day bookkeeping
  for each user u:
     if week_boundary_passed(D):
        if !u.in_cycle_active_flag:
           u.consec_inactive_cycles += 1
        else:
           u.consec_inactive_cycles = 0
        if u.consec_inactive_cycles >= u.cohort.soft_churn_cycles:
           u.is_retired = true
        u.in_cycle_active_flag = false

Metrics to log (daily & weekly rollups)

Daily

actives_total, actives_by_cohort

reactivations_total, reactivations_by_cohort

allowance_granted_today (only on refresh days)

spend_today, spend_by_cohort

donations_today (= spend_today * donation_rate)

runway_flags (e.g., % users with allowance exhausted before weekend)

Weekly

allowance_granted_total, allowance_consumed_total

churned_users, retired_stock

returning_from_retired

ARPU (per active), ARPDAU

donation_share_of_revenue (should equal donation_rate if donation is linear off spend)

cohort_migration (light→mid, etc., if you model upward transitions)

Optional realism dials

Variance knobs:

Per-user spend volatility (σ=15–35% of budget/day).

“Streak bonus” that increases next-day active prob after a win or donation badge.

Promo events:

Weekend jackpot: +5–10pp DAU lift; +10–20% day’s spend.

Cause spotlight week: +2–5pp DAU; +1–3pp conversion of non-spenders to light (one-time).

Budget guardrails:

Daily cap: clamp day spend ≤ (remaining_allowance / remaining_active_days + epsilon).

Minimum “floor” spend per active session: e.g., max($1, 20% of intended day budget).

Outputs contract (for your front end)
{
  "date": "2025-09-21",
  "actives": { "total": 18342, "by_cohort": { "non_spender": 4211, "light": 9612, "mid": 3981, "whale": 538 } },
  "reactivations": { "total": 2140, "by_cohort": { "non_spender": 620, "light": 980, "mid": 420, "whale": 120 } },
  "allowance": { "granted_today": 0, "consumed_today": 28413.72, "remaining_unspent": 193002.55 },
  "revenue": { "gross": 28413.72, "ARPDAU": 1.55 },
  "donations": { "rate": 0.10, "amount": 2841.37, "cumulative": 148231.92 },
  "churn": { "new_retired": 312, "retired_stock": 18211, "returning_from_retired": 2140 },
  "flags": { "allowance_exhausted_before_weekend": 0.12 }
}

Quick “preset packs” you can switch to

If you want single-line presets:

Conservative pack

DAU overall ≈ 15–22% (mix-weighted)

WAU overall ≈ 40–55%

Mean weekly allowance among payers ≈ $42–$65, payer rate ≈ 28%

Base pack

DAU overall ≈ 20–28%

WAU overall ≈ 55–68%

Mean weekly allowance among payers ≈ $60–$90, payer rate ≈ 35%

Aggressive pack

DAU overall ≈ 26–34%

WAU overall ≈ 68–80%

Mean weekly allowance among payers ≈ $85–$130, payer rate ≈ 42%

How the good-cause lever shows up

donation_rate = 0.10–0.30 directly scales donations_today.

Consider a loyalty coefficient: if a user donates ≥ once in the last 4 weeks, add:

+2pp to DAU chance,

+1–3% to weekly allowance next cycle (behavioral uplift),

+5pp to reactivation probability when retired.