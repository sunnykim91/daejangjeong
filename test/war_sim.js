// 실전 전투 시뮬(warsim) 헤드리스 검증: 모든 전투가 종료되는지 + 균형 확인.
const WarSim = require('../src/warsim.js');
const ROSTER = require('../src/data.js');

function run(squadN) {
  const war = WarSim.createWar({ rosterP: ROSTER.player, rosterE: ROSTER.enemy, fieldW: 900, fieldH: 600, squadN });
  let steps = 0;
  while (!war.finished && steps < 20000) { WarSim.stepWar(war, 1 / 30); steps++; }
  return war.result || { winner: 'HUNG', time: -1 };
}

let p = 0, e = 0, hung = 0, t = 0, N = 40;
for (let i = 0; i < N; i++) {
  const r = run(20);
  if (r.winner === 'player') p++; else if (r.winner === 'enemy') e++; else hung++;
  t += r.time;
}
console.log(`실전 전투 ${N}회: 아군 ${p} / 적군 ${e} / 미종료 ${hung}, 평균 ${(t / N).toFixed(1)}초`);

// 단일 전투 상세
const war = WarSim.createWar({ rosterP: ROSTER.player, rosterE: ROSTER.enemy, fieldW: 900, fieldH: 600, squadN: 20 });
console.log(`초기 병력: 아군 ${WarSim.alive(war,'player').length} vs 적군 ${WarSim.alive(war,'enemy').length}`);
let s = 0; while (!war.finished && s < 20000) { WarSim.stepWar(war, 1/30); s++; }
console.log('결과:', JSON.stringify(war.result));
console.log(hung === 0 ? '🎉 모든 전투 정상 종료' : '⚠️ 미종료 발생');
process.exit(hung === 0 ? 0 : 1);
