// Phase2b 장수 풀 + 가챠 헤드리스 검증: 풀 무결성, 확률 분포, 등용서 등급 효과.
const CARDS = require('../src/cards.js');
const GACHA = require('../src/gacha.js');

let fails = 0;
function ok(cond, msg) { console.log((cond ? '  ✅ ' : '  ❌ ') + msg); if (!cond) fails++; }

// 시드 rng(재현 가능)
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

console.log('\n[1] 장수 풀 무결성');
{
  ok(CARDS.POOL.length >= 40, `장수 ${CARDS.POOL.length}명 (7진영)`);
  let allF = true; for (const f of CARDS.FACTIONS) if (CARDS.byFaction(f).length < 4) allF = false;
  ok(allF, '진영별 4명 이상 (위/촉/오/고구려/백제/신라/일본)');
  let statsOk = true, idset = new Set();
  for (const g of CARDS.POOL) {
    for (const k of ['might', 'command', 'intellect', 'agility']) if (g[k] < 1 || g[k] > 100) statsOk = false;
    if (g.rarity < 3 || g.rarity > 6) statsOk = false;
    if (idset.has(g.id)) statsOk = false; idset.add(g.id);
  }
  ok(statsOk, '스탯 1~100 · rarity 3~6 · id 중복 없음');
  ok(CARDS.POOL.some((g) => g.rarity === 6), `신화(6★) 존재: ${CARDS.POOL.filter(g => g.rarity === 6).map(g => g.name).join(', ')}`);
}

console.log('\n[2] 가챠 확률 분포 (노말 등용서 5000회)');
{
  const rng = mulberry32(12345), N = 5000, cnt = { 3: 0, 4: 0, 5: 0, 6: 0 };
  for (let i = 0; i < N; i++) cnt[GACHA.rollGeneral('노말', rng).rarity]++;
  const pct = (r) => (cnt[r] / N * 100).toFixed(1);
  console.log(`     노말 ${pct(3)}% / 레어 ${pct(4)}% / 전설 ${pct(5)}% / 신화 ${pct(6)}% (기대 78/19/2.7/0.3)`);
  ok(cnt[3] > cnt[4] && cnt[4] > cnt[5], '노말 > 레어 > 전설 순 빈도');
  ok(Math.abs(cnt[3] / N * 100 - 78) < 5, '노말 비율 ≈78% (오차 5%)');
}

console.log('\n[3] 등용서 등급이 높을수록 고등급 장수↑');
{
  const N = 5000;
  const hi = (grade) => { const rng = mulberry32(999); let h = 0; for (let i = 0; i < N; i++) { const r = GACHA.rollGeneral(grade, rng).rarity; if (r >= 5) h++; } return h / N; };
  const n = hi('노말'), l = hi('전설'), m = hi('신화');
  console.log(`     전설+ 비율 — 노말등용서 ${(n * 100).toFixed(1)}% < 전설등용서 ${(l * 100).toFixed(1)}% < 신화등용서 ${(m * 100).toFixed(1)}%`);
  ok(n < l && l < m, '상위 등용서일수록 전설↑ 장수 확률 증가');
}

console.log('\n[4] 시드 재현성');
{
  const a = mulberry32(7), b = mulberry32(7);
  let same = true; for (let i = 0; i < 100; i++) if (GACHA.rollGeneral('전설', a).id !== GACHA.rollGeneral('전설', b).id) same = false;
  ok(same, '같은 시드 → 같은 결과(테스트 재현 가능)');
}

console.log('\n' + (fails === 0 ? '🎉 전체 통과' : `⚠️ ${fails}개 실패`));
process.exit(fails === 0 ? 0 : 1);
