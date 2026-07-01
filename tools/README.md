# Live data for the World Cup 2026 Tracker

The app never calls a sports API from the browser (CORS + key exposure, per the build
brief). Instead, **`fetch-live.mjs` pulls real data and writes a static snapshot**
(`../wc-live.json`) in the exact shapes the app already consumes. The app loads that
file; if it's missing or malformed, it falls back to the bundled demo seed.

```
fetch-live.mjs ──(your API key)──> api-football ──> wc-live.json ──> the app
```

## 1. Get a key (free) — football-data.org

The script supports two providers and **auto-picks** based on which key is in `.env`:

- **football-data.org** — *free* and covers the World Cup 2026 season. **Use this.**
- **API-Football / api-sports.io** — fuller (real per-player stats) but its **free**
  plan can't read the 2026 season; you'd need their paid plan.

To use the free one:

1. Register at <https://www.football-data.org/client/register> (instant, email only).
2. Copy the token they email you.
3. Paste it into `.env` as `FOOTBALLDATA_KEY=...` (the script then uses it automatically).

Free tier = **10 requests/minute**. A full pull is only ~2–3 requests (matches +
standings + one squads call), so you're nowhere near the limit. Caveat: free squads are
**names + positions only** — no appearances/minutes/cards — so those show as 0 in the
team modal until you move to a paid source.

## 2. Run it

Requires **Node 18+** (built-in `fetch`, no `npm install`). With the token in `.env`:

```bash
node tools/fetch-live.mjs                 # results + standings + knockout + squads
node tools/fetch-live.mjs --no-squads     # results only (squads change rarely)
```

It writes `wc-live.json` next to the app files and prints a summary
(`N group matches, X final, Y live, …`). Reload the app — the `[UPDATED hh:mm]` stamp
and the **Live / Demo** source chip reflect what loaded.

Force a provider with `--provider=fd` (football-data.org) or `--provider=af`
(API-Football) if you ever have both keys set.

### Overrides (env vars)
| var | default | meaning |
|---|---|---|
| `FOOTBALLDATA_KEY` | — | football-data.org token (free path) |
| `FOOTBALLDATA_COMP` | `WC` | competition code (World Cup) |
| `APIFOOTBALL_KEY` | — | api-sports.io key (paid for 2026) |
| `APIFOOTBALL_SEASON` | `2026` | season (both providers) |

## 3. Keep it fresh automatically (optional, free)

Run the script on a schedule with GitHub Actions and commit the snapshot. Add your key
as a repo secret `APIFOOTBALL_KEY`, then create `.github/workflows/refresh.yml`:

```yaml
name: Refresh live data
on:
  schedule:
    - cron: '*/15 * * * *'   # every 15 min; tighten to */5 on match days
  workflow_dispatch:
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: node tools/fetch-live.mjs --no-squads   # squads change rarely
        env:
          APIFOOTBALL_KEY: ${{ secrets.APIFOOTBALL_KEY }}
      - run: |
          git config user.name  'wc-bot'
          git config user.email 'wc-bot@users.noreply.github.com'
          git add wc-live.json
          git diff --staged --quiet || git commit -m "data: refresh $(date -u +%FT%TZ)"
          git push
```

Pull squads separately and less often (a daily job without `--no-squads`).

## 4. If a team name doesn't map

API-Football returns English names; the app keys by 3-letter ids. The mapping lives in
`NAME_TO_ID` inside `fetch-live.mjs`. Any name the API returns that isn't mapped is
**logged loudly and skipped** (never silently dropped) — add an alias and re-run.

## What's real vs. still local

| Data | Source after a successful pull |
|---|---|
| Group results, standings, clinch, probability bars | **API-Football** |
| Live scores + match minute | **API-Football** |
| Knockout results + who advances | **API-Football** (overlaid on the fixed bracket tree) |
| Squads, appearances, minutes, cards | **API-Football** |
| Flags, highlight colours, sim ratings, ES names | **local** (presentation only — the API doesn't carry these) |
| Stadiums/cities/dates of *future* knockout fixtures | **local** bracket tree until the API publishes them |
