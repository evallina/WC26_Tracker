/* =============================================================================
 *  World Cup 2026 Tracker — RULES ENGINE
 *  -------------------------------------
 *  Pure functions: standings (§2 tiebreakers), clinch enumeration (§3.1),
 *  Monte Carlo prediction (§3.2), procedural squads (§9). Exposes window.WCEngine.
 * ============================================================================= */
(function () {
  'use strict';
  const WC = window.WC;
  const byId = WC.byId;

  /* ---- helpers -------------------------------------------------------------- */
  function blankRow(id){ return {id, P:0,W:0,D:0,L:0,GF:0,GA:0,GD:0,Pts:0, fair:0, yellow:0, red:0}; }
  function applyMatch(rows, m){
    if(m.status==='scheduled' || m.homeGoals==null) return;
    const h=rows[m.home], a=rows[m.away];
    h.P++; a.P++; h.GF+=m.homeGoals; h.GA+=m.awayGoals; a.GF+=m.awayGoals; a.GA+=m.homeGoals;
    if(m.homeGoals>m.awayGoals){ h.W++; h.Pts+=3; a.L++; }
    else if(m.homeGoals<m.awayGoals){ a.W++; a.Pts+=3; h.L++; }
    else { h.D++; a.D++; h.Pts++; a.Pts++; }
    h.GD=h.GF-h.GA; a.GD=a.GF-a.GA;
    // §2 fair-play (used in tiebreaks + best-3rd table). Per-match team card totals
    // give straight yellows/reds; we approximate fair = −1·yellow −4·red (closer to
    // 0 is better). Exact card-type weighting needs per-event data; documented approx.
    if(m.homeYellow!=null || m.homeRed!=null){
      h.yellow+=m.homeYellow||0; h.red+=m.homeRed||0; h.fair-=(m.homeYellow||0)+4*(m.homeRed||0);
      a.yellow+=m.awayYellow||0; a.red+=m.awayRed||0; a.fair-=(m.awayYellow||0)+4*(m.awayRed||0);
    }
  }

  // §2 ranking inside a group (overall record BEFORE head-to-head).
  function rankGroup(ids, matches){
    const rows = {}; ids.forEach(id=>rows[id]=blankRow(id));
    matches.forEach(m=>applyMatch(rows, m));
    const arr = ids.map(id=>rows[id]);
    arr.sort((a,b)=>{
      if(b.Pts!==a.Pts) return b.Pts-a.Pts;
      if(b.GD!==a.GD)   return b.GD-a.GD;
      if(b.GF!==a.GF)   return b.GF-a.GF;
      // head-to-head among tied
      const tied = arr.filter(x=>x.Pts===a.Pts && x.GD===a.GD && x.GF===a.GF).map(x=>x.id);
      if(tied.length>1 && tied.includes(a.id) && tied.includes(b.id)){
        const h = miniTable(tied, matches);
        const ha=h[a.id], hb=h[b.id];
        if(hb.Pts!==ha.Pts) return hb.Pts-ha.Pts;
        if(hb.GD!==ha.GD)   return hb.GD-ha.GD;
        if(hb.GF!==ha.GF)   return hb.GF-ha.GF;
      }
      if(a.fair!==b.fair) return a.fair-b.fair;   // fewer disciplinary pts better (stored negative→closer to 0)
      return byId[b.id].rating - byId[a.id].rating; // deterministic stand-in for drawing of lots
    });
    arr.forEach((r,i)=>r.pos=i+1);
    return arr;
  }
  function miniTable(ids, matches){
    const rows={}; ids.forEach(id=>rows[id]=blankRow(id));
    matches.filter(m=>ids.includes(m.home)&&ids.includes(m.away)).forEach(m=>applyMatch(rows,m));
    return rows;
  }

  function allStandings(groupMatches){
    const out = {};
    WC.GROUPS.forEach(g=>{
      const ids = WC.TEAMS.filter(t=>t.group===g).map(t=>t.id);
      out[g] = rankGroup(ids, groupMatches.filter(m=>m.group===g));
    });
    return out;
  }

  // Rank the twelve 3rd-placed teams against each other (§2). Returns ordered ids.
  function rankThirds(standings){
    const thirds = WC.GROUPS.map(g=>({g, row: standings[g][2]}));
    thirds.sort((x,y)=>{
      const a=x.row,b=y.row;
      if(b.Pts!==a.Pts) return b.Pts-a.Pts;
      if(b.GD!==a.GD)   return b.GD-a.GD;
      if(b.GF!==a.GF)   return b.GF-a.GF;
      if(a.fair!==b.fair) return a.fair-b.fair;
      return byId[b.id].rating-byId[a.id].rating;
    });
    return thirds; // [{g,row}], best first
  }

  // Map the qualifying 8 thirds → winner-group slots using the OFFICIAL FIFA
  // Annexe-C lookup (window.WC_THIRDS, 495 rows). Key = the 8 qualifying-third
  // group letters sorted & joined. Returns { winnerGroup: thirdGroup }.
  function assignThirds(qualifiedThirds){
    const table = (typeof window!=='undefined') ? window.WC_THIRDS : null;
    const key = qualifiedThirds.map(t=>t.g).sort().join('');
    if(table && table[key]) return Object.assign({}, table[key]);
    // Fallback (only if the table is missing or fed ≠8 thirds): greedy by candidate set.
    const slots = Object.keys(WC.bestThirdCandidateGroups);
    const avail = qualifiedThirds.map(t=>t.g).sort();
    const taken = {}; const out = {};
    slots.forEach(slot=>{
      const cands = WC.bestThirdCandidateGroups[slot];
      const pick = avail.find(g=>!taken[g] && cands.includes(g)) || avail.find(g=>!taken[g]);
      if(pick){ taken[pick]=1; out[slot]=pick; }
    });
    return out;
  }

  /* ---- §3.1 exact clinch / eliminate enumeration --------------------------- */
  function remainingGroupMatches(g, groupMatches){
    return groupMatches.filter(m=>m.group===g && (m.status==='scheduled'||m.homeGoals==null));
  }
  // returns map id -> { clinchedTop2, eliminatedTop2 }
  function clinchStatus(g, groupMatches){
    const ids = WC.TEAMS.filter(t=>t.group===g).map(t=>t.id);
    const played = groupMatches.filter(m=>m.group===g && m.status!=='scheduled' && m.homeGoals!=null);
    const rem = remainingGroupMatches(g, groupMatches);
    const status = {}; ids.forEach(id=>status[id]={top2:0,first:0,total:0});
    // enumerate 3^rem outcomes (rem ≤ 2 here)
    const combos = Math.pow(3, rem.length);
    for(let c=0;c<combos;c++){
      let n=c; const sim = played.slice();
      for(const m of rem){
        const o=n%3; n=Math.floor(n/3);
        const [hg,ag] = o===0?[1,0] : o===1?[0,1] : [0,0];
        sim.push({...m, homeGoals:hg, awayGoals:ag, status:'final'});
      }
      const ranked = rankGroup(ids, sim);
      ids.forEach(id=>{
        const pos = ranked.find(r=>r.id===id).pos;
        status[id].total++;
        if(pos<=2) status[id].top2++;
        if(pos===1) status[id].first++;
      });
    }
    const out={};
    ids.forEach(id=>{
      const s=status[id];
      out[id]={ clinched: s.top2===s.total, clinchedFirst: s.first===s.total, eliminatedTop2: s.top2===0 };
    });
    return out;
  }

  /* ---- §3.2 Monte Carlo ----------------------------------------------------- */
  function mulberry32(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  function poisson(lambda,r){ const L=Math.exp(-lambda); let k=0,p=1; do{k++;p*=r();}while(p>L); return k-1; }
  function expG(rA,rB){ const d=(rA-rB)/180; return Math.max(0.25, 1.35+d*0.55); }

  function simulate(groupMatches, knockout, runs){
    runs = runs || WC.simulation.runs;
    const r = mulberry32(20260611);
    const groupRem = {}; WC.GROUPS.forEach(g=>groupRem[g]=remainingGroupMatches(g,groupMatches));
    const groupPlayed = {}; WC.GROUPS.forEach(g=>groupPlayed[g]=groupMatches.filter(m=>m.group===g && m.status!=='scheduled' && m.homeGoals!=null));
    const ids = {}; WC.GROUPS.forEach(g=>ids[g]=WC.TEAMS.filter(t=>t.group===g).map(t=>t.id));

    // tallies
    const winGroup={}, runnerUp={}, bestThird={}, qualify={};
    WC.TEAMS.forEach(t=>{ winGroup[t.id]=0; runnerUp[t.id]=0; bestThird[t.id]=0; qualify[t.id]=0; });
    // slotFill[winnerGroup][teamId] = count of times that team filled the 3rd slot
    const slotFill = {}; Object.keys(WC.bestThirdCandidateGroups).forEach(s=>slotFill[s]={});

    for(let run=0; run<runs; run++){
      const standings={};
      WC.GROUPS.forEach(g=>{
        const sim = groupPlayed[g].slice();
        groupRem[g].forEach(m=>{
          const h=byId[m.home], a=byId[m.away];
          const hg=poisson(expG(h.rating+40,a.rating),r), ag=poisson(expG(a.rating,h.rating+40),r);
          sim.push({...m, homeGoals:hg, awayGoals:ag, status:'final'});
        });
        standings[g]=rankGroup(ids[g], sim);
        winGroup[standings[g][0].id]++; runnerUp[standings[g][1].id]++;
        qualify[standings[g][0].id]++; qualify[standings[g][1].id]++;
      });
      const thirds = rankThirds(standings);
      const top8 = thirds.slice(0,8);
      top8.forEach(t=>{ bestThird[t.row.id]++; qualify[t.row.id]++; });
      const assign = assignThirds(top8);
      Object.entries(assign).forEach(([slot, thirdG])=>{
        const id = standings[thirdG][2].id;
        slotFill[slot][id] = (slotFill[slot][id]||0)+1;
      });
    }

    const pct = (n)=> n/runs;
    const P = {};
    WC.TEAMS.forEach(t=>{ P[t.id]={ win:pct(winGroup[t.id]), ru:pct(runnerUp[t.id]), third:pct(bestThird[t.id]), qualify:pct(qualify[t.id]) }; });
    // per-slot top contenders
    const slotContenders={};
    Object.entries(slotFill).forEach(([slot,counts])=>{
      slotContenders[slot] = Object.entries(counts).map(([id,n])=>({id, p:n/runs}))
        .sort((a,b)=>b.p-a.p);
    });
    return { teamProb:P, slotContenders, runs };
  }

  /* ---- procedural squads (§9, demo) ---------------------------------------- */
  const FIRST = ['Lucas','Mateo','Liam','Noah','Hugo','Leo','Kai','Omar','Yuki','Ali','Diego','Ethan','Adam','Jonas','Marco','Ivan','Tariq','Pablo','Sven','Kenji','Mamadou','Bruno','Niko','Felix','Andre','Samir','Theo','Rasmus','Joao','Dani'];
  const LAST = ['Silva','Müller','Tanaka','Diallo','Kim','Rossi','Hansen','Novak','Cohen','Mensah','Okafor','Larsson','Costa','Dubois','Vargas','Haidar','Petrov','Reyes','Bauer','Sato','Traore','Moreau','Jensen','Marin','Lopez','Sani','Berg','Ferrari','Cruz','Park'];
  function squadFor(teamId, gamesPlayed, squads){
    // Prefer a real squad from the live snapshot; fall back to procedural demo roster.
    if(squads && squads[teamId] && squads[teamId].players && squads[teamId].players.length){
      const real = squads[teamId];
      const order = {GK:0,DEF:1,MID:2,ATT:3};
      const players = real.players.slice().sort((a,b)=>
        (order[a.position]??9)-(order[b.position]??9) || (b.minutes||0)-(a.minutes||0));
      return { players, coaches: real.coaches && real.coaches.length ? real.coaches : [] };
    }
    const r = mulberry32(teamId.split('').reduce((a,c)=>a+c.charCodeAt(0),7)*101);
    const counts = {GK:3, DEF:8, MID:8, ATT:7};
    const players=[];
    Object.entries(counts).forEach(([pos,n])=>{
      for(let i=0;i<n;i++){
        const starter = i < (pos==='GK'?1:pos==='ATT'?3:4);
        const apps = starter ? Math.min(gamesPlayed, 1+Math.floor(r()*gamesPlayed)) : Math.floor(r()*Math.max(1,gamesPlayed));
        players.push({
          name: `${FIRST[Math.floor(r()*FIRST.length)]} ${LAST[Math.floor(r()*LAST.length)]}`,
          position: pos, number: players.length+1,
          appearances: apps, minutes: apps*(60+Math.floor(r()*35)),
          yellow: r()<0.3?1:0, red: r()<0.04?1:0,
        });
      }
    });
    const coaches=[
      {name:`${FIRST[Math.floor(r()*FIRST.length)]} ${LAST[Math.floor(r()*LAST.length)]}`, role:'Head Coach'},
      {name:`${FIRST[Math.floor(r()*FIRST.length)]} ${LAST[Math.floor(r()*LAST.length)]}`, role:'Assistant Coach'},
      {name:`${FIRST[Math.floor(r()*FIRST.length)]} ${LAST[Math.floor(r()*LAST.length)]}`, role:'Goalkeeping Coach'},
    ];
    return {players, coaches};
  }

  window.WCEngine = {
    allStandings, rankGroup, rankThirds, assignThirds,
    clinchStatus, simulate, squadFor,
  };
})();
