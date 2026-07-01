# WC26 Tracker — FIFA World Cup 2026 Bracket Tracker & Predictor

An interactive, single-page tracker for the **2026 FIFA World Cup**: live group
standings with the full FIFA tiebreaker cascade, clinch/elimination detection, a
Monte-Carlo qualification simulator, the complete knockout bracket with real venues and
kickoff times, a "play your bracket" predictor, a champion crest, and timezone /
language / light-dark controls.

**Live site:** https://evallina.github.io/WC26_Tracker/ &nbsp;<sub>(goes live once GitHub Pages is enabled)</sub>

<!-- Screenshot: drop an image at img/screenshot.png and uncomment:
![WC26 Tracker](img/screenshot.png)
-->
_Screenshot: add `img/screenshot.png` and reference it here._

---

## Run locally

### 1. Static (exactly what GitHub Pages serves)
Serve the repo root with any static server — **not** `file://`, which blocks `fetch()` of the local JSON:

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

The app reads the committed `wc-live.json`; no backend required.

### 2. With live refresh (optional, Node 18+)
`tools/serve.mjs` serves the files **and** exposes `/api/refresh`, backed by
`tools/fetch-live.mjs`, which pulls fresh data from [football-data.org](https://www.football-data.org).

```bash
cp .env.example .env      # then put your FOOTBALLDATA_KEY in .env (gitignored)
node tools/serve.mjs      # http://localhost:8000/ — the Refresh button now pulls live
```

One-off manual fetch: `node tools/fetch-live.mjs --no-squads`

---

## How the data flows

- The **browser only ever reads the static `wc-live.json`** snapshot (via
  `window.WC.fetchTournamentState()`). If it's missing or invalid, the app falls back to a
  bundled demo seed, so it **always renders**.
- GitHub Pages can't run the Node server, so a **scheduled GitHub Action**
  (`.github/workflows/refresh-data.yml`, every ~5 min) runs the fetcher and commits an
  updated `wc-live.json`. The app re-reads it; the **Refresh** button re-reads it too.
- **Data source:** football-data.org (free tier). Venues, schedule, kickoff times, and the
  495-row best-third allocation table are encoded in `wc-data.js` / `wc-thirds.js`.

### Enabling the scheduled refresh (one-time)
Add your football-data.org key as a **repository secret**:

> **Settings → Secrets and variables → Actions → New repository secret**
> Name: `FOOTBALLDATA_KEY` · Value: *your token*

The workflow reads it from `secrets.FOOTBALLDATA_KEY`. The key is **never committed**; if
the secret is absent the workflow no-ops instead of failing.

---

## Project layout

| Path | Role |
|---|---|
| `index.html` | the entire app (a DCLogic component) |
| `support.js` | the DCLogic runtime |
| `wc-data.js` | teams, venues, schedule, bracket topology, the live-data adapter |
| `wc-engine.js` | standings, FIFA tiebreakers, clinch logic, Monte-Carlo simulation |
| `wc-thirds.js` | the official 495-row best-third allocation table |
| `wc-live.json` | the live snapshot the app reads |
| `tools/` | `fetch-live.mjs` (fetcher), `serve.mjs` (dev server), `test-engine.mjs` (tests) |
| `.github/workflows/refresh-data.yml` | scheduled data refresh |

## Tests
```bash
node tools/test-engine.mjs   # 16 checks: standings, tiebreakers, clinch, simulation, snapshot validation
```

## Notes & limitations
- Free-tier football-data.org has **no per-player stats**, no venue data (venues are
  hand-encoded), and no live-minute field.
- The app loads three public CDNs at runtime: React (unpkg), circular flag SVGs
  (jsDelivr), and the Inter font (Google Fonts).

## License
[MIT](LICENSE)
