// 11장 계산 검증 + 풀 시뮬레이션 sanity check
const E = require('../src/engine.js');
const ROSTER = require('../src/data.js');

let pass = 0, fail = 0;
function check(label, got, want, tol = 1) {
  const ok = Math.abs(got - want) <= tol;
  console.log(`${ok ? '✅' : '❌'} ${label}: got ${got}, want ~${want}`);
  ok ? pass++ : fail++;
}

const geunchogo = ROSTER.player[0];   // 기병 무력92
const eulji = ROSTER.enemy[1];        // 궁병 통솔70 지력95
const mockji = ROSTER.enemy[3];       // 창병 통솔74

// 예시 A — 상성 유리 (기병→궁병 1.3), 사기50, 변량1
const dmgA = E.rawDamage({
  might: geunchogo.might, typeMult: E.typeMult('기병', '궁병'),
  moraleMult: E.moraleMult(50), variance: 1, targetCommand: eulji.command,
});
check('예시A 데미지', Math.floor(dmgA), 351);
check('예시A 을지문덕 maxHp', E.maxHpOf(eulji), 1012);

// 예시 B — 상성 불리 (기병→창병 0.8)
const dmgB = E.rawDamage({
  might: geunchogo.might, typeMult: E.typeMult('기병', '창병'),
  moraleMult: E.moraleMult(50), variance: 1, targetCommand: mockji.command,
});
check('예시B 데미지', Math.round(dmgB), 212);
check('예시B 막리지 maxHp', E.maxHpOf(mockji), 1370);

// 예시 C — 붕괴 위력: 사기0(×0.8) + 위축(×0.8) = 평소의 64%
const base = E.rawDamage({ might: 95, typeMult: 1, moraleMult: E.moraleMult(50), variance: 1, targetCommand: 70 });
const routed = E.rawDamage({ might: 95, typeMult: 1, moraleMult: E.moraleMult(0), variance: 1, targetCommand: 70, weakened: true });
check('예시C 붕괴 위력 비율(%)', Math.round((routed / base) * 100), 64);

console.log('\n── 풀 시뮬레이션 (시드 여러 개) ──');
let pWin = 0, eWin = 0, rounds = 0, N = 200;
for (let seed = 1; seed <= N; seed++) {
  const battle = E.createBattle(ROSTER, { seed });
  const r = E.runBattle(battle);
  if (r.winner === 'player') pWin++; else eWin++;
  rounds += r.rounds;
}
console.log(`${N}판: 아군 ${pWin}승 / 적군 ${eWin}승, 평균 ${(rounds / N).toFixed(1)}라운드`);

// 한 판 상세 로그 미리보기
console.log('\n── 시드 7 전투 로그 (앞부분) ──');
const demo = E.createBattle(ROSTER, { seed: 7 });
E.runBattle(demo);
demo.log.slice(0, 18).forEach((l) => console.log(`  [R${l.round}] ${l.msg}`));
console.log('  ...');
console.log('  결과:', JSON.stringify(demo.result, null, 0));

console.log(`\n${fail === 0 ? '🎉 전부 통과' : '⚠️ 실패 있음'} (${pass} pass / ${fail} fail)`);
process.exit(fail === 0 ? 0 : 1);
