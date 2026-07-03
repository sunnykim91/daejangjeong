// 등용서 가챠 로직 (순수 함수, Node 검증 가능). 확률표는 ⚠️ 임시값 — 기획자 확정 대기.
(function () {
  const CARDS = (typeof require !== 'undefined') ? require('./cards.js') : window.CARDS;

  const SCROLLS = ['노말', '레어', '전설', '신화'];       // 등용서 등급(높을수록 좋은 장수)
  const RARITY_NAME = { 3: '노말', 4: '레어', 5: '전설', 6: '신화' };  // 장수 등급(★)
  const RARITY_COLOR = { 3: '#9aa0aa', 4: '#5a9fd0', 5: '#c79a3a', 6: '#c0503a' };
  // 등용서 등급 → 장수 등급 확률(%) [rarity 3=노말,4=레어,5=전설,6=신화]. ⚠️ 임시값.
  // 기획: 천장(확정지급) 없음. 신화(광개토·관우 등)는 극악 확률 — 무과금 1~2년에 한둘 목표.
  const NO_PITY = true;               // 천장 없음(확정 지급 안 함)
  const RATES = {
    노말: [80, 18.5, 1.4, 0.1],       // 신화 0.1% (신화 다수 → 특정 1명은 ~0.02%)
    레어: [60, 33, 6.3, 0.7],
    전설: [33, 45, 19, 3],
    신화: [10, 45, 35, 10],
  };

  function pickRarity(grade, rng) {
    const w = RATES[grade] || RATES['노말'], r = (rng || Math.random)() * 100;
    let acc = 0; for (let i = 0; i < w.length; i++) { acc += w[i]; if (r < acc) return i + 3; }
    return 3;
  }
  // 등용서 1장으로 장수 1명 뽑기. 해당 등급 장수 없으면 인접 등급으로 폴백.
  function rollGeneral(grade, rng) {
    rng = rng || Math.random;
    const pool = CARDS.POOL, rar = pickRarity(grade, rng);
    let cand = pool.filter((g) => g.rarity === rar);
    for (let d = 1; d < 4 && !cand.length; d++) {
      cand = pool.filter((g) => g.rarity === rar - d);
      if (!cand.length) cand = pool.filter((g) => g.rarity === rar + d);
    }
    if (!cand.length) cand = pool;
    return cand[(rng() * cand.length) | 0];
  }

  const GACHA = { SCROLLS, RATES, RARITY_NAME, RARITY_COLOR, NO_PITY, pickRarity, rollGeneral };
  if (typeof module !== 'undefined' && module.exports) module.exports = GACHA;
  if (typeof window !== 'undefined') window.GACHA = GACHA;
})();
