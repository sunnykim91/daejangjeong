// Phase3 턴제 일기토 헤드리스 검증: engine 1:1 종료 + 결과의 전쟁 반영(applyDuelResult).
const Engine = require('../src/engine.js');
const RTS = require('../src/rts.js');
const ROSTER = require('../src/data.js');

let fails = 0;
function ok(cond, msg) { console.log((cond ? '  ✅ ' : '  ❌ ') + msg); if (!cond) fails++; }

console.log('\n[1] 턴제 1:1 일기토 종료(engine)');
{
  let allEnd = true, sample = null;
  for (let s = 1; s <= 50; s++) {
    const b = Engine.createBattle({ player: [ROSTER.player[0]], enemy: [ROSTER.enemy[0]] }, { seed: s * 7 });
    const r = Engine.runBattle(b);
    if (!r || (r.winner !== 'player' && r.winner !== 'enemy')) allEnd = false;
    if (s === 1) sample = r;
  }
  ok(allEnd, '50회 전부 승자 결정(무한루프/미종료 없음)');
  ok(sample.grade && sample.rounds > 0, `결과 구조 정상 (예: ${sample.winner} ${sample.grade} ${sample.rounds}합)`);
}

function buildWorld() {
  return RTS.createWorld({
    W: 900, H: 600,
    castles: [{ id: 'p', name: 'P', x: 200, y: 300, owner: 'player' }, { id: 'e', name: 'E', x: 700, y: 300, owner: 'enemy' }],
    armies: [{ gen: ROSTER.player[0], team: 'player', castle: 'p', dots: 12 }, { gen: ROSTER.enemy[0], team: 'enemy', castle: 'e', dots: 12 }],
  });
}
const genSol = (w, team) => w.soldiers.find((s) => s.gen && s.team === team);

console.log('\n[2] 결과 반영 — 적장 격파(전사) → 부대 와해');
{
  const w = buildWorld(); const win = genSol(w, 'player'), lose = genSol(w, 'enemy');
  const wArmy = RTS.armyOf(w, win.army), lArmy = RTS.armyOf(w, lose.army);
  const m0 = wArmy.morale;
  RTS.applyDuelResult(w, win, lose, true);
  ok(lArmy._disband === true, '패장 부대 해산(_disband) = 와해');
  ok(!lose.alive || lose.gone, '패장 전사 또는 도망');
  ok(wArmy.morale >= m0, `승자 부대 사기 상승 ${m0}→${wArmy.morale}`);
  ok(w.duelRequest === null, 'duelRequest 해제(전쟁 재개)');
}

console.log('\n[3] 결과 반영 — 적장 생존(판정패) → 사기 급락·혼란(후퇴)');
{
  const w = buildWorld(); const win = genSol(w, 'player'), lose = genSol(w, 'enemy');
  const lArmy = RTS.armyOf(w, lose.army); const m0 = lArmy.morale;
  RTS.applyDuelResult(w, win, lose, false);
  ok(lArmy.morale < m0, `패자(생존) 부대 사기 급락 ${m0}→${lArmy.morale}`);
  ok(lArmy.confused === true, '패자 부대 혼란(돌파당함)');
}

console.log('\n' + (fails === 0 ? '🎉 전체 통과' : `⚠️ ${fails}개 실패`));
process.exit(fails === 0 ? 0 : 1);
