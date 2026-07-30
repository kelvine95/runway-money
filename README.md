# Runway — a money copilot for daily earners

Most budgeting tools are built for people with a salary: money comes in twice a month, you
categorize where it goes, and the app draws a pie chart. That model quietly fails the people
who need help most — rideshare drivers, cleaners, movers, servers, construction labourers —
whose income arrives **daily, in unpredictable amounts**, while their biggest costs (rent,
childcare, phone) arrive **monthly, in fixed amounts**.

Runway goes beyond money-in/money-out. It treats **income volatility as the core problem**
and answers the four questions a daily earner actually has:

| Question | Typical budget app | Runway |
|---|---|---|
| "Can I spend this $30 today?" | shows your bank balance | **Safe-to-Spend Today** — reserves upcoming bills, essentials, and a 7-day buffer, assuming a *bad* income week (your own 25th percentile), not an average one |
| "Will I make rent?" | a category progress bar | **Bill Runway** — 400 Monte Carlo simulations of your next 30 days sampled from your own earning pattern; per-bill funding confidence, with gaps quoted in **shifts needed**, not dollars |
| "How do I stop living day-to-day?" | "spend less on coffee" | **Steady Paycheck** — computes your income floor and replays your real history to show the fixed daily paycheck you could pay yourself, and the buffer that makes it reliable |
| "Is this advance worth it?" | doesn't know it happened | **Advance Audit** — every wage advance priced as an effective APR, timing vs. your rent cliff, and how many were avoidable with a buffer |

Plus **Shift ROI**: for a daily earner, the biggest budget lever isn't spending — it's *which
work you say yes to*. Runway prices your own history per hour by weekday, shift type, and
employer, and quantifies the upside of trading your weakest slot for your best one.

**Life Pulse** puts the worker inside the economy around them. It calculates personalized
inflation from their actual essential-spending mix, compares observed take-home pay with their
city's living wage, translates inflation drag into shifts per month, and shows official
Canada/Alberta and US reference points. A private, local daily check-in adds adaptive
micro-missions: surplus days invite tiny buffer moves; lean days prioritize protection and
wellbeing rather than pressuring the worker to save.

## Research that shaped the design

**Where existing products stop (reviewed July 2026):**

- **Earned-wage-access / cash-advance apps** (EarnIn, Dave, Brigit, Cleo, DailyPay, Payactiv,
  Chime MyPay): they sell relief from volatility and price it per crisis — subscription fees,
  per-advance fees, express-transfer fees, tips. Several exclude gig/daily earners outright
  because they verify income via W-2 direct deposits. Alerts like Balance Shield warn you the
  cliff is close; none of them help you stop arriving at the cliff.
- **Budgeting apps** (YNAB and the credit-union canon for irregular income): the advice is
  right — find your income floor, route earnings to a holding account, pay yourself a fixed
  salary, build a buffer, keep a cash-flow calendar — but it's left as **manual discipline**.
  Nobody computes the floor from your actual earnings or replays your history to prove the
  method would have worked *for you*.
- **Even** (the app that pioneered "Okay to Spend" + paycheck smoothing for hourly workers)
  validated this exact need before shutting down; nothing mainstream filled the gap for
  daily/gig earners.
- **Macroeconomic baseline**: July 2026 official releases show Alberta CPI at 3.4% and
  unemployment at 7.0%. Canada-wide transportation rose 6.7%, groceries 3.9%, and gasoline
  20.5% year over year. Alberta's minimum wage remains $15/hour, while 2025 living-wage
  estimates range from $18.15 in Medicine Hat to $26.50 in Calgary.
- **Ethical habit design**: behavioral-finance research supports tiny daily actions, visible
  progress, and nudges timed to income surplus. It also warns that fixed savings prompts during
  lean periods can increase stress and disengagement, so Runway changes the mission rather than
  punishing a broken streak.

**What the dataset says (synthetic cohort, 220 Alberta workers, Apr–Jul 2026):**

- 535 wage advances taken in ~14 weeks, **$1,435 in fees** — a quiet annualized tax of
  hundreds of dollars per advance-user, concentrated on the workers with the least slack.
- Advance requests cluster in the days before rent is due; top stated reasons are groceries,
  childcare, emergencies, and "bill due" — *timing* problems, not overspending problems.
- Median worker income volatility is 0.2–0.55 (std/mean of daily net pay); rent burden is
  "high" or "severe" for most of the cohort. The problem isn't the monthly total — it's that
  the money and the bills don't arrive on the same calendar.

## The data

Six CSVs in `public/data/` (synthetic, no real PII):

| File | Grain | Highlights |
|---|---|---|
| `workers.csv` | 1 row / worker (220) | occupation, pay type, volatility, rent burden, dependents |
| `daily_earnings.csv` | 1 row / shift (12,204) | net pay, tips, hours, employer, shift type, same-day-pay flag |
| `transactions.csv` | 1 row / txn (31,726) | credits/debits, category, essential flag, running balance |
| `recurring_obligations.csv` | 1 row / bill (849) | rent, phone, utilities, childcare, due day, autopay |
| `earned_wage_advances.csv` | 1 row / advance (535) | amount, fee, reason, repayment timing |
| `weekly_cashflow_summary.csv` | 1 row / worker-week | income, essentials, buffer-days estimate |

Note: the feed's `running_balance_cad` is per-stream and internally inconsistent (a known
quirk of the generator), so the app rebuilds one canonical ledger from transaction deltas
anchored at the first observed balance.

## Methodology

- **Safe-to-Spend Today** = `balance + conservative income − bills due − essentials − buffer floor`,
  spread over a 14-day horizon. Conservative income is the worker's own **P25 weekly net**
  (planning for a bad stretch); essentials are observed trailing-56-day variable essential
  spend; the buffer floor is 7 days of (essentials + prorated obligations).
- **Steady Paycheck** = P25 of observed full weeks ÷ 7, replayed day-by-day through actual
  history: earnings fill a holding buffer, the paycheck draws from it. Reported: paycheck
  reliability, ending buffer, and which real advances (and fees) the buffer would have absorbed.
- **Bill Runway** = 400-trial Monte Carlo; each future day's income is sampled from the
  worker's trailing 56 daily nets (off-days included), minus daily essentials, minus scheduled
  bills on due dates. Deterministic seed per worker. Outputs P10/P50/P90 balance fan,
  per-bill funding confidence, and shortfalls converted to **shifts** via median net/shift.
- **Advance Audit** = effective APR (`fee ÷ amount × 365 ÷ days outstanding`), request timing
  relative to the next rent due date, annualized fee pace, and the steady-paycheck
  counterfactual.
- **Personal inflation** = official Canadian category inflation weighted by the worker's own
  essential transaction shares. Macro releases are displayed as a dated context layer and are
  not injected into the historical forecast, avoiding hindsight leakage.

## Live demo

**https://kelvine95.github.io/runway-money/**

## Run it locally

```bash
npm install
npm run dev     # local dev server
npm run build   # production build in dist/
```

Vite + React + TypeScript + Recharts. No backend — all analytics run client-side from the
CSVs. The app opens on the cohort's heaviest advance user; use the sidebar to switch among
all 220 workers.

## Honest limitations

- Synthetic data; real deployments would ingest bank/payroll feeds (e.g. Plaid, payroll APIs).
- The buffer replay assumes spending discipline the UI can encourage but not enforce.
- Monte Carlo sampling is i.i.d. daily; it ignores weekday seasonality and streaks (a
  hidden-Markov income model is the obvious next step).
- Quantile choices (P25 floor, 7-day buffer) are sensible defaults, not personalized yet.
