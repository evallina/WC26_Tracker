#!/usr/bin/env node
/* =============================================================================
 *  World Cup 2026 Tracker — LOCAL DEV SERVER (autonomous live refresh)
 *  ---------------------------------------------------------------------------
 *  Serves the app's static files AND keeps wc-live.json fresh ON ITS OWN TIMER
 *  (background refresher), so data freshness no longer depends on the browser
 *  polling. The client just re-reads the snapshot; a hidden tab, a stuck client,
 *  or a slow API can't stop updates. Everything is timeout-guarded — nothing hangs.
 *
 *    • background loop: pulls every 30s while a match is live / about to start,
 *      every 4 min when idle. Each pull is killed after 35s if it stalls.
 *    • GET /api/refresh : force an immediate pull (the manual Refresh button).
 *    • GET /api/status  : { generatedAt, live, ageSeconds } for diagnostics.
 *
 *  Run:  node tools/serve.mjs    Env: PORT (default 8000), WC_NO_AUTOREFRESH=1
 *  Requires Node 18+. No npm install.
 * ============================================================================= */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'wc-live.json');
const PORT = Number(process.env.PORT || 8000);
const APP = 'index.html';
const AUTO = process.env.WC_NO_AUTOREFRESH !== '1';
const KILL_MS = 35000;            // kill a stalled fetch after 35s
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.css':'text/css', '.png':'image/png',
  '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.map':'application/json' };

/* ---- the fetch runner (de-duped, kill-timeout so it can never hang) ------- */
let running = null;
function runFetch(){
  if(running) return running;                    // collapse concurrent requests
  running = new Promise((resolve)=>{
    const p = spawn(process.execPath, [join(ROOT,'tools','fetch-live.mjs'), '--no-squads'], { cwd: ROOT });
    let out = '', killed = false;
    const timer = setTimeout(()=>{ killed = true; p.kill('SIGKILL'); }, KILL_MS);
    p.stdout.on('data', d => out += d);
    p.stderr.on('data', d => out += d);
    p.on('close', code => { clearTimeout(timer); running = null;
      resolve({ code: killed ? 124 : code, out: (killed ? 'killed (timeout) ' : '') + out.trim() }); });
    p.on('error', err => { clearTimeout(timer); running = null; resolve({ code:1, out:String(err) }); });
  });
  return running;
}

/* ---- snapshot inspection → adaptive cadence ------------------------------- */
function readSnap(){ try { return JSON.parse(readFileSync(OUT,'utf8')); } catch { return null; } }
function nextDelay(){
  const s = readSnap();
  if(!s) return 60000;
  const matches = [...(s.groupMatches||[]), ...(s.knockoutFixtures||[])];
  if(matches.some(m => m.status === 'live')) return 30000;          // live → 30s
  const now = Date.now();
  const times = [].concat(...Object.values(s.koByRound||{}));        // every knockout kickoff
  const near = times.some(t => { const d = new Date(t).getTime() - now; return d > -3*3600000 && d < 40*60000; });
  return near ? 45000 : 240000;                                     // near a kickoff → 45s, else 4 min
}

/* ---- autonomous background refresher -------------------------------------- */
let autoTimer = null;
async function tick(){
  const { code, out } = await runFetch();
  console.log(`[auto] exit ${code}: ${out.split('\n').slice(-1)[0]}`);
  schedule();
}
function schedule(delay){
  if(!AUTO) return;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(tick, delay != null ? delay : nextDelay());
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/refresh') {
    const { code, out } = await runFetch();
    const tail = out.split('\n').slice(-3);
    console.log(`[manual] exit ${code}: ${tail.join(' | ')}`);
    schedule();                                  // re-arm the background timer around this pull
    res.writeHead(code === 0 ? 200 : 503, { 'content-type':'application/json', 'cache-control':'no-store' });
    res.end(JSON.stringify({ ok: code === 0, log: tail }));
    return;
  }
  if (url.pathname === '/api/status') {
    const s = readSnap();
    const live = s ? [...(s.groupMatches||[]), ...(s.knockoutFixtures||[])].filter(m=>m.status==='live').length : 0;
    res.writeHead(200, { 'content-type':'application/json', 'cache-control':'no-store' });
    res.end(JSON.stringify({ generatedAt: s?.generatedAt || null, live,
      ageSeconds: s?.generatedAt ? Math.round((Date.now()-new Date(s.generatedAt))/1000) : null, auto: AUTO }));
    return;
  }

  // static files
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/' ) pathname = '/' + APP;
  const file = normalize(join(ROOT, pathname));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }   // path-traversal guard
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control':'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type':'text/plain' }); res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n  World Cup 2026 Tracker`);
  console.log(`  ▸ http://localhost:${PORT}/`);
  console.log(`  ▸ ${AUTO ? 'Auto-refreshing wc-live.json in the background (30s live / 4min idle).' : 'Auto-refresh OFF (WC_NO_AUTOREFRESH=1).'}`);
  console.log(`  ▸ Manual: /api/refresh · Status: /api/status\n`);
  if (AUTO) schedule(3000);                       // first background pull shortly after start
});
