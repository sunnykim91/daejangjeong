// 총력전(토탈맵) 코어 — 한 맵 위 다중 부대 실시간 이동·교전·성 점령. DOM 없음(Node 검증 가능).
// warsim의 전투 수학(soldierStats/진형/지력스킬)을 재사용하되, 2팀 고정전투가 아니라
// 임의 위치의 여러 부대가 명령대로 이동하고 근접 시 자동 교전하는 오케스트레이션 레이어.
(function () {
  const Engine = (typeof require !== 'undefined') ? require('./engine.js') : window.Engine;
  const WarSim = (typeof require !== 'undefined') ? require('./warsim.js') : window.WarSim;
  const typeMult = Engine.typeMult;
  const { soldierStats, formationOffsets, formedRatio, skillPow, FORM_STATS, FORM_BEATS } = WarSim;

  const AGGRO = 150;          // 교전 유지(추격) 반경
  const ENGAGE = 66;          // 접적(표적 획득) 반경 — 이 안에 적이 들어와야 진형에서 이탈해 교전
  const SEP = 11;             // 아군 겹침 방지 간격
  const CAP_R = 46;           // 성 점령 판정 반경
  const DUEL_R = 44;          // 적 장수 이 거리 안 → 일기토 발생 가능
  const DUEL_CD = 9;          // 일기토 재발 대기(초)
  // ── 야습/혼란/와해 (Phase1: 소수가 대군을 이기는 핵심 장치) ──
  const RAID_R = 130;         // 야습 발동 감지 반경(활동부대 → 숙영/방심한 적)
  const RAID_CD = 6;          // 야습 재시도 대기(초)
  const CONFUSE_DUR = 9;      // 혼란 지속(초). 이 안에 수습 못 하면 와해로 전환
  const DAY_LEN = 160;        // 하루 길이(초) — Track A 가짜 시계. 서버판에선 실시간(≈30분)로 교체
  const NIGHT_FRAC = 0.42;    // 하루 중 밤 비율(야습 보너스 시간대)

  // 지형 효과 테이블(컴포넌트화): spd=이동, atk=공격, taken=피해, cav=기병배수, ranged=피격 원거리피해배수(엄폐)
  const TERRAIN = {
    '평야': { spd: 1.00, atk: 1.00, taken: 1.00, cav: 1.00, ranged: 1.00 },
    '언덕': { spd: 0.86, atk: 1.15, taken: 0.88, cav: 0.95, ranged: 1.00 },
    '산악': { spd: 0.55, atk: 1.06, taken: 0.80, cav: 0.65, ranged: 1.00 },
    '물':   { spd: 0.50, atk: 0.95, taken: 1.22, cav: 0.80, ranged: 1.00 },
    '숲':   { spd: 0.78, atk: 1.00, taken: 1.00, cav: 0.80, ranged: 0.55 },
    '늪':   { spd: 0.50, atk: 0.90, taken: 1.10, cav: 0.55, ranged: 1.00 },
  };
  const PLAIN = TERRAIN['평야'];
  function terrainAt(world, x, y) {
    for (const z of world.terrain) {
      if (z.shape === 'rect') { if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return TERRAIN[z.type] || PLAIN; }
      else { if ((x - z.x) ** 2 + (y - z.y) ** 2 <= z.r * z.r) return TERRAIN[z.type] || PLAIN; }
    }
    return PLAIN;
  }

  function formCounter(a, b) { if (FORM_BEATS[a] === b) return 1.2; if (FORM_BEATS[b] === a) return 0.85; return 1; }

  // ── 통과불가 지형 + 경로탐색(플로우 필드) ──────────────────
  const NAV = 40;                                    // 내비 셀 크기(px)
  const BLOCK = { '물': 1, '산악': 1 };               // 통과불가 지형(강·산은 벽)
  function typeAt(world, x, y) {
    for (const z of world.terrain) {
      if (z.shape === 'rect') { if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return z.type; }
      else { if ((x - z.x) ** 2 + (y - z.y) ** 2 <= z.r * z.r) return z.type; }
    }
    return '평야';
  }
  function buildNav(world) {
    const gw = Math.ceil(world.W / NAV), gh = Math.ceil(world.H / NAV), blk = new Uint8Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      if (BLOCK[typeAt(world, (gx + 0.5) * NAV, (gy + 0.5) * NAV)]) blk[gy * gw + gx] = 1;
    }
    world._nav = { gw, gh, blk };
  }
  function passableAt(world, x, y) {
    const n = world._nav; if (!n) return true;
    const gx = (x / NAV) | 0, gy = (y / NAV) | 0;
    if (gx < 0 || gy < 0 || gx >= n.gw || gy >= n.gh) return false;
    return n.blk[gy * n.gw + gx] === 0;
  }
  // 벽 미끄러짐 이동(막히면 축별 슬라이드 → 그래도 막히면 벽 접선으로 우회)
  function stepMove(world, s, vx, vy) {
    if (passableAt(world, s.x + vx, s.y + vy)) { s.x += vx; s.y += vy; return; }
    if (passableAt(world, s.x + vx, s.y)) { s.x += vx; return; }
    if (passableAt(world, s.x, s.y + vy)) { s.y += vy; return; }
    const sp = Math.hypot(vx, vy) || 1, px = -vy / sp * sp, py = vx / sp * sp;   // 진행방향 수직(접선)
    if (passableAt(world, s.x + px, s.y + py)) { s.x += px; s.y += py; }
    else if (passableAt(world, s.x - px, s.y - py)) { s.x -= px; s.y -= py; }
  }
  function nearestPassableCell(n, gx, gy) {
    gx = Math.max(0, Math.min(n.gw - 1, gx)); gy = Math.max(0, Math.min(n.gh - 1, gy));
    if (!n.blk[gy * n.gw + gx]) return gy * n.gw + gx;
    for (let r = 1; r < Math.max(n.gw, n.gh); r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = gx + dx, y = gy + dy; if (x < 0 || y < 0 || x >= n.gw || y >= n.gh) continue;
        if (!n.blk[y * n.gw + x]) return y * n.gw + x;
      }
    }
    return -1;
  }
  const NB8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  // 목표 셀에서 BFS 거리장(플로우 필드). 대군이 이걸 따라 내려가면 장애물 우회+협로 병목.
  function computeFlow(world, gx, gy) {
    const n = world._nav; if (!n) return null;
    const gw = n.gw, gh = n.gh, blk = n.blk, start = nearestPassableCell(n, gx, gy); if (start < 0) return null;
    const dist = new Int32Array(gw * gh).fill(-1); dist[start] = 0;
    const q = [start]; let h = 0;
    while (h < q.length) {
      const ci = q[h++], cx = ci % gw, cy = (ci / gw) | 0, cd = dist[ci];
      for (const [dx, dy] of NB8) {
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const ni = ny * gw + nx; if (blk[ni] || dist[ni] >= 0) continue;
        if (dx && dy && (blk[cy * gw + nx] || blk[ny * gw + cx])) continue;   // 대각 코너 컷 방지
        dist[ni] = cd + 1; q.push(ni);
      }
    }
    return dist;
  }

  // 부대 1개 생성(장수 + 배정 병력 도트). cx,cy = 성 근처 스폰.
  function makeArmy(g, team, id, cx, cy, dots, form) {
    const st = soldierStats(g);
    const off = formationOffsets(form, dots, 13);
    const formedCount = Math.round(dots * formedRatio(g.command));
    const members = [];
    for (let i = 0; i < dots; i++) {
      const formed = i < formedCount, o = off[i] || { dx: 0, dy: 0 };
      const _sx = formed ? 0 : (Math.random() - 0.5) * 11.7, _sy = formed ? 0 : (Math.random() - 0.5) * 11.7;  // 이탈병 산개
      members.push({
        team, army: id, troop: g.troop, gen: false, x: cx + o.dx + _sx, y: cy + o.dy + _sy, form,
        hp: st.hp, maxHp: st.hp, atk: st.atk * (formed ? 1 : 0.6), baseAtk: st.atk, range: st.range,
        cd: 0, cdMax: st.cd, spd: st.spd, alive: true, flee: false, formed, off: o, _sx, _sy, target: null, rt: Math.random() * 0.3,
      });
    }
    members.push({
      team, army: id, troop: g.troop, gen: true, genName: g.name, id: g.id, x: cx, y: cy - 18, form,
      hp: st.hp * 16, maxHp: st.hp * 16, atk: st.atk * 4, baseAtk: st.atk * 4, range: st.range,
      cd: 0, cdMax: st.cd * 0.7, spd: st.spd * 1.14, alive: true, flee: false, formed: true, off: { dx: 0, dy: -18 },
      target: null, rt: 0, skill: g.skill, intellect: g.intellect, skillCd: 4 + Math.random() * 3, skillCdMax: 8,
    });
    return { id, team, gen: g, form, order: { x: cx, y: cy }, morale: 75, _engaged: false,
      fatigue: 0, camp: false, aware: true, confused: false, confuseT: 0, collapsed: false,
      _atkMul: 1, _spdMul: 1, _raidCd: 0, _marchMul: 1 + ((g._setFx && g._setFx.march) || 0), stance: '진군', _hold: false, _noEngage: false, _stanceSpd: 1, members };   // 기병 세트: 행군 속도↑
  }

  function createWorld(opts) {
    const W = opts.W, H = opts.H;
    const world = { W, H, time: 0, winner: null, castles: [], armies: [], soldiers: [], generals: [], duels: [], flashes: [], skillFx: [], projectiles: [], terrain: opts.terrain || [], _aid: 0, _did: 0,
      clock: opts.startClock || 0, dayLen: opts.dayLen || DAY_LEN, nightFrac: opts.nightFrac != null ? opts.nightFrac : NIGHT_FRAC, night: false, tod: 0, duelRequest: null, autoDuel: !!opts.autoDuel };
    for (const c of opts.castles) {
      const castle = {
        id: c.id, name: c.name, x: c.x, y: c.y, owner: c.owner, hp: 100,
        troops: c.troops != null ? c.troops : 3000, troopMax: c.troopMax != null ? c.troopMax : 6000,
        prod: c.prod != null ? c.prod : 120, min: c.min != null ? c.min : 70, garrison: [],
      };
      world.castles.push(castle);
      for (const g of (c.garrison || [])) {
        const rec = { def: g, team: c.owner, state: 'garrison', castle: c.id, armyId: null };
        world.generals.push(rec); castle.garrison.push(rec);
      }
    }
    // (선택) 사전 배치 부대 — 하위호환/테스트용
    for (const a of (opts.armies || [])) {
      const cst = world.castles.find((c) => c.id === a.castle);
      const sx = cst ? cst.x : a.x, sy = (cst ? cst.y : a.y) + (a.team === 'player' ? 34 : -34);
      const army = makeArmy(a.gen, a.team, world._aid++, sx, sy, a.dots || 24, a.form || '방진');
      world.armies.push(army);
      for (const m of army.members) world.soldiers.push(m);
      world.generals.push({ def: a.gen, team: a.team, state: 'field', castle: null, armyId: army.id });
    }
    buildNav(world);                                  // 통과불가 지형 내비 그리드
    updateDayNight(world, 0);                          // 초기 밤/낮 상태 확정(startClock 반영)
    return world;
  }

  // 성에 주둔한 장수를 병력·진형 정해 필드로 출진. dots는 성 병력 풀(1도트=100명)에서 차감.
  function sortie(world, castleId, genId, dots, form) {
    const c = world.castles.find((x) => x.id === castleId); if (!c) return null;
    const rec = c.garrison.find((r) => r.def.id === genId && r.state === 'garrison'); if (!rec) return null;
    const maxDots = Math.floor(c.troops / 100); if (maxDots < 1) return null;
    dots = Math.max(1, Math.min(dots | 0, maxDots));
    const dir = c.owner === 'player' ? 1 : -1;
    const army = makeArmy(rec.def, c.owner, world._aid++, c.x, c.y + dir * 42, dots, form || '방진');
    army.order.x = c.x; army.order.y = c.y + dir * 95;   // 성문 밖으로 진군 명령(즉시 재입성 방지)
    world.armies.push(army);
    for (const m of army.members) world.soldiers.push(m);
    c.troops -= dots * 100;
    c.garrison = c.garrison.filter((r) => r !== rec);
    rec.state = 'field'; rec.castle = null; rec.armyId = army.id;
    return army;
  }

  const armyOf = (world, id) => world.armies.find((a) => a.id === id);
  const genRecOf = (world, armyId) => world.generals.find((g) => g.armyId === armyId);

  // 재입성(재정비): 필드 부대를 아군 성에 흡수 — 잔여 병력을 성 풀로 환원하고 장수 재주둔.
  function regarrison(world, armyId, castleId) {
    const a = armyOf(world, armyId); if (!a || a._merged) return false;
    const c = world.castles.find((x) => x.id === castleId); if (!c || c.owner !== a.team) return false;
    let n = 0; for (const m of a.members) if (!m.gen && m.alive && !m.gone) n++;
    c.troops = Math.min(c.troopMax, c.troops + n * 100);
    const rec = genRecOf(world, armyId);
    if (rec) { rec.state = 'garrison'; rec.castle = c.id; rec.armyId = null; c.garrison.push(rec); }
    for (const m of a.members) m.gone = true;
    a._merged = true;
    return true;
  }

  // 일기토 무력 판정: 무력 중심 + 통솔/지력 + 현재 체력비 + 운.
  function duelPower(world, g, rng) {
    const rec = genRecOf(world, g.army), d = rec ? rec.def : {};
    const base = (d.might || 60) * 1.0 + (d.command || 60) * 0.3 + (d.intellect || 60) * 0.15 + (g.hp / g.maxHp) * 22 + rng() * 45;
    return base * (1 + ((d._setFx && d._setFx.duel) || 0));                 // 맹장 세트: 일기토 위력↑
  }
  function startDuel(world, a, b) {
    const d = { id: world._did++, a, b, t: 0, dur: 2.6, clash: 0.4, ended: false, endT: 0, hitAt: null, hitSide: null, clashN: 0,
      aName: a.genName, bName: b.genName, aTeam: a.team, bTeam: b.team, aTroop: a.troop, bTroop: b.troop, aMax: a.maxHp, bMax: b.maxHp };
    a.duel = d; b.duel = d; world.duels.push(d);
  }
  // 진행 중 일기토 처리(합/종료). stepDuels(일시중지 중 결투만 진행)와 step 양쪽에서 사용.
  function procDuels(world, dt, rng) {
    world.duels = world.duels.filter((d) => !(d.ended && world.time - d.endT > 1.6));
    for (const d of world.duels) {
      if (d.ended) continue;
      const a = d.a, b = d.b;
      if (!a.alive || a.gone || !b.alive || b.gone) { d.t = d.dur; }
      d.t += dt; d.clash -= dt;
      if (d.clash <= 0 && d.t < d.dur) {
        d.clash = 0.55;
        const pa = duelPower(world, a, rng), pb = duelPower(world, b, rng);
        const loser = pa < pb ? a : b, winner = pa < pb ? b : a, gap = Math.abs(pa - pb);
        applyHit(world, loser, loser.maxHp * Math.min(0.24, 0.07 + gap * 0.0032), winner.team);
        world.flashes.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, ttl: 0.16 });
        d.hitAt = world.time; d.hitSide = (loser === a) ? 'a' : 'b'; d.clashN = (d.clashN || 0) + 1;
      }
      if (d.t >= d.dur) {
        const aw = a.alive && !a.gone, bw = b.alive && !b.gone;
        d.winnerName = (!aw && bw) ? d.bName : (!bw && aw) ? d.aName : ((a.hp / a.maxHp >= b.hp / b.maxHp) ? d.aName : d.bName);
        d.killed = !aw || !bw;
        d.ended = true; d.endT = world.time;
        if (a.alive && !a.gone) { a.duel = null; a._duelCd = DUEL_CD; }
        if (b.alive && !b.gone) { b.duel = null; b._duelCd = DUEL_CD; }
        const wt = d.winnerName === d.aName ? d.aTeam : d.bTeam;
        for (const ar of world.armies) if (ar.team === wt) ar.morale = Math.min(100, ar.morale + 4);
      }
    }
  }
  // 새 일기토 감지(한 번에 하나만 — 결투 중엔 발생 안 함)
  function detectDuels(world, dt, rng) {
    if (world.duelRequest || world.duels.some((d) => !d.ended)) return;
    const gens = [];
    for (const s of world.soldiers) { if (s.gen && s.alive && !s.gone && !s.flee) { if (s._duelCd > 0) s._duelCd -= dt; gens.push(s); } }
    for (let i = 0; i < gens.length; i++) for (let j = i + 1; j < gens.length; j++) {
      const a = gens[i], b = gens[j];
      if (a.team === b.team || a.duel || b.duel || a._duelCd > 0 || b._duelCd > 0) continue;
      if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 > DUEL_R * DUEL_R) continue;
      if (rng() < 1.6 * dt) { world.duelRequest = { a, b }; if (world.autoDuel) resolveDuelAuto(world, rng); return; }   // UI가 처리 / 헤드리스는 자동 판정
    }
  }
  // 헤드리스(테스트·AI 시뮬)용 자동 일기토 판정 — engine 턴제 1:1을 즉시 돌려 결과 반영.
  function resolveDuelAuto(world, rng) {
    const req = world.duelRequest; if (!req) return;
    const ra = genRecOf(world, req.a.army), rb = genRecOf(world, req.b.army);
    if (!ra || !rb) { world.duelRequest = null; return; }
    const battle = Engine.createBattle({ player: [ra.def], enemy: [rb.def] }, { seed: ((world.time * 1000) | 0) ^ 0x9e37 });
    const r = Engine.runBattle(battle);
    const aWon = r.winner === 'player', winner = aWon ? req.a : req.b, loser = aWon ? req.b : req.a;
    const loserF = aWon ? battle.teams.enemy[0] : battle.teams.player[0];
    applyDuelResult(world, winner, loser, !loserF.alive);
  }
  // 턴제 일기토 결과를 전쟁에 반영(RQ-V4-006): 승리 사기↑ / 패배 전사→부대 와해 or 생존→사기급락·혼란(후퇴).
  function applyDuelResult(world, winner, loser, loserKilled) {
    const wa = armyOf(world, winner.army), la = armyOf(world, loser.army);
    if (wa) { wa.morale = Math.min(100, wa.morale + 12); wa.aware = true; }
    if (loserKilled) {
      if (loser.alive) { loser.hp = 0; loser.alive = false; killMorale(world, loser, winner.team); }   // 전사/도망 + 부대 해산
    } else if (la) {
      la.morale = Math.max(0, la.morale - 20);                    // 패배(생존): 사기 급락 → 후퇴 유발
      la.confused = true; la.confuseT = CONFUSE_DUR * 0.6;        // 혼란(돌파당함)
    }
    if (winner.alive) winner._duelCd = DUEL_CD;
    if (loser.alive) loser._duelCd = DUEL_CD;
    world.duelRequest = null;
  }
  // 일시중지 중 일기토만 진행(삼국지식 결투 컷씬용). 시간은 흐르되 나머지 시뮬 정지.
  function stepDuels(world, dt, rng) { if (world.winner) return; rng = rng || Math.random; dt = Math.min(dt, 0.05); world.time += dt; procDuels(world, dt, rng); }
  function aliveCount(world, id) { let n = 0; for (const s of world.soldiers) if (s.army === id && s.alive && !s.gone) n++; return n; }

  function moveArmy(world, id, x, y) { const a = armyOf(world, id); if (!a) return; a.order.x = x; a.order.y = y; a._flow = null; }   // 명령 변경 → 플로우 재계산

  // 민첩 → 전사 대신 인근 아군 성으로 도망(재주둔)할 확률. 0→25% / 50→50% / 100→100%(피스와이즈).
  function escapeChance(agi) { agi = agi == null ? 50 : agi; return agi <= 50 ? 0.25 + (agi / 50) * 0.25 : 0.5 + ((agi - 50) / 50) * 0.5; }

  function killMorale(world, victim, killerTeam) {
    const a = armyOf(world, victim.army); if (a) a.morale = Math.max(0, a.morale - (victim.gen ? 18 : 0.7));
    if (victim.gen) {
      const rec = genRecOf(world, victim.army);
      let castle = null, bd = Infinity;                                   // 인근 아군 성
      for (const c of world.castles) if (c.owner === victim.team) { const d = (c.x - victim.x) ** 2 + (c.y - victim.y) ** 2; if (d < bd) { bd = d; castle = c; } }
      if (rec && castle && Math.random() < escapeChance(rec.def.agility)) {  // 도망 성공 → 재주둔
        victim.gone = true; victim._escaped = true;
        rec.state = 'garrison'; rec.castle = castle.id; rec.armyId = null;
        castle.garrison.push(rec);
      } else if (rec) { rec.state = 'dead'; }
      if (a) { a.morale = 0; a._disband = true; }                         // 장수 잃음 → 잔여 부대 사기0·해산(흩어져 소멸)
    }
    // 같은 팀 인접 부대 사기 소폭 하락, 상대 소폭 상승
    for (const b of world.armies) if (b.team === killerTeam) b.morale = Math.min(100, b.morale + (victim.gen ? 3 : 0.15));
  }

  function applyHit(world, t, dmg, killerTeam) {
    if (!t || !t.alive || t.gone) return;
    const tfs = FORM_STATS[t.form] || FORM_STATS['방진'];
    t.hp -= dmg * tfs.taken * terrainAt(world, t.x, t.y).taken;   // 지형: 피격 지점 방어 보정
    world.flashes.push({ x: t.x, y: t.y, ttl: 0.12 });
    if (t.hp <= 0 && t.alive) { t.alive = false; killMorale(world, t, killerTeam); }
  }

  function castSkill(world, g) {
    const pow = skillPow(g.intellect), foes = world.soldiers.filter((s) => s.team !== g.team && s.alive && !s.gone);
    // 근처 적만 대상(맵 전체 아님)
    let tx = g.x, ty = g.y;
    const near = foes.filter((f) => (f.x - g.x) ** 2 + (f.y - g.y) ** 2 < (AGGRO * 1.4) ** 2);
    if (!near.length) return;
    if (g.skill === '강타') { let b = null, bd = Infinity; for (const f of near) { const d = (f.x - g.x) ** 2 + (f.y - g.y) ** 2; if (d < bd) { bd = d; b = f; } } if (b) { applyHit(world, b, g.atk * 2.0 * pow, g.team); tx = b.x; ty = b.y; } }
    else if (g.skill === '연격') { const R2 = 48 * 48; for (const f of near) if ((f.x - g.x) ** 2 + (f.y - g.y) ** 2 <= R2) applyHit(world, f, g.atk * 0.6 * pow, g.team); }
    else if (g.skill === '저격') { let b = null, bv = Infinity; for (const f of near) { const v = f.hp * (f.gen ? 0.5 : 1); if (v < bv) { bv = v; b = f; } } if (b) { applyHit(world, b, g.atk * 1.8 * pow, g.team); tx = b.x; ty = b.y; } }
    else if (g.skill === '분기') { const a = armyOf(world, g.army); if (a) { a.morale = Math.min(100, a.morale + 10 * pow); let n = Math.ceil(1.5 * pow); for (const m of a.members) { if (n <= 0) break; if (!m.gen && !m.formed && m.alive && !m.gone) { m.formed = true; m.atk = m.baseAtk; m._sx = 0; m._sy = 0; n--; } } } }
    else return;
    world.skillFx.push({ name: g.skill, x: tx, y: ty, gx: g.x, gy: g.y, team: g.team, ttl: 1.1 });
  }

  // ── 밤/낮 시계 (Track A: 가짜 시계. 서버판에선 서버 시간으로 대체) ──
  function updateDayNight(world, dt) {
    const len = world.dayLen || DAY_LEN;
    world.clock = (world.clock || 0) + dt;
    world.tod = (world.clock % len) / len;                                  // 0~1(하루 진행)
    world.night = world.tod >= (1 - (world.nightFrac || NIGHT_FRAC));       // 후반부 = 밤
  }

  // 피로도(0=팔팔 ~ 100=탈진) → 공격 배수. 기획: 피로 0 = 전투력 100%(보너스 아님), 과로 시 패널티.
  function fatigueAtk(f) { return Math.max(0.7, Math.min(1.0, 1.0 - (f / 100) * 0.30)); }   // f0=1.0 / f100=0.70

  // 야습 성공 확률: 공격측 지력·기동(기습) vs 수비측 통솔·지력(경계). 야간·방심·지형 보정.
  function raidChance(world, atk, def) {
    const A = atk.gen || {}, D = def.gen || {};
    const strike = (A.intellect || 60) * 0.6 + (A.agility || 60) * 0.4;
    const guard = (D.command || 60) * 0.55 + (D.intellect || 60) * 0.45;
    let p = 0.5 + (strike - guard) * 0.006;                                 // 능력차 ±
    if (world.night) p += 0.18;                                             // 야간 보너스
    if (!def.aware) p += 0.22;                                              // 방심(야간 숙영) 보너스
    const tt = typeAt(world, def.order.x, def.order.y);                     // 매복 지형(숲·산)
    if (tt === '숲' || tt === '산악') p += 0.12;
    if (A._setFx) p += A._setFx.raid || 0;                                  // 책사 세트: 야습 성공↑
    p += ((def.fatigue || 0) / 100) * 0.15;                                 // 과로한 적일수록 야습에 취약
    return Math.max(0.05, Math.min(0.95, p));
  }

  // 야습 실행: 성공 시 대상 혼란 + 사기 충격. 실패 시 대상 각성(경계). armyId로 호출(수동/자동 공용).
  function tryRaid(world, attackerId, defenderId, rng) {
    rng = rng || Math.random;
    const a = armyOf(world, attackerId), d = armyOf(world, defenderId);
    if (!a || !d || a.team === d.team || a._merged || d._merged) return false;
    a._raidCd = RAID_CD;
    if (rng() < raidChance(world, a, d)) {
      d.confused = true; d.confuseT = CONFUSE_DUR; d.camp = false; d.aware = true;
      d.morale = Math.max(0, d.morale - 26);                                // 기습 충격
      world.flashes.push({ x: d.order.x, y: d.order.y, ttl: 0.35, raid: true });
      return true;
    }
    d.camp = false; d.aware = true;                                         // 발각 → 적 각성
    return false;
  }

  // 자동 야습 감지: 활동 중인 부대가 숙영·방심한 적에 접근하면 확률 발동(주로 밤).
  function detectRaids(world, dt, rng) {
    rng = rng || Math.random;
    for (const a of world.armies) {
      if (a._merged || a.rout || a.confused || a.camp) continue;            // 공격측은 활동/각성 상태여야
      if (a._raidCd > 0) { a._raidCd -= dt; continue; }
      for (const d of world.armies) {
        if (d.team === a.team || d._merged || d.confused) continue;
        if (!(d.camp || !d.aware)) continue;                               // 대상은 숙영/방심 상태만
        if ((d.order.x - a.order.x) ** 2 + (d.order.y - a.order.y) ** 2 > RAID_R * RAID_R) continue;
        if (rng() < 0.9 * dt) { tryRaid(world, a.id, d.id, rng); break; }
      }
    }
  }

  // 숙영 토글: 정지·휴식. 피로 회복이 빨라지나(특히 밤) 야습에 취약해진다.
  function setCamp(world, armyId, on) { const a = armyOf(world, armyId); if (a && !a._merged) { a.camp = !!on; if (on) a.target = null; } }

  // ── 부대 방침(Stance) — 큰 방향만 정하면 통솔/AI가 세부 처리 (요구사항 v4 §6) ──
  const STANCES = ['진군', '대기', '방어', '정찰', '선발', '우회', '야습', '매복', '후퇴', '합류'];
  function centroidOf(a) { let x = 0, y = 0, n = 0; for (const m of a.members) if (m.alive && !m.gone && !m.gen) { x += m.x; y += m.y; n++; } return n ? { x: x / n, y: y / n } : null; }
  function nearestCastle(world, team, x, y) { let c = null, bd = Infinity; for (const k of world.castles) if (k.owner === team) { const d = (k.x - x) ** 2 + (k.y - y) ** 2; if (d < bd) { bd = d; c = k; } } return c; }
  function setStance(world, armyId, st) { const a = armyOf(world, armyId); if (a && STANCES.includes(st)) { a.stance = st; a._flow = null; } }
  // 방침별 행동: 이동 목표(order) 재설정 + 플래그(_hold 정지 / _noEngage 비교전 / _stanceSpd 속도).
  function applyStance(world, a) {
    a._hold = false; a._noEngage = false; a._stanceSpd = 1;
    const cen = centroidOf(a); if (!cen) return;
    switch (a.stance) {
      case '대기': case '방어': a._hold = true; break;                       // 현 위치 유지(방어는 성 근처면 수성)
      case '정찰': a._noEngage = true; a._stanceSpd = 1.12; break;           // 교전 회피 + 기민
      case '선발': a._stanceSpd = 1.25; break;                               // 본대보다 앞서 빠르게
      case '후퇴': { const c = nearestCastle(world, a.team, cen.x, cen.y); if (c) { a.order.x = c.x; a.order.y = c.y; } a._noEngage = true; a._stanceSpd = 1.15; break; }
      case '합류': { let t = null, bd = Infinity; for (const b of world.armies) { if (b === a || b.team !== a.team || b._merged) continue; const bc = centroidOf(b); if (bc) { const d = (bc.x - cen.x) ** 2 + (bc.y - cen.y) ** 2; if (d < bd) { bd = d; t = bc; } } } if (t) { a.order.x = t.x; a.order.y = t.y; } break; }
      case '야습': { if (world.night) { let t = null, bd = Infinity; for (const b of world.armies) { if (b.team === a.team || b._merged || !(b.camp || !b.aware)) continue; const bc = centroidOf(b); if (bc) { const d = (bc.x - cen.x) ** 2 + (bc.y - cen.y) ** 2; if (d < bd) { bd = d; t = bc; } } } if (t) { a.order.x = t.x; a.order.y = t.y; } } break; }
      case '매복': { const tt = typeAt(world, cen.x, cen.y); a.camp = (tt === '숲' || tt === '산악'); break; }   // 엄폐 지형에서 은폐 대기
      default: break;                                                        // 진군·우회 = 기본 행군
    }
  }

  function step(world, dt, rng) {
    if (world.winner || world.duelRequest) return;   // 턴제 일기토 진행 중엔 전쟁 정지
    rng = rng || Math.random;
    dt = Math.min(dt, 0.05); world.time += dt;
    updateDayNight(world, dt);

    // 부대 사기 → 붕괴(패주). 통솔 높을수록 늦게 무너지고 빨리 수습(전 프레임 _engaged 사용).
    for (const a of world.armies) {
      applyStance(world, a);                           // 부대 방침 → 이동목표·플래그 갱신
      const cmd = (a.gen && a.gen.command) || 60;
      const routThresh = 34 - cmd * 0.14;              // 통솔100→20, 50→27, 0→34
      if (a.morale <= 0) a._r = true;
      else if (a.morale < routThresh && !a._r && rng() < 0.6 * dt) a._r = true;
      if (a.morale >= routThresh + 22) a._r = false;   // 충분히 수습되면 재정비
      a.rout = a.morale <= 0 || a._r;
      // 진형 방향: 부대 무게중심 → 명령지점 방향으로 정렬(이동 중일 때 갱신, 도착하면 유지)
      let cxx = 0, cyy = 0, n = 0; for (const m of a.members) if (m.alive && !m.gone && !m.gen) { cxx += m.x; cyy += m.y; n++; }
      if (n) { cxx /= n; cyy /= n; const hx = a.order.x - cxx, hy = a.order.y - cyy; if (hx * hx + hy * hy > 400) a._ang = Math.atan2(hy, hx) + Math.PI / 2; }
      if (a._ang == null) a._ang = a.team === 'player' ? 0 : Math.PI;   // 기본 정면(진형은 -y가 앞 → 회전 기준)
      const ogx = (a.order.x / NAV) | 0, ogy = (a.order.y / NAV) | 0;   // 플로우 필드(장애물 우회) — 목표 셀 변경 시 재계산
      if (!a._flow || a._fgx !== ogx || a._fgy !== ogy) { a._flow = computeFlow(world, ogx, ogy); a._fgx = ogx; a._fgy = ogy; }
    }

    // ── 일기토(무장 결투) — 진행 처리 + 신규 감지 ──
    procDuels(world, dt, rng);
    detectDuels(world, dt, rng);
    // ── 야습 — 숙영/방심한 적을 활동 부대가 기습 → 혼란 ──
    detectRaids(world, dt, rng);

    for (const s of world.soldiers) {
      if (!s.alive || s.gone) continue;
      if (s.duel) continue;                    // 일기토 중인 장수는 정상 행동 정지(결투에 몰입)
      const army = armyOf(world, s.army);
      const spdMul = army ? (army._spdMul || 1) * (army._marchMul || 1) * (army._stanceSpd || 1) : 1;   // 혼란·기병세트·방침 이동 배수
      const routing = army && (army.rout || army._r);
      s.flee = routing;

      if (s.flee) {                       // 패주 — 자기 진영으로 흩어져 후퇴
        const dir = s.team === 'player' ? 1 : -1;
        if (s._fd == null) s._fd = rng() < 0.5 ? -1 : 1;
        stepMove(world, s, (s._fd + (rng() - 0.5)) * s.spd * 0.45 * dt, dir * s.spd * 1.15 * dt);   // 좌우 산개 + 벽 회피
        s.target = null;
        if (army && army._disband) {                              // 장수 잃은 부대 → 흩어져 소멸
          s._fleeT = (s._fleeT || 0) + dt;
          if (s._fleeT > 1.5 + (s.army % 6) * 0.25 || s.y < -14 || s.y > world.H + 14) s.gone = true;
        }
        continue;
      }

      const tz = terrainAt(world, s.x, s.y);   // 현재 밟은 지형 효과
      // 표적: 접적(ENGAGE) 반경 안에서만 새로 획득 → 그 전엔 진형 유지 행군. 한번 물면 AGGRO까지 추격.
      const range2 = s.range > 40 ? (s.range * 1.1) ** 2 : AGGRO * AGGRO;   // 궁병은 사거리, 근접은 추격반경
      let t = s.target;
      if (t && (!t.alive || t.gone || t.flee || ((t.x - s.x) ** 2 + (t.y - s.y) ** 2) > range2)) t = null;
      s.rt -= dt;
      if (!t && s.rt <= 0 && !(army && army._noEngage)) {   // 정찰·후퇴는 교전 회피
        s.rt = 0.16 + rng() * 0.14;
        const acq2 = s.range > 40 ? (s.range * 1.05) ** 2 : ENGAGE * ENGAGE;  // 접적 반경(궁병은 사거리 내)
        let best = null, bd = acq2;
        for (const o of world.soldiers) {
          if (o.team === s.team || !o.alive || o.gone || o.flee) continue;
          const d = (o.x - s.x) ** 2 + (o.y - s.y) ** 2;
          if (d < bd) { bd = d; best = o; }
        }
        t = best;
      }
      s.target = t;

      if (t) {                            // 난전 — 표적 접적·추격·공격
        if (army) army._engaged = true;   // 이 부대는 전투 중(사기 회복 차단)
        const dx = t.x - s.x, dy = t.y - s.y, d = Math.hypot(dx, dy) || 1;
        if (d > s.range) { const st = s.spd * spdMul * tz.spd * dt; stepMove(world, s, dx / d * st, dy / d * st); }
        else {
          s.cd -= dt;
          if (s.cd <= 0) {
            s.cd = s.cdMax;
            const fs = FORM_STATS[s.form] || FORM_STATS['방진'];
            let dmg = s.atk * typeMult(s.troop, t.troop) * (0.8 + rng() * 0.4) * fs.atk * formCounter(s.form, t.form)
              * tz.atk * (s.troop === '기병' ? tz.cav : 1)   // 지형: 공격·기병 보정
              * (army ? (army._atkMul || 1) : 1);            // 피로도·혼란 배수
            if (s.range > 40) world.projectiles.push({ x: s.x, y: s.y, dx: 0, dy: 0, target: t, dmg, team: s.team, ttl: 0 });
            else applyHit(world, t, dmg, s.team);
          }
        }
      } else if (army && !army.camp && !army._hold) {   // 숙영·대기/방어면 제자리(행군 안 함)
        // 공성 밀착: 근처 적 성이 있으면 성벽으로 달라붙는다(진형보다 우선)
        let ec = null, ecd = (CAP_R * 2.4) ** 2;
        for (const c of world.castles) { if (c.owner === s.team) continue; const d = (c.x - s.x) ** 2 + (c.y - s.y) ** 2; if (d < ecd) { ecd = d; ec = c; } }
        if (ec) {
          if (army) army._engaged = true;                 // 공성 중 = 전투로 취급(사기 회복 차단)
          const dx = ec.x - s.x, dy = ec.y - s.y, d = Math.hypot(dx, dy) || 1;
          if (d > CAP_R * 0.5) { const st = s.spd * tz.spd * dt; stepMove(world, s, dx / d * st, dy / d * st); }   // 성벽까지 밀착
        } else {                            // 행군 — 멀면 플로우 필드로 장애물 우회(협로 병목), 가까우면 진형 슬롯(회전) 정렬
          const gd2 = (army.order.x - s.x) ** 2 + (army.order.y - s.y) ** 2;
          if (gd2 > (NAV * 2.2) ** 2 && army._flow) {
            const n = world._nav, cgx = Math.max(0, Math.min(n.gw - 1, (s.x / NAV) | 0)), cgy = Math.max(0, Math.min(n.gh - 1, (s.y / NAV) | 0));
            let bcx = -1, bcy = -1, bd = army._flow[cgy * n.gw + cgx]; if (bd < 0) bd = 1e9;
            for (const [dx2, dy2] of NB8) {
              const nx = cgx + dx2, ny = cgy + dy2; if (nx < 0 || ny < 0 || nx >= n.gw || ny >= n.gh) continue;
              const v = army._flow[ny * n.gw + nx]; if (v < 0) continue;
              if (dx2 && dy2 && (n.blk[cgy * n.gw + nx] || n.blk[ny * n.gw + cgx])) continue;
              if (v < bd) { bd = v; bcx = nx; bcy = ny; }
            }
            const tx = bcx >= 0 ? (bcx + 0.5) * NAV : army.order.x, ty = bcx >= 0 ? (bcy + 0.5) * NAV : army.order.y;
            const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1, st = s.spd * spdMul * tz.spd * dt;
            stepMove(world, s, dx / d * st, dy / d * st);
          } else {
            const ca = Math.cos(army._ang || 0), sa = Math.sin(army._ang || 0);
            const ox = s.off.dx + (s._sx || 0), oy = s.off.dy + (s._sy || 0);
            const tx = army.order.x + (ox * ca - oy * sa), ty = army.order.y + (ox * sa + oy * ca);
            const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
            if (d > 3) { const st = Math.min(d, s.spd * spdMul * tz.spd * dt); stepMove(world, s, dx / d * st, dy / d * st); }
          }
        }
      }
    }

    // 장수 스킬
    for (const s of world.soldiers) { if (!s.gen || !s.alive || s.gone || s.flee || !s.skill) continue; s.skillCd -= dt; if (s.skillCd <= 0) { s.skillCd = s.skillCdMax; castSkill(world, s); } }

    // 투사체
    const PSPD = 380;
    for (const p of world.projectiles) {
      const t = p.target;
      if (!t || !t.alive || t.gone) { p.dead = true; continue; }
      const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy) || 1; p.dx = dx / d; p.dy = dy / d;
      const st = PSPD * dt;
      if (d <= st + 6) { applyHit(world, t, p.dmg * terrainAt(world, t.x, t.y).ranged, p.team); p.dead = true; }   // 숲 등 엄폐 시 원거리 감쇠
      else { p.x += p.dx * st; p.y += p.dy * st; }
      p.ttl += dt; if (p.ttl > 3) p.dead = true;
    }
    world.projectiles = world.projectiles.filter((p) => !p.dead);

    // 분리(겹침 방지)
    const sq = SEP * SEP;
    for (let i = 0; i < world.soldiers.length; i++) {
      const a = world.soldiers[i]; if (!a.alive || a.gone || a.flee) continue;
      for (let j = i + 1; j < world.soldiers.length; j++) {
        const b = world.soldiers[j]; if (!b.alive || b.gone || b.team !== a.team) continue;
        const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < sq) { const d = Math.sqrt(d2), pu = (SEP - d) * 0.5, ux = dx / d, uy = dy / d;
          const ax = a.x + ux * pu, ay = a.y + uy * pu; if (passableAt(world, ax, ay)) { a.x = ax; a.y = ay; }   // 통과불가로 밀어넣지 않음
          const bx = b.x - ux * pu, by = b.y - uy * pu; if (passableAt(world, bx, by)) { b.x = bx; b.y = by; }
        }
      }
    }
    // 낀 유닛 강제 탈출(통과불가 안이면 가장 가까운 통행 셀로) — 산/강 끼임 방지
    const nv = world._nav;
    if (nv) for (const s of world.soldiers) {
      if (!s.alive || s.gone) continue;
      if (!passableAt(world, s.x, s.y)) {
        const gi = nearestPassableCell(nv, (s.x / NAV) | 0, (s.y / NAV) | 0);
        if (gi >= 0) { const tx = ((gi % nv.gw) + 0.5) * NAV, ty = (((gi / nv.gw) | 0) + 0.5) * NAV, dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1, st = Math.min(d, s.spd * 2.2 * dt); s.x += dx / d * st; s.y += dy / d * st; }
      }
    }
    // 맵 경계
    for (const s of world.soldiers) { if (s.x < 6) s.x = 6; if (s.x > world.W - 6) s.x = world.W - 6; if (s.y < 6) s.y = 6; if (s.y > world.H - 6) s.y = world.H - 6; }

    // 사기 회복 + 피로도/숙영/혼란·와해 상태 (_engaged가 유효한 이 시점에서 갱신)
    for (const a of world.armies) {
      const cmd = (a.gen && a.gen.command) || 60;
      if (a.camp && a._engaged) a.camp = false;                                  // 교전 시작 → 숙영 자동 해제
      if (a.confused) {                                                          // 혼란: 사기 잠식 → 미수습 시 와해
        a.confuseT -= dt;
        a.morale = Math.max(0, a.morale - 3.2 * dt);
        if (a.confuseT <= 0) a.confused = false;                                // 버텨내면 수습
        if (a.morale <= 8 && !a._disband) { a.collapsed = true; a._disband = true; a.morale = 0; }   // 와해(붕괴)
      }
      const resting = a.camp && !a._engaged && !a.confused;
      if (resting) a.fatigue = Math.max(0, a.fatigue - (world.night ? 16 : 9) * dt);   // 숙영 회복(밤에 빠름)
      else a.fatigue = Math.min(100, a.fatigue + (a._engaged ? 3.2 : 1.4) * dt);       // 행군·교전 시 누적
      a.aware = !(a.camp && world.night && !a.confused);                        // 야간 숙영 = 방심(야습 취약)
      a._atkMul = fatigueAtk(a.fatigue) * (a.confused ? 0.5 : 1);               // 다음 틱 공격 배수
      a._spdMul = a.confused ? 0.55 : 1;                                        // 혼란 시 이동 저하
      if (!a._engaged && !a._disband && !a.confused && a.morale < 75) a.morale = Math.min(75, a.morale + (1.2 + cmd * 0.045) * dt);   // 해산·혼란 부대는 회복 안 함
      a._engaged = false;
    }

    // 이펙트 수명
    for (const f of world.flashes) f.ttl -= dt; world.flashes = world.flashes.filter((f) => f.ttl > 0);
    for (const k of world.skillFx) k.ttl -= dt; world.skillFx = world.skillFx.filter((k) => k.ttl > 0);

    // 재입성: 필드 부대 장수가 '목적지인 아군 성'에 도달하면 흡수(재정비). 교전/패주 중엔 불가.
    for (const a of world.armies) {
      if (a._merged || a.rout) continue;
      const g = a.members.find((m) => m.gen && m.alive && !m.gone);
      if (!g) continue;
      for (const c of world.castles) {
        if (c.owner !== a.team) continue;
        if ((c.x - a.order.x) ** 2 + (c.y - a.order.y) ** 2 > CAP_R * CAP_R) continue;   // 이 성이 명령 목적지일 때만
        if ((g.x - c.x) ** 2 + (g.y - c.y) ** 2 > CAP_R * CAP_R) continue;               // 도달했나
        regarrison(world, a.id, c.id); break;
      }
    }

    // 성: 병력 생산(민심 비례) + 점령 판정
    for (const c of world.castles) {
      let own = 0, foeTeam = null, foeN = 0;
      for (const s of world.soldiers) {
        if (!s.alive || s.gone || s.flee) continue;
        if ((s.x - c.x) ** 2 + (s.y - c.y) ** 2 > CAP_R * CAP_R) continue;
        if (s.team === c.owner) own++;
        else { foeTeam = s.team; foeN++; }
      }
      const besieged = c.owner && foeN > 0 && own === 0;         // 수비병 없이 포위됨
      if (c.owner && !besieged) {                                // 포위 중엔 충원 중단(보급 차단) → 장수만 남은 부대도 시간 들이면 함락
        const mf = 0.3 + (c.min / 100) * 0.95;                  // 민심 → 충원 계수(0.3~1.25)
        c.troops = Math.min(c.troopMax, c.troops + c.prod * mf * dt);
      }
      // 공성전: 적이 성 반경에 있으면 성벽이 반격(적 병력 소모). 수비병 없으면 주둔군·민심 소모→함락.
      if (foeN > 0 && c.owner) {
        const wallDps = (5.5 + (c.troops / c.troopMax) * 5) * dt;    // 성벽 반격(주둔군 많을수록 강)
        const SR2 = (CAP_R * 2.1) ** 2;                              // 사격 반경(점령 반경보다 넓게)
        for (const s of world.soldiers) {
          if (!s.alive || s.gone || s.flee || s.team === c.owner) continue;
          if ((s.x - c.x) ** 2 + (s.y - c.y) ** 2 > SR2) continue;
          applyHit(world, s, wallDps, c.owner);
        }
        if (own === 0) {                                             // 수비병 없음 → 공성 진행
          c.troops -= foeN * 55 * dt;                               // 주둔군 소모
          c.min = Math.max(0, c.min - (1.4 + foeN * 0.12) * dt);    // 민심 동요
          c.hp = Math.max(0, Math.min(c.troops / c.troopMax, c.min / 100)) * 100;  // 공성 게이지(UI용)
          if (c.troops <= 0 || c.min <= 0) {                        // 함락: 주둔군0 또는 민심0
            for (const r of c.garrison) { r.state = 'dead'; r.castle = null; }     // 주둔 장수 포로
            c.garrison = []; c.owner = foeTeam; c.troops = 800; c.min = 25; c.hp = 100;
          }
        }
      } else if (c.owner) {
        c.min = Math.min(88, c.min + 1.4 * dt);                     // 평시 민심 회복
        c.hp = 100;
      }
    }

    // 승패: 상대 성이 하나도 없으면 종료
    const pc = world.castles.filter((c) => c.owner === 'player').length;
    const ec = world.castles.filter((c) => c.owner === 'enemy').length;
    if (ec === 0) world.winner = 'player';
    else if (pc === 0) world.winner = 'enemy';
  }

  const RTS = { createWorld, step, stepDuels, moveArmy, sortie, regarrison, armyOf, genRecOf, aliveCount, makeArmy, terrainAt, TERRAIN, AGGRO, CAP_R,
    setCamp, tryRaid, raidChance, detectRaids, fatigueAtk, applyDuelResult, resolveDuelAuto, setStance, STANCES, RAID_R, CONFUSE_DUR, DAY_LEN, DUEL_R };
  if (typeof module !== 'undefined' && module.exports) module.exports = RTS;
  if (typeof window !== 'undefined') window.RTS = RTS;
})();
