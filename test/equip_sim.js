// Phase2a 장비 6슬롯 + 세트효과 헤드리스 검증.
const RTS = require('../src/rts.js');
const ROSTER = require('../src/data.js');

let fails = 0;
function ok(cond, msg) { console.log((cond ? '  ✅ ' : '  ❌ ') + msg); if (!cond) fails++; }
const gen = (t, i) => ROSTER[t][i];

console.log('\n[1] 6슬롯 장착');
{
  const g = gen('player', 0);
  ok(Object.keys(g.equip).length === 6, `장수 장비 슬롯 6개 (${Object.keys(g.equip).join(',')})`);
  ok(g.equip.shield && g.equip.helmet, '방패·투구 슬롯 존재');
}

console.log('\n[2] 세트 집계 + 보너스');
{
  const dochim = gen('player', 2);      // 책사 4세트
  const s = (dochim._sets || []).find(x => x.key === '책사');
  ok(s && s.tier === 4, `도침 = 책사 4세트 (tier ${s ? s.tier : '-'})`);
  ok(dochim._setFx && Math.abs(dochim._setFx.raid - 0.15) < 1e-6, `책사4 → _setFx.raid=0.15 (${dochim._setFx.raid})`);
  ok(dochim.intellect > dochim._base.intellect, `지력 세트보너스 반영 ${dochim._base.intellect}→${dochim.intellect}`);

  const gwang = gen('enemy', 0);        // 맹장4 + 군주2
  const m = (gwang._sets || []).find(x => x.key === '맹장');
  ok(m && m.tier === 4 && Math.abs(gwang._setFx.duel - 0.18) < 1e-6, `광개토 맹장4 → _setFx.duel=0.18`);
  ok((gwang._sets || []).some(x => x.key === '군주' && x.tier === 2), '광개토 군주 2세트 동시 활성');

  const gyebaek = gen('player', 1);     // 수비4
  ok((gyebaek._sets || []).some(x => x.key === '수비' && x.tier === 4), '계백 수비 4세트');
}

console.log('\n[3] 세트효과 → 야습 확률 반영(rts 연동)');
{
  const w = { night: false, terrain: [] };
  const atk = { gen: gen('player', 2) };                              // 도침(책사4, raid+0.15)
  const def = { gen: gen('enemy', 3), order: { x: 100, y: 100 }, aware: true };
  const p1 = RTS.raidChance(w, atk, def);
  const saved = atk.gen._setFx.raid; atk.gen._setFx.raid = 0;
  const p2 = RTS.raidChance(w, atk, def);
  atk.gen._setFx.raid = saved;
  ok(Math.abs((p1 - p2) - 0.15) < 0.02, `책사 세트가 야습 확률 +0.15 (${(p1 * 100).toFixed(0)}% vs ${(p2 * 100).toFixed(0)}%)`);
}

console.log('\n[4] 회귀: 장비 반영 후 전투 정상 종료');
{
  const w = RTS.createWorld({
    W: 900, H: 600, dayLen: 120, startClock: 0, autoDuel: true,
    castles: [{ id: 'p', name: 'P', x: 200, y: 300, owner: 'player' }, { id: 'e', name: 'E', x: 700, y: 300, owner: 'enemy' }],
    armies: [{ gen: gen('player', 0), team: 'player', castle: 'p', dots: 16 }, { gen: gen('enemy', 0), team: 'enemy', castle: 'e', dots: 16 }],
  });
  RTS.moveArmy(w, 0, 700, 300); RTS.moveArmy(w, 1, 200, 300);
  let s = 0; while (!w.winner && s < 6000) { RTS.step(w, 0.05); s++; }
  ok(w.winner === 'player' || w.winner === 'enemy', `전투 종료: 승자 ${w.winner} (${(s * 0.05).toFixed(0)}초)`);
}

console.log('\n' + (fails === 0 ? '🎉 전체 통과' : `⚠️ ${fails}개 실패`));
process.exit(fails === 0 ? 0 : 1);
