#!/usr/bin/env node
/* =============================================================================
 *  World Cup 2026 Tracker — LIVE DATA FETCHER  (API-Football / api-sports.io)
 *  ---------------------------------------------------------------------------
 *  Pulls real fixtures, results, standings, squads and player stats for the
 *  2026 FIFA World Cup and writes a single snapshot file (../wc-live.json) in
 *  EXACTLY the shapes the app already consumes. The browser never calls the API
 *  directly (CORS + key exposure) — it just loads this static snapshot.
 *
 *  This is the "live data swap point" from the build brief (§4.5), realised as a
 *  build-time / cron-time fetch instead of a runtime proxy.
 *
 *  USAGE
 *    APIFOOTBALL_KEY=xxxxxxxx node tools/fetch-live.mjs            # full pull
 *    APIFOOTBALL_KEY=xxxxxxxx node tools/fetch-live.mjs --no-cards # skip per-match
 *                                                                  # card stats (saves quota)
 *    APIFOOTBALL_KEY=xxxxxxxx node tools/fetch-live.mjs --no-squads
 *
 *  Requires Node 18+ (built-in fetch). No npm install needed.
 *  Get a free key at https://www.api-football.com/  (header: x-apisports-key).
 * ============================================================================= */

import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'wc-live.json');

/* ---- .env loader (no dependency) -----------------------------------------
 * Reads APIFOOTBALL_KEY (and the other overrides) from a local .env file so you
 * don't retype the key. Looks for .env in the project root, then tools/. An env
 * var already set in the shell always wins. The .env file is gitignored. */
function loadEnv() {
  for (const p of [join(ROOT, '.env'), join(__dirname, '.env')]) {
    let text;
    try { text = readFileSync(p, 'utf8'); } catch { continue; }
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && process.env[k] === undefined) process.env[k] = v;
    }
  }
}
loadEnv();

/* ---- config -------------------------------------------------------------- */
const args = new Set(process.argv.slice(2));
const WANT_CARDS  = !args.has('--no-cards');
const WANT_SQUADS = !args.has('--no-squads');

// Two providers, one output shape. Pick with --provider=fd|af, else auto-detect by
// which key is present (football-data.org wins if both are set).
const KEY    = process.env.APIFOOTBALL_KEY;                                   // api-sports.io
const FD_KEY = process.env.FOOTBALLDATA_KEY;                                  // football-data.org
const BASE   = process.env.APIFOOTBALL_BASE || 'https://v3.football.api-sports.io';
const LEAGUE = Number(process.env.APIFOOTBALL_LEAGUE || 1);                   // 1 = World Cup
const SEASON = Number(process.env.APIFOOTBALL_SEASON || 2026);
const FD_BASE = process.env.FOOTBALLDATA_BASE || 'https://api.football-data.org/v4';
const FD_COMP = process.env.FOOTBALLDATA_COMP || 'WC';                        // World Cup
const provFlag = [...args].find(a => a.startsWith('--provider='));
const PROVIDER = provFlag ? provFlag.split('=')[1] : (FD_KEY ? 'fd' : 'af');

if (PROVIDER === 'af' && !KEY) {
  console.error('✗ Set APIFOOTBALL_KEY (api-sports.io) — or FOOTBALLDATA_KEY for football-data.org — and re-run.');
  process.exit(1);
}
if (PROVIDER === 'fd' && !FD_KEY) {
  console.error('✗ Set FOOTBALLDATA_KEY (your football-data.org token) and re-run.');
  process.exit(1);
}

/* ---- app team-id mapping --------------------------------------------------
 * The app keys everything by 3-letter ids (MEX, BRA…). API-Football uses its own
 * numeric ids + English names. We resolve by NAME (with aliases). If the draw
 * changes or a name doesn't match, add an alias here — unmapped teams are logged
 * loudly and skipped, never silently dropped.
 * ------------------------------------------------------------------------- */
