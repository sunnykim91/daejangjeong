// 실전 전투 시뮬레이션 코어 (실시간, 병사 단위). DOM/캔버스 의존 없음 → Node 테스트 가능.
// 장수 = 부대 지휘관. 병사는 장수의 병종/능력을 상속. 병종 상성·사기·도주(rout) 반영.
(function () {
  const Engine = (typeof require !== 'undefined') ? require('./engine.js') : window.Engine;
  const typeMult = Engine.typeMult;

  // 진형 성능: 공격/피해/속도 배수
  const FORM_STATS = {
    '방진': { atk: 1.00, taken: 0.82, spd: 0.92, desc: '방어형 — 잘 안 죽지만 느림' },
    '횡대': { atk: 1.06, taken: 1.02, spd: 1.00, desc: '넓은 전열 — 균형 공세' },
    '종대': { atk: 1.10, taken: 1.10, spd: 1.10, desc: '돌파형 — 화력·기동 높지만 취약' },
    '쐐기': { atk: 1.20, taken: 1.16, spd: 1.16, desc: '돌격형 — 한방 강하나 무름' },
  };
  // 진형 상성(순환): 쐐기▶방진▶횡대▶종대▶쐐기. 공격 진형이 상대를 카운터하면 ×1.2, 역상성 ×0.85.
  const FORM_BEATS = { '쐐기': '방진', '방진': '횡대', '횡대': '종대', '종대': '쐐기' };
  function formCounter(aForm, dForm) {
    if (FORM_BEATS[aForm] === dForm) return 1.2;
    if (FORM_BEATS[dForm] === aForm) return 0.85;
    return 1.0;
  }

  // 지형 존: 언덕(공·방↑) / 숲(원거리 피해↓·기병↓·느림) / 하천(피해↑·매우 느림)
  const NOTERR = { type: null, atkMul: 1, takenMul: 1, rangedTakenMul: 1, cavMul: 1, speedMul: 1 };
  function defaultTerrain(W, H) {
    const u = Math.min(W, H);
    // 모든 지형은 중앙선(y=H/2) 기준 대칭 → 어느 진영에도 선천적 유불리 없음(점령 경쟁).
    return [
      { type: '언덕', shape: 'circle', x: W * 0.27, y: H * 0.5, r: u * 0.16, atkMul: 1.18, takenMul: 0.88, rangedTakenMul: 1, cavMul: 1, speedMul: 0.95 },
      { type: '숲',   shape: 'circle', x: W * 0.73, y: H * 0.5, r: u * 0.17, atkMul: 1, takenMul: 1, rangedTakenMul: 0.5, cavMul: 0.8, speedMul: 0.78 },
      { type: '하천', shape: 'rect', x0: W * 0.42, x1: W * 0.58, y0: H * 0.44, y1: H * 0.56, atkMul: 1, takenMul: 1.22, rangedTakenMul: 1, cavMul: 1, speedMul: 0.5 },
    ];
  }
  function terrainAt(war, x, y) {
    for (const z of war.terrain) {
      if (z.shape === 'circle') { const dx = x - z.x, dy = y - z.y; if (dx * dx + dy * dy <= z.r * z.r) return z; }
      else if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return z;
    }
    return NOTERR;
  }

  // 진형 유지 메커니즘 -----------------------------------
  const BROKEN_PERF = 0.6;   // 진형 이탈 병사의 전투력 배율(유지 병사 대비)
  // 통솔력 → 진형을 유지하는 병사 비율(통솔 높을수록 유지 병사 수↑)
  function formedRatio(command) { return Math.max(0.3, Math.min(0.97, 0.30 + command * 0.007)); }

  // 지력 → 스킬 액티브 파워 배율 (지력 높은 장수일수록 스킬이 강함)
  function skillPow(intellect) { return 0.6 + (intellect || 60) * 0.011; }
  const SKILL_CD = 8;   // 스킬 재사용 대기(초)

  // 장수 → 병사 1명의 기본 스탯
  function soldierStats(g) {
    let hp = 24 + g.command * 0.45, atk = 3 + g.might * 0.10, spd = 24 + g.agility * 0.45, range = 13, cd = 0.8;
    if (g.troop === '보병') { hp *= 1.30; }
    else if (g.troop === '기병') { spd *= 1.45; atk *= 1.15; }
    else if (g.troop === '궁병') { range = 110; cd = 1.15; hp *= 0.85; atk *= 1.05; }
    // 창병의 강점은 상성(typeMult)으로 표현
    return { hp: Math.round(hp), atk, spd, range, cd };
  }

  // 진형별 병사 오프셋(국소좌표: dy>=0 은 후방). spacing 간격.
  function formationOffsets(form, n, sp) {
    const off = [];
    const grid = (cols) => { for (let i = 0; i < n; i++) { const r = Math.floor(i / cols), c = i % cols; off.push({ dx: (c - (cols - 1) / 2) * sp, dy: r * sp }); } };
    if (form === '횡대') grid(Math.ceil(n / 2));        // 넓고 얕게
    else if (form === '종대') grid(3);                   // 좁고 깊게
    else if (form === '쐐기') {                          // 삼각 돌격진
      let i = 0, row = 0;
      while (i < n) { const cnt = row + 1; for (let c = 0; c < cnt && i < n; c++, i++) off.push({ dx: (c - (cnt - 1) / 2) * sp, dy: row * sp }); row++; }
    } else grid(Math.ceil(Math.sqrt(n)));               // 방진(기본)
    return off;
  }

  function makeSquad(g, team, idx, opts) {
    const st = soldierStats(g);
    const sp = opts.spacing || 13;
    const off = formationOffsets(opts.form || '방진', opts.squadN, sp);
    const members = [];
    // 통솔력에 따라 진형 유지 병사 수 결정(앞열=유지, 뒤열=이탈 stragglers)
    const formedCount = Math.round(off.length * formedRatio(g.command));
    // 일반 병사
    for (let i = 0; i < off.length; i++) {
      const formed = i < formedCount;                       // 진형 유지 여부
      members.push({
        team, troop: g.troop, gen: false, genName: g.name, squad: idx,
        x: 0, y: 0, hp: st.hp, maxHp: st.hp,
        atk: st.atk * (formed ? 1 : BROKEN_PERF),           // 이탈 병사는 전투력 0.6배
        baseAtk: st.atk,                                    // 재집결(분기) 시 복원용
        range: st.range,
        cd: 0, cdMax: st.cd, spd: st.spd, alive: true, flee: false, target: null, rt: Math.random() * 0.3,
        off: off[i], formed,
        _sx: formed ? 0 : (Math.random() - 0.5) * sp * 0.9,   // 이탈병은 진형에서 산개
        _sy: formed ? 0 : (Math.random() - 0.5) * sp * 0.9,
      });
    }
    // 장수(지휘관) — 메인 콘텐츠. 압도적으로 강한 단일 유닛(일당백). 항상 진형 유지.
    members.push({
      team, troop: g.troop, gen: true, genName: g.name, id: g.id, squad: idx,
      x: 0, y: 0, hp: st.hp * 16, maxHp: st.hp * 16, atk: st.atk * 4.0, range: st.range,
      cd: 0, cdMax: st.cd * 0.7, spd: st.spd * 1.14, alive: true, flee: false, target: null, rt: 0,
      off: { dx: 0, dy: -sp * 1.4 }, formed: true,
      skill: g.skill, intellect: g.intellect,                 // 스킬 액티브(지력 스케일)
      skillCd: 4 + Math.random() * 3, skillCdMax: SKILL_CD,
    });
    return { team, gen: g, form: opts.form || '방진', cx: 0, cy: 0, members, spacing: sp, formedCount };
  }

  // 부대 홈 좌표 재배치(셋업 드래그/진형 변경용). 즉시 x,y 도 갱신.
  function reflowSquad(sq, cx, cy, form) {
    sq.cx = cx; sq.cy = cy;
    if (form) sq.form = form;
    const n = sq.members.length - 1;                   // 장수 제외
    const off = formationOffsets(sq.form, n, sq.spacing);
    const dir = sq.team === 'player' ? 1 : -1;          // player 후방 = +y
    let i = 0;
    for (const m of sq.members) {
      const o = m.gen ? m.off : off[i++];
      m.off = o; m.form = sq.form;
      m.x = cx + o.dx + (m._sx || 0); m.y = cy + dir * o.dy + (m._sy || 0);   // 이탈병 산개 반영
    }
  }

  function createWar(opts) {
    const W = opts.fieldW, H = opts.fieldH, squadN = opts.squadN || 20;
    const war = { W, H, squads: [], soldiers: [], morale: { player: 75, enemy: 75 },
      casualties: { player: 0, enemy: 0 }, flashes: [], projectiles: [], skillFx: [], time: 0, maxTime: opts.maxTime || 120,
      finished: false, result: null };

    const place = (roster, team) => {
      const cols = [0.20, 0.40, 0.60, 0.80];
      const cy = team === 'player' ? H * 0.80 : H * 0.20;
      roster.forEach((g, i) => {
        const form = (opts.forms && opts.forms[team] && opts.forms[team][i]) || (team === 'player' ? (opts.playerForm || '방진') : '방진');
        // 부대 도트 수 = 배정된 병력(opts.troops[team][i], 도트 단위). 없으면 squadN 기본.
        const sn = (opts.troops && opts.troops[team] && opts.troops[team][i]) || opts.squadN || 22;
        const sq = makeSquad(g, team, i, { squadN: sn, form });
        reflowSquad(sq, cols[i] * W, cy, form);
        war.squads.push(sq);
        for (const m of sq.members) war.soldiers.push(m);
      });
    };
    war.terrain = opts.terrain || defaultTerrain(W, H);
    place(opts.rosterP, 'player');
    place(opts.rosterE, 'enemy');
    war.startCount = {
      player: war.soldiers.filter((s) => s.team === 'player').length,
      enemy: war.soldiers.filter((s) => s.team === 'enemy').length,
    };
    return war;
  }

  function alive(war, team) { return war.soldiers.filter((s) => s.alive && !s.deserted && s.team === team); }
  function dist2(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }

  // 사망 시 사기 변동: 잃은 쪽은 하락, 죽인 쪽은 상승(처치는 사기를 올린다).
  // 적장 처치는 양쪽 모두 크게 흔든다.
  function killMorale(war, victim) {
    war.casualties[victim.team]++;
    const killer = victim.team === 'player' ? 'enemy' : 'player';
    const drop = victim.gen ? 16 : 0.7;     // 잃은 쪽
    const gain = victim.gen ? 10 : 0.45;    // 죽인 쪽
    war.morale[victim.team] = Math.max(0, war.morale[victim.team] - drop);
    war.morale[killer] = Math.min(100, war.morale[killer] + gain);
  }

  // 피해 적용(지형/진형 보정 + 사망 처리). 스킬 등 즉시 피해용.
  function applyHit(war, t, dmg) {
    if (!t || !t.alive || t.deserted) return;
    const dz = terrainAt(war, t.x, t.y), tfs = FORM_STATS[t.form] || FORM_STATS['방진'];
    t.hp -= dmg * dz.takenMul * tfs.taken;
    war.flashes.push({ x: t.x, y: t.y, ttl: 0.14 });
    if (t.hp <= 0 && t.alive) { t.alive = false; killMorale(war, t); }
  }

  // 장수 스킬 액티브 발동 — 위력은 지력(skillPow)에 비례.
  function castSkill(war, g) {
    const pow = skillPow(g.intellect), team = g.team, foeTeam = team === 'player' ? 'enemy' : 'player';
    const foes = war.soldiers.filter((s) => s.team === foeTeam && s.alive && !s.deserted);
    let tx = g.x, ty = g.y;
    if (g.skill === '강타') {                       // 단일 강타 ×2.0
      let best = null, bd = Infinity;
      for (const f of foes) { const d = (f.x - g.x) ** 2 + (f.y - g.y) ** 2; if (d < bd) { bd = d; best = f; } }
      if (best) { applyHit(war, best, g.atk * 2.0 * pow); tx = best.x; ty = best.y; }
    } else if (g.skill === '연격') {                // 광역 연격 — 반경 내 각각 ×0.6
      const R2 = 48 * 48;
      for (const f of foes) if ((f.x - g.x) ** 2 + (f.y - g.y) ** 2 <= R2) applyHit(war, f, g.atk * 0.6 * pow);
    } else if (g.skill === '저격') {                // 체력 최저 적 저격 ×1.8 (장수 우선)
      let best = null, bv = Infinity;
      for (const f of foes) { const v = f.hp * (f.gen ? 0.5 : 1); if (v < bv) { bv = v; best = f; } }
      if (best) { applyHit(war, best, g.atk * 1.8 * pow); tx = best.x; ty = best.y; }
    } else if (g.skill === '분기') {                // 아군 사기↑ + 이탈병 재집결(진형 복귀)
      war.morale[team] = Math.min(100, war.morale[team] + 10 * pow);
      const sq = war.squads.find((s) => s.members.indexOf(g) >= 0);
      if (sq) { let n = Math.ceil(1.5 * pow);
        for (const m of sq.members) { if (n <= 0) break;
          if (!m.gen && !m.formed && m.alive && !m.deserted) { m.formed = true; m.atk = m.baseAtk; n--; } } }
    } else { return; }
    war.skillFx.push({ name: g.skill, x: tx, y: ty, gx: g.x, gy: g.y, team, ttl: 1.1 });
  }

  function stepWar(war, dt, rng) {
    if (war.finished) return war.result;
    rng = rng || Math.random;
    dt = Math.min(dt, 0.05);
    war.time += dt;

    const teams = { player: alive(war, 'player'), enemy: alive(war, 'enemy') };

    for (const s of war.soldiers) {
      if (!s.alive || s.deserted) continue;
      const foes = teams[s.team === 'player' ? 'enemy' : 'player'];

      // 도주 판정
      if (!s.flee) {
        const m = war.morale[s.team];
        if (m <= 0) s.flee = true;
        else if (m < 30 && rng() < (0.5 * dt)) s.flee = true;
      }
      if (s.flee) {
        const dir = s.team === 'player' ? 1 : -1;
        s.y += dir * s.spd * 1.2 * dt;
        if (s.y < -20 || s.y > war.H + 20) { s.deserted = true; war.casualties[s.team]++; }
        continue;
      }

      const sz = terrainAt(war, s.x, s.y);

      // 타겟 획득(주기적). 패주(flee)하는 적은 추격하지 않고, 아직 교전 중인 적을 노린다.
      s.rt -= dt;
      if (s.rt <= 0 || !s.target || !s.target.alive || s.target.deserted || s.target.flee) {
        s.rt = 0.25 + rng() * 0.2;
        let best = null, bd = Infinity;
        for (const f of foes) { if (f.flee) continue; const d = dist2(s, f); if (d < bd) { bd = d; best = f; } }
        s.target = best;   // 비패주 적이 없으면 null → 아래에서 전진(패주병은 알아서 이탈)
      }
      const t = s.target;
      if (!t) {  // 노릴 교전 적 없음 → 전진
        const dir = s.team === 'player' ? -1 : 1;
        s.y += dir * s.spd * dt * sz.speedMul;
      } else {
        const dx = t.x - s.x, dy = t.y - s.y, d = Math.hypot(dx, dy) || 1;
        if (d > s.range) {                    // 접근
          const step = s.spd * dt * sz.speedMul;
          s.x += (dx / d) * step; s.y += (dy / d) * step;
        } else {                              // 공격
          s.cd -= dt;
          if (s.cd <= 0) {
            s.cd = s.cdMax;
            const fs = FORM_STATS[s.form] || FORM_STATS['방진'];
            let dmg = s.atk * typeMult(s.troop, t.troop) * (0.8 + rng() * 0.4)
              * sz.atkMul * (s.troop === '기병' ? sz.cavMul : 1)
              * fs.atk * formCounter(s.form, t.form);
            if (s.range > 40) {               // 원거리(궁병) → 화살(피격지 지형 보정은 명중 시)
              war.projectiles.push({ x: s.x, y: s.y, dx: 0, dy: 0, target: t, dmg, team: s.team, ttl: 0 });
            } else {                          // 근접 → 즉시 타격
              const dz = terrainAt(war, t.x, t.y), tfs = FORM_STATS[t.form] || FORM_STATS['방진'];
              dmg *= dz.takenMul * tfs.taken;
              t.hp -= dmg;
              war.flashes.push({ x: t.x, y: t.y, ttl: 0.12 });
              if (t.hp <= 0 && t.alive) { t.alive = false; killMorale(war, t); }
            }
          }
        }
      }
    }

    // 장수 스킬 액티브(쿨다운마다 자동 발동, 지력 스케일)
    for (const s of war.soldiers) {
      if (!s.gen || !s.alive || s.deserted || s.flee || !s.skill) continue;
      s.skillCd -= dt;
      if (s.skillCd <= 0) { s.skillCd = s.skillCdMax; castSkill(war, s); }
    }

    // 투사체(화살) 이동 + 명중
    const PSPD = 380;
    for (const p of war.projectiles) {
      const t = p.target;
      if (!t || !t.alive || t.deserted) { p.dead = true; continue; }
      const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy) || 1;
      p.dx = dx / d; p.dy = dy / d;
      const step = PSPD * dt;
      if (d <= step + 6) {                    // 명중 (피격지 지형/진형 보정)
        const dz = terrainAt(war, t.x, t.y), tfs = FORM_STATS[t.form] || FORM_STATS['방진'];
        t.hp -= p.dmg * dz.takenMul * dz.rangedTakenMul * tfs.taken;
        war.flashes.push({ x: t.x, y: t.y, ttl: 0.12 });
        if (t.hp <= 0 && t.alive) { t.alive = false; killMorale(war, t); }
        p.dead = true;
      } else { p.x += p.dx * step; p.y += p.dy * step; }
      p.ttl += dt; if (p.ttl > 3) p.dead = true;
    }
    war.projectiles = war.projectiles.filter((p) => !p.dead);

    // 분리(같은 팀 겹침 방지) — 가벼운 넛지
    const sep = 11, sep2 = sep * sep;
    for (let i = 0; i < war.soldiers.length; i++) {
      const a = war.soldiers[i]; if (!a.alive || a.deserted || a.flee) continue;
      for (let j = i + 1; j < war.soldiers.length; j++) {
        const b = war.soldiers[j]; if (!b.alive || b.deserted || b.team !== a.team) continue;
        const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < sep2) {
          const d = Math.sqrt(d2), push = (sep - d) * 0.5;
          const ux = dx / d, uy = dy / d;
          a.x += ux * push; a.y += uy * push; b.x -= ux * push; b.y -= uy * push;
        }
      }
    }

    // 플래시 / 스킬 이펙트 수명
    for (const f of war.flashes) f.ttl -= dt;
    war.flashes = war.flashes.filter((f) => f.ttl > 0);
    for (const k of war.skillFx) k.ttl -= dt;
    war.skillFx = war.skillFx.filter((k) => k.ttl > 0);

    // 종료 판정
    const pn = alive(war, 'player').length, en = alive(war, 'enemy').length;
    if (pn === 0 || en === 0 || war.time >= war.maxTime) {
      let winner;
      if (pn !== en) winner = pn > en ? 'player' : 'enemy';
      else winner = war.morale.player >= war.morale.enemy ? 'player' : 'enemy';
      war.finished = true;
      war.result = {
        winner, time: Math.round(war.time),
        survivors: { player: pn, enemy: en },
        casualties: { ...war.casualties },
        morale: { player: Math.round(war.morale.player), enemy: Math.round(war.morale.enemy) },
        reason: (pn === 0 || en === 0) ? 'annihilation' : 'timeout',
      };
    }
    return war.result;
  }

  const WarSim = { createWar, stepWar, reflowSquad, formationOffsets, soldierStats, alive, formedRatio, skillPow, BROKEN_PERF, FORM_STATS, FORM_BEATS };
  if (typeof module !== 'undefined' && module.exports) module.exports = WarSim;
  if (typeof window !== 'undefined') window.WarSim = WarSim;
})();
