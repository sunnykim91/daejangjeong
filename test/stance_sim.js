// Phase4 부대 방침(Stance) 헤드리스 검증.
const RTS = require('../src/rts.js');
const ROSTER = require('../src/data.js');

let fails = 0;
function ok(cond, msg) { console.log((cond ? '  ✅ ' : '  ❌ ') + msg); if (!cond) fails++; }

function build(o) {
  o = o || {};
  const w = RTS.createWorld({
    W: 1000, H: 700, autoDuel: true, dayLen: 100, nightFrac: 0.5, startClock: o.startClock || 0,
    castles: [{ id: 'p', name: 'P', x: 150, y: 350, owner: 'player' }, { id: 'e', name: 'E', x: 850, y: 350, owner: 'enemy' }],
    armies: [{ gen: ROSTER.player[0], team: 'player', castle: 'p', dots: 12 }],
  });
  const a = w.armies[0];                       // 성 밖 야전으로 이동(즉시 재입성 방지)
  for (const m of a.members) { m.x = 500; m.y = 350; }
  a.order.x = 500; a.order.y = 350;
  return w;
}
const A = (w) => w.armies[0];

console.log('\n[1] 방침 목록·기본값');
ok(RTS.STANCES.length === 10, `방침 10종 (${RTS.STANCES.join('/')})`);
ok(A(build()).stance === '진군', '기본 방침 = 진군');

console.log('\n[2] 후퇴 → 이동목표가 아군 성으로');
{
  const w = build(); const a = A(w);
  RTS.moveArmy(w, a.id, 900, 350);            // 적진으로 명령
  RTS.setStance(w, a.id, '후퇴');
  RTS.step(w, 0.05);                          // applyStance가 order 재설정
  const pc = w.castles.find((c) => c.owner === 'player');
  ok(Math.abs(a.order.x - pc.x) < 1 && Math.abs(a.order.y - pc.y) < 1, `후퇴 → order가 아군 성(${pc.x},${pc.y})으로`);
  ok(a._noEngage === true, '후퇴 = 교전 회피');
}

console.log('\n[3] 대기/방어 → 제자리 정지(_hold)');
{
  const w = build(); const a = A(w); RTS.setStance(w, a.id, '대기'); RTS.step(w, 0.05);
  ok(a._hold === true, '대기 = _hold(행군 정지)');
  RTS.setStance(w, a.id, '방어'); RTS.step(w, 0.05); ok(a._hold === true, '방어 = _hold');
}

console.log('\n[4] 정찰/선발 → 이동 배수·교전 회피');
{
  const w = build(); const a = A(w); RTS.setStance(w, a.id, '정찰'); RTS.step(w, 0.05);
  ok(a._noEngage === true && a._stanceSpd > 1, '정찰 = 비교전 + 기민(속도↑)');
  RTS.setStance(w, a.id, '선발'); RTS.step(w, 0.05); ok(a._stanceSpd >= 1.25, '선발 = 행군 속도↑');
}

console.log('\n[5] 매복 → 엄폐 지형에서만 은폐(camp)');
{
  const w = RTS.createWorld({
    W: 1000, H: 700, autoDuel: true,
    terrain: [{ type: '숲', shape: 'circle', x: 300, y: 350, r: 120 }],
    castles: [{ id: 'p', name: 'P', x: 150, y: 350, owner: 'player' }, { id: 'e', name: 'E', x: 850, y: 350, owner: 'enemy' }],
    armies: [{ gen: ROSTER.player[0], team: 'player', castle: 'p', dots: 12 }],
  });
  const a = A(w); RTS.setStance(w, a.id, '매복');
  for (const m of a.members) { m.x = 600; m.y = 350; } a.order.x = 600; a.order.y = 350;   // 평지(숲 밖·성 밖)
  RTS.step(w, 0.05); const plainCamp = a.camp;
  for (const m of a.members) { m.x = 300; m.y = 350; }                                       // 숲 안으로
  RTS.step(w, 0.05); const forestCamp = a.camp;
  ok(!plainCamp && forestCamp, `매복 = 숲/산에서만 은폐 (평지 ${plainCamp} → 숲 ${forestCamp})`);
}

console.log('\n[6] 회귀: 방침 도입 후 전투 종료');
{
  const w = RTS.createWorld({
    W: 900, H: 600, autoDuel: true,
    castles: [{ id: 'p', name: 'P', x: 200, y: 300, owner: 'player' }, { id: 'e', name: 'E', x: 700, y: 300, owner: 'enemy' }],
    armies: [{ gen: ROSTER.player[0], team: 'player', castle: 'p', dots: 14 }, { gen: ROSTER.enemy[0], team: 'enemy', castle: 'e', dots: 14 }],
  });
  RTS.moveArmy(w, 0, 700, 300); RTS.moveArmy(w, 1, 200, 300);
  let s = 0; while (!w.winner && s < 6000) { RTS.step(w, 0.05); s++; }
  ok(w.winner === 'player' || w.winner === 'enemy', `전투 종료: 승자 ${w.winner}`);
}

console.log('\n' + (fails === 0 ? '🎉 전체 통과' : `⚠️ ${fails}개 실패`));
process.exit(fails === 0 ? 0 : 1);
