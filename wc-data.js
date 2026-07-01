/* =============================================================================
 *  World Cup 2026 Tracker — SEED DATA & TOURNAMENT CONFIG
 *  -------------------------------------------------------
 *  ⚠ DEMO DATA — to be replaced by the live feed via data/adapter (see §4.5).
 *  This module is the single source of truth for: theme tokens, the 2026 format
 *  rules, all 48 teams, the (deterministically generated) group schedule, and
 *  the full knockout tree. Exposes window.WC.
 * ============================================================================= */
(function () {
  'use strict';

  /* ---- THEME (from design-direction-editorial-modernist.md) ---------------- */
  const THEME = {
    surface:    { light: '#F5F2EC', dark: '#1A1814' },
    foreground: { light: '#1A1814', dark: '#F5F2EC' },
    gold: '#C2A14D',
    accentPalette: [
      { name: 'Green',  hex: '#16A34A' },
      { name: 'Amber',  hex: '#F59E0B' },
      { name: 'Red',    hex: '#DC2626' },
      { name: 'Orange', hex: '#EA580C' },
      { name: 'Lime',   hex: '#65A30D' },
      { name: 'Blue',   hex: '#2563EB' },
      { name: 'Indigo', hex: '#4F46E5' },
      { name: 'Pink',   hex: '#DB2777' },
    ],
    accentDefault: '#42D674',
  };

  /* ---- FORMAT RULES (§2) ---------------------------------------------------- */
  const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
  const worldCupWinners = ['BRA','GER','ARG','FRA','ENG','ESP','URU'];
  // number of World Cup titles per nation → gold stars (ITA listed for completeness)
  const worldCupTitles = { BRA:5, GER:4, ITA:4, ARG:3, FRA:2, URU:2, ENG:1, ESP:1 };
  // the actual winning years per nation (chronological) — drives the champion star halo
  const titleYears = {
    BRA:[1958,1962,1970,1994,2002], GER:[1954,1974,1990,2014], ITA:[1934,1938,1982,2006],
    ARG:[1978,1986,2022], FRA:[1998,2018], URU:[1930,1950], ENG:[1966], ESP:[2010],
  };

  // For each group winner that faces a best-3rd in the R32, the OFFICIAL set of
  // groups that 3rd-placed opponent can come from (prints on the card, §6.4).
  // Verified from the official 2026 knockout bracket (Wikipedia knockout-stage page).
  const bestThirdCandidateGroups = {
    E: ['A','B','C','D','F'],   // M74 (Winner E)
    I: ['C','D','F','G','H'],   // M77 (Winner I)
    A: ['C','E','F','H','I'],   // M79 (Winner A)
    L: ['E','H','I','J','K'],   // M80 (Winner L)
    D: ['B','E','F','I','J'],   // M81 (Winner D)
    G: ['A','E','H','I','J'],   // M82 (Winner G)
    B: ['E','F','G','I','J'],   // M85 (Winner B)
    K: ['D','E','I','J','L'],   // M87 (Winner K)
  };

  /* ---- TEAMS (§4.1, §9) ----------------------------------------------------- */
  // [id, name, nameEs, group, rating, flag, highlightColor]
  // Real 2026 World Cup final draw (Dec 5 2025) + resolved play-off winners.
  // [id, name, nameEs, group, rating, flag, highlightColor]
  const T = (id,name,nameEs,group,rating,flag,color)=>({id,name,nameEs,group,rating,flag,highlightColor:color});
  const TEAMS = [
    // A — Mexico (host), South Africa, South Korea, Czech Republic
    T('MEX','Mexico','México','A',1790,'🇲🇽','#0B6E4F'),
    T('RSA','South Africa','Sudáfrica','A',1610,'🇿🇦','#007749'),
    T('KOR','South Korea','Corea del Sur','A',1730,'🇰🇷','#0047A0'),
    T('CZE','Czechia','Chequia','A',1690,'🇨🇿','#11457E'),
    // B — Canada (host), Bosnia & Herzegovina, Qatar, Switzerland
    T('CAN','Canada','Canadá','B',1700,'🇨🇦','#D52B1E'),
    T('BIH','Bosnia & Herz.','Bosnia y Herz.','B',1650,'🇧🇦','#FFD100'),
    T('QAT','Qatar','Catar','B',1590,'🇶🇦','#8A1538'),
    T('SUI','Switzerland','Suiza','B',1820,'🇨🇭','#D52B1E'),
    // C — Brazil, Morocco, Haiti, Scotland
    T('BRA','Brazil','Brasil','C',2040,'🇧🇷','#E5B80B'),
    T('MAR','Morocco','Marruecos','C',1830,'🇲🇦','#C1272D'),
    T('HAI','Haiti','Haití','C',1480,'🇭🇹','#00209F'),
    T('SCO','Scotland','Escocia','C',1700,'🏴󠁧󠁢󠁳󠁣󠁴󠁿','#1B3A6B'),
    // D — United States (host), Paraguay, Australia, Türkiye
    T('USA','USA','EE. UU.','D',1760,'🇺🇸','#2B3158'),
    T('PAR','Paraguay','Paraguay','D',1660,'🇵🇾','#D52B1E'),
    T('AUS','Australia','Australia','D',1690,'🇦🇺','#0B7A3B'),
    T('TUR','Türkiye','Turquía','D',1810,'🇹🇷','#E30A17'),
    // E — Germany, Curaçao, Ivory Coast, Ecuador
    T('GER','Germany','Alemania','E',1960,'🇩🇪','#C9A227'),
    T('CUW','Curaçao','Curazao','E',1470,'🇨🇼','#002B7F'),
    T('CIV','Ivory Coast','Costa de Marfil','E',1700,'🇨🇮','#F77F00'),
    T('ECU','Ecuador','Ecuador','E',1790,'🇪🇨','#FFCE00'),
    // F — Netherlands, Japan, Sweden, Tunisia
    T('NED','Netherlands','Países Bajos','F',1980,'🇳🇱','#F36C21'),
    T('JPN','Japan','Japón','F',1820,'🇯🇵','#BC002D'),
    T('SWE','Sweden','Suecia','F',1740,'🇸🇪','#FECC00'),
    T('TUN','Tunisia','Túnez','F',1660,'🇹🇳','#E70013'),
    // G — Belgium, Egypt, Iran, New Zealand
    T('BEL','Belgium','Bélgica','G',1930,'🇧🇪','#C8102E'),
    T('EGY','Egypt','Egipto','G',1670,'🇪🇬','#C8102E'),
    T('IRN','Iran','Irán','G',1710,'🇮🇷','#239F40'),
    T('NZL','New Zealand','Nueva Zelanda','G',1520,'🇳🇿','#1A1A1A'),
    // H — Spain, Cape Verde, Saudi Arabia, Uruguay
    T('ESP','Spain','España','H',2080,'🇪🇸','#C60B1E'),
    T('CPV','Cape Verde','Cabo Verde','H',1540,'🇨🇻','#003893'),
    T('KSA','Saudi Arabia','Arabia Saudí','H',1600,'🇸🇦','#006C35'),
    T('URU','Uruguay','Uruguay','H',1850,'🇺🇾','#5CA9DD'),
    // I — France, Senegal, Iraq, Norway
    T('FRA','France','Francia','I',2030,'🇫🇷','#21304F'),
    T('SEN','Senegal','Senegal','I',1820,'🇸🇳','#00853F'),
    T('IRQ','Iraq','Irak','I',1560,'🇮🇶','#CE1126'),
    T('NOR','Norway','Noruega','I',1840,'🇳🇴','#BA0C2F'),
    // J — Argentina, Algeria, Austria, Jordan
    T('ARG','Argentina','Argentina','J',2060,'🇦🇷','#6CACE4'),
    T('ALG','Algeria','Argelia','J',1700,'🇩🇿','#007A3B'),
    T('AUT','Austria','Austria','J',1760,'🇦🇹','#C8102E'),
    T('JOR','Jordan','Jordania','J',1540,'🇯🇴','#007A3D'),
    // K — Portugal, DR Congo, Uzbekistan, Colombia
    T('POR','Portugal','Portugal','K',1990,'🇵🇹','#006600'),
    T('COD','DR Congo','RD Congo','K',1620,'🇨🇩','#0085CA'),
    T('UZB','Uzbekistan','Uzbekistán','K',1580,'🇺🇿','#1EB53A'),
    T('COL','Colombia','Colombia','K',1880,'🇨🇴','#FCD116'),
    // L — England, Croatia, Ghana, Panama
    T('ENG','England','Inglaterra','L',2000,'🏴󠁧󠁢󠁥󠁮󠁧󠁿','#C8102E'),
    T('CRO','Croatia','Croacia','L',1860,'🇭🇷','#C8102E'),
    T('GHA','Ghana','Ghana','L',1680,'🇬🇭','#FCD116'),
    T('PAN','Panama','Panamá','L',1620,'🇵🇦','#D21034'),
  ];
  // Real FIFA Men's World Ranking (Nov 19 2025) used at the draw.
  const RANKS = {ESP:1,ARG:2,FRA:3,ENG:4,BRA:5,POR:6,NED:7,BEL:8,GER:9,CRO:10,MAR:11,COL:13,USA:14,MEX:15,URU:16,SUI:17,JPN:18,SEN:19,IRN:20,SWE:22,KOR:23,ECU:24,AUT:25,AUS:26,TUR:27,CAN:28,NOR:29,PAN:30,EGY:34,ALG:35,SCO:36,PAR:39,TUN:41,CIV:42,CZE:44,QAT:52,COD:55,UZB:57,KSA:58,IRQ:60,RSA:61,JOR:66,CPV:68,BIH:71,GHA:72,CUW:82,HAI:84,NZL:86};
  // ISO country code for round-flag images (HatScripts circle-flags); home nations
  // use their gb-* codes. Falls back to the emoji if a flag image can't load.
  const ISO = {
    MEX:'mx', RSA:'za', KOR:'kr', CZE:'cz', CAN:'ca', BIH:'ba', QAT:'qa', SUI:'ch',
    BRA:'br', MAR:'ma', HAI:'ht', SCO:'gb-sct', USA:'us', PAR:'py', AUS:'au', TUR:'tr',
    GER:'de', CUW:'cw', CIV:'ci', ECU:'ec', NED:'nl', JPN:'jp', SWE:'se', TUN:'tn',
    BEL:'be', EGY:'eg', IRN:'ir', NZL:'nz', ESP:'es', CPV:'cv', KSA:'sa', URU:'uy',
    FRA:'fr', SEN:'sn', IRQ:'iq', NOR:'no', ARG:'ar', ALG:'dz', AUT:'at', JOR:'jo',
    POR:'pt', COD:'cd', UZB:'uz', COL:'co', ENG:'gb-eng', CRO:'hr', GHA:'gh', PAN:'pa',
  };
  TEAMS.forEach(t => { t.isWorldCupWinner = worldCupWinners.includes(t.id); t.fifaRank = RANKS[t.id]||99; t.iso = ISO[t.id]||null; t.wcTitles = worldCupTitles[t.id]||0; t.titleYears = titleYears[t.id]||[]; });
  const byId = Object.fromEntries(TEAMS.map(t => [t.id, t]));

  /* ---- DETERMINISTIC GROUP SCHEDULE (§4.3) --------------------------------- */
  // mulberry32 seeded PRNG → reproducible "results".
  function rng(seed){ return function(){ seed|=0; seed = seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  function poisson(lambda, r){ const L=Math.exp(-lambda); let k=0,p=1; do{ k++; p*=r(); }while(p>L); return k-1; }
  function expectedGoals(rA, rB){ const diff=(rA-rB)/180; return Math.max(0.25, 1.35 + diff*0.55); }

  // Round-robin for a group of 4: MD1, MD2 final; MD3 scheduled (drives clinch + sim).
  const RR = [ [[0,1],[2,3]], [[0,2],[3,1]], [[3,0],[1,2]] ];
  const GROUP_CITIES = {
    A:['Mexico City','MEX'], B:['Vancouver','CAN'], C:['Houston','USA'], D:['Philadelphia','USA'],
    E:['Boston','USA'], F:['Monterrey','MEX'], G:['Seattle','USA'], H:['Miami','USA'],
    I:['New York','USA'], J:['Atlanta','USA'], K:['Toronto','CAN'], L:['Los Angeles','USA'],
  };

  // Pre-tournament state: every group match is scheduled (no fabricated scores).
  // Standings, clinches and bars are therefore real PREDICTIONS off the FIFA ranking —
  // nothing is invented. Live results plug in through the adapter below.
  function buildGroupMatches(){
    const matches=[]; let no=1;
    GROUPS.forEach((g, gi)=>{
      const members = TEAMS.filter(t=>t.group===g).sort((a,b)=>(RANKS[a.id]||99)-(RANKS[b.id]||99));
      const [city,country] = GROUP_CITIES[g];
      RR.forEach((md, mdi)=>{
        md.forEach(([i,j])=>{
          const home=members[i], away=members[j];
          matches.push({
            matchNo:no++, group:g, home:home.id, away:away.id, matchday:mdi+1,
            kickoffUTC:`2026-06-${String(15+mdi*4+gi%3).padStart(2,'0')}T${String(16+(gi%4)).padStart(2,'0')}:00:00Z`,
            venueTz:'America/New_York', stadium:`${city} Stadium`, city, country,
            status:'scheduled', homeGoals:null, awayGoals:null,
          });
        });
      });
    });
    return matches;
  }

  /* ---- KNOCKOUT TREE (§4.4, §6.4) — OFFICIAL 2026 STRUCTURE ----------------- */
  // Match numbers, feeder pairings, bracket topology, venues, dates and (R32)
  // kickoff times are the official published schedule (FIFA / Wikipedia knockout
  // stage), cross-verified against the live feed's real R32 draw. Slot ids map
  // onto the app's mirrored layout; the live adapter overlays real teams + scores.
  // feeder types: gw=group winner, ru=runner-up, t3=best third (by winner-group), mw=match winner
  const gw=(g)=>({type:'groupWinner',ref:g});
  const ru=(g)=>({type:'groupRunnerUp',ref:g});
  const t3=(g)=>({type:'bestThird',ref:g});         // ref = winner's group letter
  const mw=(slot)=>({type:'matchWinner',ref:slot});
  const ml=(slot)=>({type:'matchLoser',ref:slot});  // loser of a match (3rd-place game)

  // 16 host venues — city, tournament stadium, IANA tz, summer UTC offset (stable
  // across Jun 28–Jul 19, no DST transition in-window; Mexico is UTC−6 year-round).
  const VENUE = {
    ATL:{city:'Atlanta',      stadium:'Mercedes-Benz Stadium',   tz:'America/New_York',    off:-4, country:'USA'},
    BOS:{city:'Boston',       stadium:'Gillette Stadium',        tz:'America/New_York',    off:-4, country:'USA'},
    DAL:{city:'Dallas',       stadium:'AT&T Stadium',            tz:'America/Chicago',     off:-5, country:'USA'},
    HOU:{city:'Houston',      stadium:'NRG Stadium',             tz:'America/Chicago',     off:-5, country:'USA'},
    KC :{city:'Kansas City',  stadium:'Arrowhead Stadium',       tz:'America/Chicago',     off:-5, country:'USA'},
    LA :{city:'Los Angeles',  stadium:'SoFi Stadium',            tz:'America/Los_Angeles', off:-7, country:'USA'},
    MEX:{city:'Mexico City',  stadium:'Estadio Azteca',          tz:'America/Mexico_City', off:-6, country:'MEX'},
    MIA:{city:'Miami',        stadium:'Hard Rock Stadium',       tz:'America/New_York',    off:-4, country:'USA'},
    MTY:{city:'Monterrey',    stadium:'Estadio BBVA',            tz:'America/Monterrey',   off:-6, country:'MEX'},
    NYC:{city:'New York',     stadium:'MetLife Stadium',         tz:'America/New_York',    off:-4, country:'USA'},
    PHI:{city:'Philadelphia', stadium:'Lincoln Financial Field', tz:'America/New_York',    off:-4, country:'USA'},
    SF :{city:'San Francisco',stadium:"Levi's Stadium",          tz:'America/Los_Angeles', off:-7, country:'USA'},
    SEA:{city:'Seattle',      stadium:'Lumen Field',             tz:'America/Los_Angeles', off:-7, country:'USA'},
    TOR:{city:'Toronto',      stadium:'BMO Field',               tz:'America/Toronto',     off:-4, country:'CAN'},
    VAN:{city:'Vancouver',    stadium:'BC Place',                tz:'America/Vancouver',   off:-7, country:'CAN'},
  };
  // local wall time + venue offset → absolute ISO instant (null when time unpublished).
  function koUTC(iso, time, off){
    if(!time) return null;
    const [mo,da]=iso.split('-').map(Number); const [hh,mm]=time.split(':').map(Number);
    return new Date(Date.UTC(2026, mo-1, da, hh, mm) - off*3600000).toISOString();
  }

  const KO = [];
  const K=(matchNo,round,slot,vkey,iso,time,home,away)=>{
    const v=VENUE[vkey];
    KO.push({matchNo, round, slot, city:v.city, stadium:v.stadium, country:v.country,
      venueTz:v.tz, date:{iso, t:time||null, tz:v.tz}, kickoffUTC:koUTC(iso,time,v.off),
      homeFeeder:home, awayFeeder:away, status:'scheduled'});
  };

  // R32 (matchNo, slot, venue, date, time-local, home-feeder, away-feeder)
  // — LEFT half (feeds SF sf_1) —
  K(74,'R32','r32_1', 'BOS','06-29','16:30', gw('E'), t3('E'));
  K(77,'R32','r32_2', 'NYC','06-30','17:00', gw('I'), t3('I'));
  K(73,'R32','r32_3', 'LA', '06-28','12:00', ru('A'), ru('B'));
  K(75,'R32','r32_4', 'MTY','06-29','19:00', gw('F'), ru('C'));
  K(83,'R32','r32_5', 'TOR','07-02','19:00', ru('K'), ru('L'));
  K(84,'R32','r32_6', 'LA', '07-02','12:00', gw('H'), ru('J'));
  K(81,'R32','r32_7', 'SF', '07-01','17:00', gw('D'), t3('D'));
  K(82,'R32','r32_8', 'SEA','07-01','13:00', gw('G'), t3('G'));
  // — RIGHT half (feeds SF sf_2) —
  K(76,'R32','r32_9', 'HOU','06-29','12:00', gw('C'), ru('F'));
  K(78,'R32','r32_10','DAL','06-30','12:00', ru('E'), ru('I'));
  K(79,'R32','r32_11','MEX','06-30','19:00', gw('A'), t3('A'));
  K(80,'R32','r32_12','ATL','07-01','12:00', gw('L'), t3('L'));
  K(86,'R32','r32_13','MIA','07-03','18:00', gw('J'), ru('H'));
  K(88,'R32','r32_14','DAL','07-03','13:00', ru('D'), ru('G'));
  K(85,'R32','r32_15','VAN','07-02','20:00', gw('B'), t3('B'));
  K(87,'R32','r32_16','KC', '07-03','20:30', gw('K'), t3('K'));

  // R16 (times unpublished → date only until the live feed carries them)
  K(89,'R16','r16_1','PHI','07-04',null, mw('r32_1'), mw('r32_2'));
  K(90,'R16','r16_2','HOU','07-04',null, mw('r32_3'), mw('r32_4'));
  K(93,'R16','r16_3','DAL','07-06',null, mw('r32_5'), mw('r32_6'));
  K(94,'R16','r16_4','SEA','07-06',null, mw('r32_7'), mw('r32_8'));
  K(91,'R16','r16_5','NYC','07-05',null, mw('r32_9'), mw('r32_10'));
  K(92,'R16','r16_6','MEX','07-05',null, mw('r32_11'), mw('r32_12'));
  K(95,'R16','r16_7','ATL','07-07',null, mw('r32_13'), mw('r32_14'));
  K(96,'R16','r16_8','VAN','07-07',null, mw('r32_15'), mw('r32_16'));

  // QF
  K(97, 'QF','qf_1','BOS','07-09',null, mw('r16_1'), mw('r16_2'));
  K(98, 'QF','qf_2','LA', '07-10',null, mw('r16_3'), mw('r16_4'));
  K(99, 'QF','qf_3','MIA','07-11',null, mw('r16_5'), mw('r16_6'));
  K(100,'QF','qf_4','KC', '07-11',null, mw('r16_7'), mw('r16_8'));

  // SF
  K(101,'SF','sf_1','DAL','07-14',null, mw('qf_1'), mw('qf_2'));
  K(102,'SF','sf_2','ATL','07-15',null, mw('qf_3'), mw('qf_4'));

  // 3rd place + Final
  K(103,'TP','third','MIA','07-18',null, ml('sf_1'), ml('sf_2'));
  K(104,'F', 'final','NYC','07-19',null, mw('sf_1'), mw('sf_2'));

  /* ---- LIVE SNAPSHOT VALIDATION -------------------------------------------- */
  // Fail loudly at the boundary so a malformed feed never throws deep in render.
  // Returns {ok:true} or {ok:false, errors:[...]}.
  function validateSnapshot(s){
    const errors = [];
    const known = new Set(TEAMS.map(t=>t.id));
    if(!s || typeof s!=='object') return {ok:false, errors:['snapshot is not an object']};
    if(!Array.isArray(s.groupMatches)) errors.push('groupMatches must be an array');
    (s.groupMatches||[]).forEach((m,i)=>{
      if(!known.has(m.home)) errors.push(`groupMatches[${i}].home unknown id "${m.home}"`);
      if(!known.has(m.away)) errors.push(`groupMatches[${i}].away unknown id "${m.away}"`);
      if(!GROUPS.includes(m.group)) errors.push(`groupMatches[${i}].group invalid "${m.group}"`);
      if(!['scheduled','live','final'].includes(m.status)) errors.push(`groupMatches[${i}].status invalid "${m.status}"`);
      if(m.status!=='scheduled' && (typeof m.homeGoals!=='number' || typeof m.awayGoals!=='number'))
        errors.push(`groupMatches[${i}] played match missing numeric goals`);
    });
    if(s.knockoutFixtures && !Array.isArray(s.knockoutFixtures)) errors.push('knockoutFixtures must be an array');
    (s.knockoutFixtures||[]).forEach((k,i)=>{
      if(k.home && !known.has(k.home)) errors.push(`knockoutFixtures[${i}].home unknown id "${k.home}"`);
      if(k.away && !known.has(k.away)) errors.push(`knockoutFixtures[${i}].away unknown id "${k.away}"`);
    });
    if(s.squads && typeof s.squads!=='object') errors.push('squads must be an object');
    return errors.length ? {ok:false, errors} : {ok:true};
  }

  /* ---- ADAPTER (§4.5) — the one swap point for live data -------------------- */
  // Tries the static live snapshot (wc-live.json, produced by tools/fetch-live.mjs);
  // on any problem — missing file, fetch error, failed validation — falls back to
  // the bundled demo seed so the app always renders. The `source` field tells the UI
  // which it got ('live' vs 'demo').
  async function fetchTournamentState(){
    const seed = {
      teams: TEAMS,
      groupMatches: buildGroupMatches(),
      knockout: KO,
      knockoutFixtures: [],
      koByRound: null,
      squads: null,
      source: 'demo',
      generatedAt: null,
    };
    try {
      const res = await fetch('./wc-live.json', { cache:'no-store' });
      if(!res.ok) throw new Error('HTTP '+res.status);
      const snap = await res.json();
      const v = validateSnapshot(snap);
      if(!v.ok){ console.warn('[WC] live snapshot rejected:\n  '+v.errors.join('\n  ')); return seed; }
      return {
        teams: TEAMS,                       // presentation (flag/colour/rating/ES) stays local
        groupMatches: snap.groupMatches,    // real results replace the projected schedule
        knockout: KO,                       // bracket geometry/feeders stay local…
        knockoutFixtures: snap.knockoutFixtures || [],  // …results overlay onto it (§ resolve)
        koByRound: snap.koByRound || null,  // real kickoff time per knockout slot
        squads: snap.squads || null,
        source: 'live',
        generatedAt: snap.generatedAt || null,
      };
    } catch(e){
      console.info('[WC] no live snapshot ('+(e&&e.message||e)+') — using demo seed.');
      return seed;
    }
  }

  window.WC = {
    THEME, GROUPS, worldCupWinners, bestThirdCandidateGroups,
    TEAMS, byId, knockout: KO, fetchTournamentState, validateSnapshot,
    simulation: { runs: 4000, contendersShown: 3 },
  };
})();
