// 등용서 가챠 로직 (순수 함수, Node 검증 가능). 확률표는 ⚠️ 임시값 — 기획자 확정 대기.
(function () {
  const CARDS = (typeof require !== 'undefined') ? require('./cards.js') : window.CARDS;

  const SCROLLS = ['노말', '레어', '전설', '신화'];       // 등용서 등급(높을수록 좋은 장수)
  const RARITY_NAME = { 3: '노말', 4: '레어', 5: '전설', 6: '신화' };  // 장수 등급(★)
  const RARITY_COLOR = { 3: '#9aa0aa', 4: '#5a9fd0', 5: '#c79a3a', 6: '#c0503a' };
  // 등용서 등급 → 장수 등급 확률(%) [rarity 3,4,5,6]. ⚠️ 밸런스 임시값.
  const RATES = {
    노말: [78, 19, 2.7, 0.3],
    레어: [55, 35, 8.5, 1.5],
    전설: [25, 45, 25, 5],
    신화: [0, 40, 45, 15],
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

  const GACHA = { SCROLLS, RATES, RARITY_NAME, RARITY_COLOR, pickRarity, rollGeneral };
  if (typeof module !== 'undefined' && module.exports) module.exports = GACHA;
  if (typeof window !== 'undefined') window.GACHA = GACHA;
})();
