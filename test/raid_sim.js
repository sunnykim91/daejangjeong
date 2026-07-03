// Phase1 야습 루프 헤드리스 검증: 밤/낮 · 피로도/숙영 · 야습→혼란→와해 · 회귀(기존 전투 종료).
const RTS = require('../src/rts.js');
const ROSTER = require('../src/data.js');

let fails = 0;
function ok(cond, msg) { console.log((cond ? '  ✅ ' : '  ❌ ') + msg); if (!cond) fails++; }

function build(o) {
  o = o || {};
  return RTS.createWorld({
    W: 900, H: 600, dayLen: o.dayLen || 100, nightFrac: o.nightFrac != null ? o.nightFrac : 0.5, startClock: o.startClock || 0, autoDuel: true,
    castles: [{ id: 'p', name: '위례', x: 200, y: 300, owner: 'player' }, { id: 'e', name: '평양', x: 700, y: 300, owner: 'enemy' }],
    armies: [{ gen: ROSTER.player[0], team: 'player', castle: 'p', dots: 16, form: '방진' },
             { gen: ROSTER.enemy[0], team: 'enemy', castle: 'e', dots: 16, form: '방진' }],
  });
}
const idOf = (w, team) => w.armies.find((a) => a.team === team).id;

// ── 1. 밤/낮 시계 순환 ──
console.log('\n[1] 밤/낮 시계');
{
  const w = build({ dayLen: 100, nightFrac: 0.5, startClock: 0 });
  let sawDay = false, sawNight = false;
  for (let i = 0; i < 2200; i++) { RTS.step(w, 0.05); if (w.night) sawNight = true; else sawDay = true; }  // ~110초
  ok(sawDay && sawNight, `낮·밤 모두 관측됨 (tod 순환)`);
}

// ── 2. 숙영 → 피로 회복 → 공격력 상승 ──
console.log('\n[2] 숙영/피로도');
{
  const w = build({ startClock: 60 });          // tod 0.6 → 밤
  const eId = idOf(w, 'enemy'), e = RTS.armyOf(w, eId);
  e.fatigue = 60; RTS.setCamp(w, eId, true);
  ok(w.night, '시작 시 밤(startClock=60)');
  const atk0 = RTS.fatigueAtk(60);
  for (let i = 0; i < 120; i++) RTS.step(w, 0.05);   // 6초 숙영
  ok(e.fatigue < 60, `피로도 회복 60 → ${e.fatigue.toFixed(1)}`);
  ok(e._atkMul > atk0, `공격 배수 상승 ${atk0.toFixed(3)} → ${e._atkMul.toFixed(3)}`);
  ok(!e.aware, '야간 숙영 = 방심(aware=false, 야습 취약)');
}

// ── 3. 야습 성공 → 혼란 ──
console.log('\n[3] 야습 → 혼란');
{
  const w = build({ startClock: 60 });
  const pId = idOf(w, 'player'), eId = idOf(w, 'enemy'), e = RTS.armyOf(w, eId);
  RTS.setCamp(w, eId, true);
  const pc = RTS.raidChance(w, RTS.armyOf(w, pId), e);
  ok(pc >= 0.05 && pc <= 0.95, `야습 확률 범위 정상 (${(pc * 100).toFixed(0)}%)`);
  const before = e.morale;
  const hit = RTS.tryRaid(w, pId, eId, () => 0);        // rng=0 → 성공 확정
  ok(hit && e.confused, '기습 성공 → 대상 혼란 상태');
  ok(e.morale < before, `사기 충격 ${before} → ${e.morale}`);
}

// ── 4. 혼란 지속 → 와해(붕괴) ──
console.log('\n[4] 혼란 → 와해');
{
  const w = build({ startClock: 60 });
  const eId = idOf(w, 'enemy'), e = RTS.armyOf(w, eId);
  e.confused = true; e.confuseT = RTS.CONFUSE_DUR; e.morale = 10;
  for (let i = 0; i < 60 && !e.collapsed; i++) RTS.step(w, 0.05);   // 최대 3초
  ok(e.collapsed && e._disband, '혼란 중 사기 붕괴 → 와해(해산)');
}

// ── 5. 자동 야습 감지(활동 부대가 숙영 적에 접근) ──
console.log('\n[5] 자동 야습 감지');
{
  const w = build({ startClock: 60 });
  const pId = idOf(w, 'player'), eId = idOf(w, 'enemy');
  const p = RTS.armyOf(w, pId), e = RTS.armyOf(w, eId);
  p.order.x = 450; p.order.y = 300; e.order.x = 500; e.order.y = 300;  // RAID_R(130) 내
  RTS.setCamp(w, eId, true);
  let fired = false;
  for (let i = 0; i < 20 && !fired; i++) { RTS.step(w, 0.05, () => 0); if (e.confused) fired = true; }
  ok(fired, '접근 시 자동 야습 발동 → 적 혼란');
}

// ── 6. 회귀: 기존 주간 전투가 정상 종료 ──
console.log('\n[6] 회귀(전투 종료)');
{
  const w = build({ startClock: 0 });                  // 낮 시작
  const pId = idOf(w, 'player'), eId = idOf(w, 'enemy');
  RTS.moveArmy(w, pId, 700, 300); RTS.moveArmy(w, eId, 200, 300);   // 서로 진격
  let s = 0; let bad = false;
  while (!w.winner && s < 6000) {                       // 최대 300초
    RTS.step(w, 0.05); s++;
    if (s % 500 === 0) { const a = w.soldiers[0]; if (a && (!isFinite(a.x) || !isFinite(a.y))) bad = true; }
  }
  ok(!bad, '좌표 NaN 없음(시뮬 안정)');
  ok(w.winner === 'player' || w.winner === 'enemy', `전투 종료: 승자 ${w.winner} (${(s * 0.05).toFixed(0)}초)`);
}

console.log('\n' + (fails === 0 ? '🎉 전체 통과' : `⚠️ ${fails}개 실패`));
process.exit(fails === 0 ? 0 : 1);