const NAME_TO_ID = {
  'mexico': 'MEX',
  'south africa': 'RSA',
  'south korea': 'KOR', 'korea republic': 'KOR',
  'czechia': 'CZE', 'czech republic': 'CZE',
  'canada': 'CAN',
  'bosnia and herzegovina': 'BIH', 'bosnia & herzegovina': 'BIH', 'bosnia-herzegovina': 'BIH', 'bosnia herzegovina': 'BIH',
  'qatar': 'QAT',
  'switzerland': 'SUI',
  'brazil': 'BRA',
  'morocco': 'MAR',
  'haiti': 'HAI',
  'scotland': 'SCO',
  'usa': 'USA', 'united states': 'USA',
  'paraguay': 'PAR',
  'australia': 'AUS',
  'turkey': 'TUR', 'türkiye': 'TUR', 'turkiye': 'TUR',
  'germany': 'GER',
  'curacao': 'CUW', 'curaçao': 'CUW',
  'ivory coast': 'CIV', "cote d'ivoire": 'CIV', 'côte d’ivoire': 'CIV', "côte d'ivoire": 'CIV',
  'ecuador': 'ECU',
  'netherlands': 'NED',
  'japan': 'JPN',
  'sweden': 'SWE',
  'tunisia': 'TUN',
  'belgium': 'BEL',
  'egypt': 'EGY',
  'iran': 'IRN', 'ir iran': 'IRN',
  'new zealand': 'NZL',
  'spain': 'ESP',
  'cape verde': 'CPV', 'cabo verde': 'CPV', 'cape verde islands': 'CPV',
  'saudi arabia': 'KSA',
  'uruguay': 'URU',
  'france': 'FRA',
  'senegal': 'SEN',
  'iraq': 'IRQ',
  'norway': 'NOR',
  'argentina': 'ARG',
  'algeria': 'ALG',
  'austria': 'AUT',
  'jordan': 'JOR',
  'portugal': 'POR',
  'dr congo': 'COD', 'congo dr': 'COD', 'democratic republic of congo': 'COD', 'congo democratic republic': 'COD',
  'uzbekistan': 'UZB',
  'colombia': 'COL',
  'england': 'ENG',
  'croatia': 'CRO',
  'ghana': 'GHA',
  'panama': 'PAN',
};
const norm = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
const unmapped = new Set();
function appId(apiName) {
  const id = NAME_TO_ID[norm(apiName)];
  if (!id) unmapped.add(apiName);
  return id || null;
}

/* ---- API plumbing -------------------------------------------------------- */
async function api(path, params = {}) {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let res;
  try { res = await fetch(url, { headers: { 'x-apisports-key': KEY }, signal: ctrl.signal }); }
  catch (e) { throw new Error(e.name === 'AbortError' ? `${path} → timed out after 20s` : `${path} → ${e.message}`); }
  finally { clearTimeout(timer); }
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length) {
    throw new Error(`${path} → API error: ${JSON.stringify(json.errors)}`);
  }
  return json.response || [];
}

function mapStatus(short) {
  if (['FT', 'AET', 'PEN'].includes(short)) return 'final';
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(short)) return 'live';
  return 'scheduled';
}
function matchdayFromRound(round) {
  const m = /(\d+)\s*$/.exec(round || '');
  return m ? Number(m[1]) : 1;
}
function koRound(round) {
  const r = norm(round);
  if (r.includes('round of 32')) return 'R32';
  if (r.includes('round of 16')) return 'R16';
  if (r.includes('quarter')) return 'QF';
  if (r.includes('semi')) return 'SF';
  if (r.includes('3rd place') || r.includes('third place')) return 'TP';
  if (r.includes('final')) return 'F';
  return null;
}

/* ---- per-match card stats (optional, quota-heavy) ------------------------ */
async function cardsFor(fixtureId) {
  try {
    const stats = await api('/fixtures/statistics', { fixture: fixtureId });
    const out = {};
    stats.forEach((teamStat) => {
      const id = appId(teamStat.team?.name);
      if (!id) return;
      const get = (type) => {
        const row = (teamStat.statistics || []).find((s) => norm(s.type) === norm(type));
        return Number(row?.value) || 0;
      };
      out[id] = { yellow: get('Yellow Cards'), red: get('Red Cards') };
    });
    return out;
  } catch {
    return {};
  }
}

