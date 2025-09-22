# Gambling-App Player Behavior Simulation Research

This document summarizes research benchmarks and proposes parameter sets for simulating player behavior in a gambling-style app with a good-cause donation component.

---

## Benchmarks & Industry Data

| Metric | Findings |
|---|---|
| **Retention / Active Rates** | • Mobile gaming retention benchmarks: Day‑1 ~30% (top games higher). <br>• Day‑7: ~7‑12%. <br>• Day‑30: ~2‑5%. |
| **Frequency of Play / Actives** | • Average mobile players play ~3.4 times/week. <br>• Social casino players more uneven but multiple sessions per week. |
| **Spending** | • Monthly spend per paying user can reach ~$70+ in Western markets. <br>• Social casino skew: small % of whales drive revenue. <br>• Many players make small (<$10) weekly/monthly purchases. |

---

## Comparison to Initial Assumptions

| Assumption | Assessment |
|---|---|
| **DAU ~35% of player base** | High compared to most benchmarks; possible only in aggressive scenarios or short-term campaigns. |
| **Weekly actives 30‑45% → 25‑35% DAU** | Not strongly supported; typical DAU/MAU closer to 15‑25%. |
| **$25‑$60/week casual spend** | High for casuals; fits mid-tier payers. Most casuals spend less. |
| **Sessions 3‑5 days apart** | Plausible for casual cohort; heavy users are more frequent. |
| **Tiered allowance $10 / $40 / $100** | Reasonable as tiers, but base allowance may be lower for many users. |

---

## Refined Simulation Parameters

### Cohort Splits
- Conservative: Non-spenders 72%, Light 20%, Mid 7%, Whales 1%  
- Base: Non-spenders 65%, Light 24%, Mid 9.5%, Whales 1.5%  
- Aggressive: Non-spenders 58%, Light 26%, Mid 13%, Whales 3%

### Weekly Active & Daily Active Rates
- Conservative: Light DAU 14%, Mid 22%, Whales 38%  
- Base: Light DAU 18%, Mid 26%, Whales 45%  
- Aggressive: Light DAU 22%, Mid 31%, Whales 52%  

### Weekly Spend Ranges
- Conservative: Light $6‑12, Mid $25‑50, Whales $120‑240  
- Base: Light $8‑16, Mid $35‑70, Whales $160‑320  
- Aggressive: Light $12‑24, Mid $50‑100, Whales $220‑460  

### Days Active per Week
- Conservative: Light 1‑2, Mid 3‑4, Whales 4‑6  
- Base: Light 2‑3, Mid 3‑5, Whales 5‑7  
- Aggressive: Light 3‑4, Mid 4‑6, Whales 6‑7  

---

## Churn & Reactivation

- **Soft churn** after 2‑3 inactive cycles depending on cohort.  
- **Reactivation probability per week**: Light 8‑16%, Mid 10‑22%, Whales 14‑28%, Non‑spenders 4‑8%.  
- **Promo lift**: +5‑15pp reactivation if tied to donations or events.  

---

## Donation Mechanic

- Donation rate configurable **10‑30%** of spend.  
- Donation can provide loyalty uplift: +2pp DAU, +1‑3% weekly allowance growth, +5pp reactivation probability.

---

## JSON Config Example

```json
{
  "scenario": "base",
  "cohorts": {
    "non_spender": { "share": 0.65, "dau": 0.08, "weekly_allowance_range": [0, 0] },
    "light": { "share": 0.24, "dau": 0.18, "weekly_allowance_range": [8, 16] },
    "mid": { "share": 0.095, "dau": 0.26, "weekly_allowance_range": [35, 70] },
    "whale": { "share": 0.015, "dau": 0.45, "weekly_allowance_range": [160, 320] }
  },
  "donation_rate": 0.10
}
```

---

## Simulation Flow (Simplified)

1. Refresh weekly allowance each cycle.  
2. Sample daily actives per cohort based on DAU targets.  
3. Assign daily spend proportional to allowance and day-of-week weights.  
4. Deduct spend, log donations, and flag allowance exhaustion.  
5. Apply churn rules at cycle end; reactivation probability weekly.  

---

## Metrics to Track

- **Daily:** Active users, reactivations, allowance consumed, spend, donations.  
- **Weekly:** Churned users, returning users, ARPU, ARPDAU, donation share.  

---

## Preset Packs

- **Conservative:** DAU 15‑22%, mean payer spend $42‑65/week.  
- **Base:** DAU 20‑28%, mean payer spend $60‑90/week.  
- **Aggressive:** DAU 26‑34%, mean payer spend $85‑130/week.  

---

# End of Document
