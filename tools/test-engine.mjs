import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const win = {};
new Function('window', readFileSync(ROOT+'/wc-thirds.js','utf8'))(win);
new Function('window', readFileSync(ROOT+'/wc-data.js','utf8'))(win);
new Function('window', readFileSync(ROOT+'/wc-engine.js','utf8'))(win);
const WC = win.WC, E = win.WCEngine;
let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓',m);} else {fail++;console.log('  ✗',m);} };

// Build a sample snapshot: Group A fully played (final), rest scheduled.
const A = WC.TEAMS.filter(t=>t.group==='A').map(t=>t.id); // [MEX,RSA,KOR,CZE]
const gm=(no,home,away,hg,ag,extra={})=>({matchNo:no,group:'A',home,away,matchday:1,
  kickoffUTC:'2026-06-15T16:00:00Z',venueTz:'America/New_York',stadium:'X',city:'Y',country:'USA',
  status:'final',homeGoals:hg,awayGoals:ag,...extra});
// Make MEX dominate (3 wins) → should clinch top-2 & finish 1st.
const groupMatches=[
  gm(1,A[0],A[1],3,0,{homeYellow:1,awayYellow:2,homeRed:0,awayRed:1}),
  gm(2,A[2],A[3],1,1),
  gm(3,A[0],A[2],2,1),
  gm(4,A[3],A[1],0,0),
  gm(5,A[3],A[0],0,2),   // MEX 3-0-0
  gm(6,A[1],A[2],1,2),   // KOR beats RSA
];
const snap={ generatedAt:new Date().toISOString(), source:'api-football',
  groupMatches, knockoutFixtures:[
    {round:'R32',home:'MEX',away:'GHA',homeGoals:2,awayGoals:0,winnerId:'MEX',status:'final'},
  ], squads:{ MEX:{players:[{name:'Test GK',position:'GK',appearances:3,minutes:270,yellow:0,red:0}],coaches:[]} } };

console.log('validateSnapshot — good payload:');
ok(WC.validateSnapshot(snap).ok, 'valid snapshot accepted');

console.log('validateSnapshot — bad payloads rejected:');
ok(!WC.validateSnapshot({groupMatches:[{home:'XXX',away:'MEX',group:'A',status:'final',homeGoals:1,awayGoals:0}]}).ok,'unknown team id rejected');
ok(!WC.validateSnapshot({groupMatches:[{home:'MEX',away:'RSA',group:'Z',status:'final',homeGoals:1,awayGoals:0}]}).ok,'bad group rejected');
ok(!WC.validateSnapshot({groupMatches:[{home:'MEX',away:'RSA',group:'A',status:'final',homeGoals:null,awayGoals:0}]}).ok,'played match w/o goals rejected');

console.log('standings + cards + clinch:');
const st=E.allStandings(groupMatches);
const a=st['A'];
ok(a[0].id==='MEX' && a[0].Pts===9, 'MEX 1st with 9 pts');
ok(a[0].GD===6, 'MEX GD +6 (7-1)');
const rsa=a.find(r=>r.id==='RSA');
ok(rsa.yellow===2 && rsa.red===1, 'RSA card totals accumulated (2Y,1R)');
ok(rsa.fair === -(2 + 4*1), 'RSA fair-play = -(yellows + 4*reds) = -6');
const cl=E.clinchStatus('A', groupMatches);
ok(cl['MEX'].clinched===true, 'MEX clinched (no remaining matches)');
ok(cl['MEX'].clinchedFirst===true, 'MEX clinched 1st');
const last=a[3];
ok(cl[last.id].eliminatedTop2===true, 'bottom team eliminated from top-2');

console.log('thirds + simulate (no remaining → deterministic):');
const thirds=E.rankThirds(st);
ok(thirds.length===12, '12 thirds ranked');
const sim=E.simulate(groupMatches, WC.knockout, 200);
ok(sim && sim.teamProb && sim.slotContenders, 'simulate returns shape');
ok(sim.teamProb['MEX'].win===1, 'MEX win-group prob = 1 (group decided)');

console.log('real squad preferred:');
const sq=E.squadFor('MEX', 3, snap.squads);
ok(sq.players.length===1 && sq.players[0].name==='Test GK', 'real squad used when present');
const proc=E.squadFor('MEX', 3, null);
ok(proc.players.length>1, 'procedural squad when no real data');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