/* ---- builders ------------------------------------------------------------ */
async function buildFixtures() {
  const fixtures = await api('/fixtures', { league: LEAGUE, season: SEASON });
  const groupMatches = [];
  const knockoutFixtures = [];

  for (const f of fixtures) {
    const home = appId(f.teams?.home?.name);
    const away = appId(f.teams?.away?.name);
    const status = mapStatus(f.fixture?.status?.short);
    const base = {
      apiId: f.fixture?.id,
      home, away,
      kickoffUTC: f.fixture?.date,
      stadium: f.fixture?.venue?.name || '',
      city: f.fixture?.venue?.city || '',
      status,
      homeGoals: f.goals?.home ?? null,
      awayGoals: f.goals?.away ?? null,
      minute: f.fixture?.status?.elapsed ?? null,
    };
    const round = f.league?.round || '';
    const ko = koRound(round);
    if (ko) {
      const sh = f.fixture?.status?.short;
      knockoutFixtures.push({
        ...base, round: ko,
        winnerId: f.teams?.home?.winner ? home : f.teams?.away?.winner ? away : null,
        duration: sh === 'PEN' ? 'PENALTY_SHOOTOUT' : sh === 'AET' ? 'EXTRA_TIME' : 'REGULAR',
        penHome: f.score?.penalty?.home ?? null,
        penAway: f.score?.penalty?.away ?? null,
      });
    } else {
      // group stage row — needs a group letter from standings; filled in later
      groupMatches.push({ ...base, matchday: matchdayFromRound(round), group: null });
    }
  }
  return { groupMatches, knockoutFixtures };
}

async function tagGroups(groupMatches) {
  // standings tell us which team is in which group letter
  const standings = await api('/standings', { league: LEAGUE, season: SEASON });
  const teamGroup = {};
  const ranks = {};
  const groups = standings[0]?.league?.standings || [];
  groups.forEach((groupArr) => {
    groupArr.forEach((entry) => {
      const id = appId(entry.team?.name);
      if (!id) return;
      const letter = (entry.group || '').replace(/group\s*/i, '').trim().toUpperCase();
      if (letter) teamGroup[id] = letter;
      if (entry.rank) ranks[id] = entry.rank; // group rank, not FIFA rank — informational only
    });
  });
  groupMatches.forEach((m) => { m.group = (m.home && teamGroup[m.home]) || (m.away && teamGroup[m.away]) || null; });
  return groupMatches.filter((m) => m.group && m.home && m.away);
}

async function buildSquads() {
  // Resolve API team ids for this league/season, then pull squad + season stats.
  const teams = await api('/teams', { league: LEAGUE, season: SEASON });
  const squads = {};
  for (const t of teams) {
    const id = appId(t.team?.name);
    if (!id) continue;
    const apiTeamId = t.team?.id;
    let roster = [];
    try { roster = await api('/players/squads', { team: apiTeamId }); } catch { roster = []; }
    const players = (roster[0]?.players || []).map((p) => ({
      name: p.name,
      position: posBucket(p.position),
      number: p.number ?? null,
      appearances: 0, minutes: 0, yellow: 0, red: 0,
    }));
    // enrich with tournament stats (appearances/minutes/cards)
    try {
      const stats = await api('/players', { team: apiTeamId, league: LEAGUE, season: SEASON });
      const byName = new Map(players.map((p) => [norm(p.name), p]));
      stats.forEach((s) => {
        const p = byName.get(norm(s.player?.name));
        const g = s.statistics?.[0];
        if (!p || !g) return;
        p.appearances = g.games?.appearences ?? g.games?.appearance ?? 0;
        p.minutes = g.games?.minutes ?? 0;
        p.yellow = (g.cards?.yellow ?? 0) + (g.cards?.yellowred ?? 0);
        p.red = g.cards?.red ?? 0;
      });
    } catch { /* stats optional */ }
    squads[id] = { players, coaches: [] };
  }
  return squads;
}
function posBucket(pos) {
  const p = norm(pos);
  if (p.startsWith('goalkeeper') || p === 'g') return 'GK';
  if (p.startsWith('defender') || p === 'd') return 'DEF';
  if (p.startsWith('midfielder') || p === 'm') return 'MID';
  if (p.startsWith('attacker') || p.startsWith('forward') || p === 'f') return 'ATT';
  return 'MID';
}

/* ===========================================================================
 *  PROVIDER B — football-data.org (free tier; includes the World Cup)
 *  One snapshot shape, so the app needs zero changes. Free tier caveats:
 *  10 req/min, and squads carry names+positions only (no apps/minutes/cards).
 * ========================================================================= */
