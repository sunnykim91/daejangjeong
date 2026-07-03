// 영지전 파라미터 튜닝: 빠른 수렴 + 합리적 승률 조합 탐색
const E = require('../src/engine.js');
const ROSTER = require('../src/data.js');

function runCampaign(seed, P) {
  const map = [
    { id:'wirye', owner:'player', minsim:60, adj:['ungjin','hanseong'] },
    { id:'ungjin', owner:'player', minsim:60, adj:['wirye','hanseong'] },
    { id:'hanseong', owner:'player', minsim:60, adj:['wirye','ungjin','jolbon','gungnae'] },
    { id:'jolbon', owner:'enemy', minsim:60, adj:['hanseong','pyongyang','gungnae'] },
    { id:'gungnae', owner:'enemy', minsim:60, adj:['hanseong','jolbon','pyongyang'] },
    { id:'pyongyang', owner:'enemy', minsim:60, adj:['jolbon','gungnae'] },
  ];
  const T = (id) => map.find((t) => t.id === id);
  const owned = (s) => map.filter((t) => t.owner === s);
  let tick = 0, round = 0;
  const defMorale = (m) => Math.round(P.dBase + m * P.dScale);

  function fight(attacker, terr) {
    const b = E.createBattle(ROSTER, { seed: seed * 1000 + (tick++) });
    const atk = attacker === 'player' ? 'player' : 'enemy';
    const def = atk === 'player' ? 'enemy' : 'player';
    b.morale[def] = defMorale(terr.minsim);
    b.morale[atk] = 50;
    const r = E.runBattle(b);
    const won = r.winner === atk;
    if (won) {
      terr.minsim -= P.drop[r.grade];
      if (terr.minsim <= 0) { terr.owner = attacker; terr.minsim = P.reset; }
    } else terr.minsim = Math.min(P.cap, terr.minsim + P.regain);
    return won;
  }
  function pick(attacker) {
    const def = attacker === 'player' ? 'enemy' : 'player';
    const set = new Set();
    for (const t of owned(attacker)) for (const a of t.adj) if (T(a).owner === def) set.add(a);
    const list = [...set].map(T);
    return list.length ? list.sort((a, b) => a.minsim - b.minsim)[0] : null;
  }
  while (round < 200) {
    round++;
    const pt = pick('player'); if (pt) fight('player', pt);
    if (owned('enemy').length === 0) return { w:'p', round };
    const et = pick('enemy'); if (et) fight('enemy', et);
    if (owned('player').length === 0) return { w:'e', round };
    if (!pt && !et) return { w:'s', round };
  }
  return { w:'t', round };
}

const variants = [
  { name:'K 강결합',      dBase:20, dScale:0.6, regain:3, cap:85, reset:65, drop:{대승:50,승:34,신승:20} },
  { name:'L 강결합·중감소', dBase:20, dScale:0.6, regain:2, cap:85, reset:68, drop:{대승:55,승:38,신승:23} },
  { name:'M 강결합·고리셋', dBase:18, dScale:0.65,regain:3, cap:88, reset:72, drop:{대승:55,승:38,신승:23} },
  { name:'N 강결합·완만',  dBase:22, dScale:0.55,regain:4, cap:85, reset:68, drop:{대승:52,승:36,신승:22} },
];

const N = 400;
for (const P of variants) {
  let p=0,e=0,o=0,rounds=0;
  for (let s=1;s<=N;s++){ const r=runCampaign(s,P); if(r.w==='p')p++; else if(r.w==='e')e++; else o++; rounds+=r.round; }
  console.log(`${P.name.padEnd(14)} 아군 ${String(p).padStart(3)} / 적군 ${String(e).padStart(3)} / 기타 ${o} | 평균 ${(rounds/N).toFixed(1)}R | 아군승률 ${(p/N*100).toFixed(0)}%`);
}
