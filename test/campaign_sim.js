// 영지전(CAMPAIGN.md) 로직 헤드리스 검증.
// 양측 다 AI 자동 출정으로 캠페인을 끝까지 돌려 수렴(승부 결정)·규칙을 확인.
const E = require('../src/engine.js');
const ROSTER = require('../src/data.js');

// 실제 캠페인(campaign.html)과 동일한 밸런스 파라미터
const GRADE_DROP = { '대승': 55, '승': 38, '신승': 23 };
const DEFENSE_REGAIN = 2, REGAIN_CAP = 85, CAPTURE_RESET = 68;
const defMorale = (m) => Math.round(20 + m * 0.6);

function freshMap() {
  return [
    { id:'wirye', owner:'player', minsim:60, adj:['ungjin','hanseong'] },
    { id:'ungjin', owner:'player', minsim:60, adj:['wirye','hanseong'] },
    { id:'hanseong', owner:'player', minsim:60, adj:['wirye','ungjin','jolbon','gungnae'] },
    { id:'jolbon', owner:'enemy', minsim:60, adj:['hanseong','pyongyang','gungnae'] },
    { id:'gungnae', owner:'enemy', minsim:60, adj:['hanseong','jolbon','pyongyang'] },
    { id:'pyongyang', owner:'enemy', minsim:60, adj:['jolbon','gungnae'] },
  ];
}

function runCampaign(seed) {
  const map = freshMap();
  const T = (id) => map.find((t) => t.id === id);
  const owned = (s) => map.filter((t) => t.owner === s);
  let tick = 0, round = 0;

  function fight(attacker, terr) {
    const b = E.createBattle(ROSTER, { seed: seed * 1000 + (tick++) });
    const atkTeam = attacker === 'player' ? 'player' : 'enemy';
    const defTeam = atkTeam === 'player' ? 'enemy' : 'player';
    b.morale[defTeam] = defMorale(terr.minsim);
    b.morale[atkTeam] = 50;
    const r = E.runBattle(b);
    const won = r.winner === atkTeam;
    if (won) {
      terr.minsim -= GRADE_DROP[r.grade] || 30;
      if (terr.minsim <= 0) { terr.owner = attacker; terr.minsim = CAPTURE_RESET; }
    } else {
      terr.minsim = Math.min(REGAIN_CAP, terr.minsim + DEFENSE_REGAIN);
    }
    return won;
  }

  function pickTarget(attacker) {
    const defender = attacker === 'player' ? 'enemy' : 'player';
    const set = new Set();
    for (const t of owned(attacker)) for (const a of t.adj) if (T(a).owner === defender) set.add(a);
    const list = [...set].map(T);
    return list.length ? list.sort((a, b) => a.minsim - b.minsim)[0] : null;
  }

  while (round < 300) {
    round++;
    const pt = pickTarget('player'); if (pt) fight('player', pt);
    if (owned('enemy').length === 0) return { winner: 'player', round };
    const et = pickTarget('enemy'); if (et) fight('enemy', et);
    if (owned('player').length === 0) return { winner: 'enemy', round };
    if (!pt && !et) return { winner: 'stalemate', round };  // 전선 소멸(불가능에 가까움)
  }
  return { winner: 'timeout', round };
}

let pWin = 0, eWin = 0, other = 0, rounds = 0, N = 300;
for (let s = 1; s <= N; s++) {
  const r = runCampaign(s);
  if (r.winner === 'player') pWin++;
  else if (r.winner === 'enemy') eWin++;
  else { other++; console.log('  비정상 종료:', r); }
  rounds += r.round;
}
console.log(`영지전 ${N}회: 아군 ${pWin}승 / 적군 ${eWin}승 / 기타 ${other}, 평균 ${(rounds/N).toFixed(1)}라운드`);
console.log(other === 0 ? '🎉 모든 캠페인이 정상 승부로 종료' : '⚠️ 비정상 종료 발생');
process.exit(other === 0 ? 0 : 1);