async function fdApi(path) {
  const url = FD_BASE + path;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);   // 20s hard timeout — never hang
  let res;
  try { res = await fetch(url, { headers: { 'X-Auth-Token': FD_KEY }, signal: ctrl.signal }); }
  catch (e) { throw new Error(e.name === 'AbortError' ? `${path} → timed out after 20s` : `${path} → ${e.message}`); }
  finally { clearTimeout(timer); }
  if (res.status === 429) throw new Error('football-data.org rate limit (free tier = 10 req/min) — wait a minute and retry');
  if (res.status === 403) throw new Error(`${path} → HTTP 403 (your free token may not cover this competition/season)`);
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}
function fdStatus(s) {
  if (['FINISHED', 'AWARDED'].includes(s)) return 'final';
  if (['IN_PLAY', 'PAUSED', 'SUSPENDED'].includes(s)) return 'live';
  return 'scheduled';
}
function fdRound(stage) {
  const s = (stage || '').toUpperCase();
  if (s === 'LAST_32') return 'R32';
  if (s === 'LAST_16') return 'R16';
  if (s === 'QUARTER_FINALS') return 'QF';
  if (s === 'SEMI_FINALS') return 'SF';
  if (s === 'THIRD_PLACE') return 'TP';
  if (s === 'FINAL') return 'F';
  return null;
}
function fdPos(pos) {
  const p = norm(pos);
  if (p.includes('goalkeeper')) return 'GK';
  if (p.includes('back') || p.includes('defence') || p.includes('defender')) return 'DEF';
  if (p.includes('midfield')) return 'MID';
  if (p.includes('wing') || p.includes('forward') || p.includes('offence') || p.includes('striker') || p.includes('attack')) return 'ATT';
  return 'MID';
}
async function runFootballData() {
  console.log(`→ Provider: football-data.org (competition ${FD_COMP}, season ${SEASON})`);
  const data = await fdApi(`/competitions/${FD_COMP}/matches?season=${SEASON}`);
  const groupMatches = [], knockoutFixtures = [];
  const koByRound = {};   // real kickoff times for EVERY knockout match (drawn or not)
  (data.matches || []).forEach((m) => {
    const home = appId(m.homeTeam?.name), away = appId(m.awayTeam?.name);
    const status = fdStatus(m.status);
    const base = {
      apiId: m.id, home, away, kickoffUTC: m.utcDate,
      stadium: m.venue || '', city: '', status,
      homeGoals: m.score?.fullTime?.home ?? null,
      awayGoals: m.score?.fullTime?.away ?? null,
      minute: m.minute ?? null,
    };
    if ((m.stage || '') === 'GROUP_STAGE') {
      const group = (m.group || '').replace(/group[_\s]*/i, '').trim().toUpperCase();
      if (home && away && group) groupMatches.push({ ...base, group, matchday: m.matchday || 1 });
    } else {
      const round = fdRound(m.stage);
      if (round) {
        // every knockout slot's scheduled time, even before the draw fills the teams
        (koByRound[round] = koByRound[round] || []).push(m.utcDate);
        if (home && away) {
          const sc = m.score || {};
          const reg = sc.regularTime || {}, et = sc.extraTime || {}, pen = sc.penalties || {}, ft = sc.fullTime || {};
          // football-data's `duration` field is unreliable (often "REGULAR" even with
          // extra-time/penalties); derive it from the actual score sub-objects instead.
          const hasET  = et.home != null || et.away != null;
          const hasPen = pen.home != null || pen.away != null;
          const duration = hasPen ? 'PENALTY_SHOOTOUT' : hasET ? 'EXTRA_TIME' : (sc.duration || 'REGULAR');
          // The *match* score we display is the level score the game went to a shootout on
          // (regulation + extra time). football-data bakes the shootout tally INTO `fullTime`
          // for penalty matches (e.g. 1-1 reported as 5-6), so for those we rebuild it.
          let homeGoals = base.homeGoals, awayGoals = base.awayGoals;
          if (hasPen) {
            if (reg.home != null) { homeGoals = (reg.home || 0) + (et.home || 0); awayGoals = (reg.away || 0) + (et.away || 0); }
            else if (ft.home != null && pen.home != null) { homeGoals = ft.home - pen.home; awayGoals = ft.away - pen.away; }
          }
          // Declare a winner only once final; prefer the feed's, else derive from the
          // shootout tally, else from the level score (covers the feed omitting `winner`).
          let winnerId = null;
          if (status === 'final') {
            if (sc.winner === 'HOME_TEAM') winnerId = home;
            else if (sc.winner === 'AWAY_TEAM') winnerId = away;
            else if (hasPen && pen.home != null && pen.away != null && pen.home !== pen.away) winnerId = pen.home > pen.away ? home : away;
            else if (homeGoals != null && awayGoals != null && homeGoals !== awayGoals) winnerId = homeGoals > awayGoals ? home : away;
          }
          knockoutFixtures.push({
            ...base, round, homeGoals, awayGoals, winnerId, duration,
            penHome: pen.home ?? null, penAway: pen.away ?? null,
          });
        }
      }
    }
  });
  // sort each round's kickoffs ascending so index ↔ official match-number order
  Object.keys(koByRound).forEach(r => koByRound[r].sort());

  let squads = {};
  if (WANT_SQUADS) {
    console.log('→ Pulling squads (names + positions; free tier has no per-player stats)…');
    try {
      const td = await fdApi(`/competitions/${FD_COMP}/teams?season=${SEASON}`);
      (td.teams || []).forEach((t) => {
        const id = appId(t.name);
        if (!id) return;
        const players = (t.squad || []).map((p) => ({
          name: p.name, position: fdPos(p.position), number: p.shirtNumber ?? null,
          appearances: 0, minutes: 0, yellow: 0, red: 0,
        }));
        if (players.length) squads[id] = { players, coaches: t.coach?.name ? [{ name: t.coach.name, role: 'Head Coach' }] : [] };
      });
    } catch (e) { console.warn('  ⚠ squads skipped:', e.message); }
  }
  return { groupMatches, knockoutFixtures, koByRound, squads, source: 'football-data.org' };
}

