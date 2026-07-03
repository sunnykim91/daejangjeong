// 메타 진행 저장 (localStorage). Track A 목업 — 서버판에선 계정/서버로 교체.
// 에너지(행동력): 출정에 소모, 시간당 자동 충전. 등용서: 가챠 재화. 보유 장수: 수집.
(function () {
  const MAX = 20, REGEN = 300000;               // 에너지 최대 20, 5분당 +1 (⚠️ 임시값)
  const K = { en: 'dj_energy', sc: 'dj_scrolls', ow: 'dj_owned' };
  const DEF_SC = { 노말: 10, 레어: 3, 전설: 1, 신화: 0 };   // 시작 등용서(테스트용)
  const DEF_OW = ['geunchogo', 'gyebaek', 'heukchi', 'dochim'];   // 시작 보유(백제)
  const now = () => Date.now();
  function load(k, def) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function energy() {
    let e = load(K.en, null); const t = now(); if (!e) e = { v: MAX, t };
    if (e.v < MAX) { const g = Math.floor((t - e.t) / REGEN); if (g > 0) { e.v = Math.min(MAX, e.v + g); e.t += g * REGEN; } if (e.v >= MAX) e.t = t; }
    else e.t = t;
    save(K.en, e);
    return { v: e.v, max: MAX, nextMs: e.v >= MAX ? 0 : REGEN - (t - e.t) };
  }
  function spendEnergy(n) { n = n || 1; energy(); const e = load(K.en, { v: MAX, t: now() }); if (e.v < n) return false; e.v -= n; save(K.en, e); return true; }
  function addEnergy(n) { const e = load(K.en, { v: MAX, t: now() }); e.v = Math.min(MAX, e.v + n); save(K.en, e); }

  function scrolls() { return load(K.sc, Object.assign({}, DEF_SC)); }
  function useScroll(g) { const s = scrolls(); if ((s[g] || 0) < 1) return false; s[g]--; save(K.sc, s); return true; }
  function addScroll(g, n) { const s = scrolls(); s[g] = (s[g] || 0) + (n || 1); save(K.sc, s); }

  function owned() { return load(K.ow, DEF_OW.slice()); }
  function addOwned(id) { const o = owned(); const isNew = !o.includes(id); if (isNew) { o.push(id); save(K.ow, o); } return isNew; }

  function reset() { save(K.en, { v: MAX, t: now() }); save(K.sc, Object.assign({}, DEF_SC)); save(K.ow, DEF_OW.slice()); }

  window.Meta = { energy, spendEnergy, addEnergy, scrolls, useScroll, addScroll, owned, addOwned, reset, MAX, REGEN };
})();