/* ---- API-Football pull (provider A) -------------------------------------- */
async function runApiFootball() {
  console.log(`→ Provider: API-Football (league ${LEAGUE}, season ${SEASON})`);
  const built = await buildFixtures();
  const tagged = await tagGroups(built.groupMatches);

  if (WANT_CARDS) {
    console.log(`→ Pulling card stats for ${tagged.filter((m) => m.status !== 'scheduled').length} played matches…`);
    for (const m of tagged) {
      if (m.status === 'scheduled') continue;
      const c = await cardsFor(m.apiId);
      m.homeYellow = c[m.home]?.yellow ?? 0; m.homeRed = c[m.home]?.red ?? 0;
      m.awayYellow = c[m.away]?.yellow ?? 0; m.awayRed = c[m.away]?.red ?? 0;
    }
  }
  let squads = {};
  if (WANT_SQUADS) { console.log('→ Pulling squads + player stats…'); squads = await buildSquads(); }
  return { groupMatches: tagged, knockoutFixtures: built.knockoutFixtures, koByRound: built.koByRound || {}, squads, source: 'api-football' };
}

/* ---- run (dispatch + shared finalize) ------------------------------------ */
(async () => {
  const { groupMatches, knockoutFixtures, koByRound, squads, source } =
    PROVIDER === 'fd' ? await runFootballData() : await runApiFootball();

  if (unmapped.size) {
    console.warn(`⚠ ${unmapped.size} unmapped team name(s) — add aliases to NAME_TO_ID (these are skipped):`);
    [...unmapped].forEach((n) => console.warn(`   · "${n}"`));
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source, season: SEASON,
    counts: {
      groupMatches: groupMatches.length,
      played: groupMatches.filter((m) => m.status === 'final').length,
      live: groupMatches.filter((m) => m.status === 'live').length,
      knockout: knockoutFixtures.length,
      squads: Object.keys(squads).length,
    },
    groupMatches, knockoutFixtures, koByRound: koByRound || {}, squads,
  };

  await writeFile(OUT, JSON.stringify(snapshot, null, 2));
  console.log(`✓ Wrote ${OUT}`);
  console.log(`  ${snapshot.counts.groupMatches} group matches (${snapshot.counts.played} final, ${snapshot.counts.live} live), ` +
              `${snapshot.counts.knockout} knockout, ${snapshot.counts.squads} squads.`);
})().catch((e) => { console.error('✗', e.message); process.exit(1); });
