// 스킬킷 일기토 엔진 (RAID: 그림자의 전설식). 장수마다 액티브 스킬 1~4 + 고유 특성(패시브).
// DOM 없음(Node 검증 가능). 같은 rng면 같은 결과. engine.js의 typeMult/maxHpOf 재사용.
(function () {
  const Engine = (typeof require !== 'undefined') ? require('./engine.js') : window.Engine;
  const typeMult = Engine.typeMult, maxHpOf = Engine.maxHpOf;

  // ── 스킬 라이브러리 (액티브) ──
  const SKILLS = {
    strike:  { name: '공격', cd: 0, kind: 'atk', mult: 1.0, desc: '기본 타격' },
    heavy:   { name: '강타', cd: 2, kind: 'atk', mult: 2.0, desc: '단일 강타 ×2' },
    flurry:  { name: '연격', cd: 2, kind: 'atk', mult: 0.75, hits: 2, desc: '2연격' },
    snipe:   { name: '저격', cd: 2, kind: 'atk', mult: 1.8, pierce: 0.5, desc: '급소 저격(방어 관통)' },
    pierce:  { name: '관통', cd: 2, kind: 'atk', mult: 1.5, pierce: 0.7, desc: '방어 관통 일격' },
    crush:   { name: '분쇄', cd: 3, kind: 'atk', mult: 2.4, desc: '필살 분쇄' },
    rally:   { name: '분기', cd: 3, kind: 'buff', mult: 1.3, amt: 0.25, turns: 2, desc: '타격 + 공격력↑' },
    warcry:  { name: '함성', cd: 3, kind: 'selfbuff', amt: 0.35, turns: 3, desc: '공격력 대폭↑ 3턴' },
    guard:   { name: '방어', cd: 1, kind: 'guard', turns: 1, desc: '받는 피해 절반 1턴' },
    fire:    { name: '화계', cd: 3, kind: 'dot', mult: 0.8, dot: 0.08, dotTurns: 3, desc: '타격 + 화상(3턴)' },
    confuse: { name: '교란', cd: 3, kind: 'debuff', turns: 2, desc: '적 약화(피해↓ 2턴)' },
    heal:    { name: '정비', cd: 3, kind: 'heal', pct: 0.22, desc: '체력 회복' },
  };
  // ── 고유 특성(패시브) ──
  const PASSIVES = {
    charge:  { name: '돌격', desc: '첫 공격 피해 +50%' },
    aim:     { name: '정밀', desc: '치명타 확률 +20%' },
    valor:   { name: '맹공', desc: 'HP 50% 미만 시 피해 +25%' },
    bulwark: { name: '견고', desc: '받는 피해 −15%' },
    sage:    { name: '지장', desc: '스킬(비기본) 피해 +20%' },
    swift:   { name: '질풍', desc: '회피 확률 15%' },
  };

  const skillMap = { 강타: 'heavy', 연격: 'flurry', 분기: 'rally', 저격: 'snipe' };
  // 스탯/병종/등급으로 스킬킷 + 패시브 자동 구성(수동 미지정 시). 명장은 나중에 오버라이드 가능.
  function buildKit(def) {
    if (def._kit) return def._kit;
    const kit = ['strike'];
    if (def.skill && skillMap[def.skill]) kit.push(skillMap[def.skill]);
    if (def.stratagem === '화계') kit.push('fire');
    else if (def.stratagem === '교란') kit.push('confuse');
    else if (def.intellect >= 85) kit.push('fire');
    else if (def.command >= 82) kit.push('guard');
    else if (def.might >= 88) kit.push('pierce');
    else kit.push('guard');
    if (def.rarity >= 5) kit.push(def.might >= 90 ? 'crush' : (def.intellect >= 88 ? 'heal' : 'warcry'));
    // 중복 제거
    const uniq = []; for (const s of kit) if (!uniq.includes(s)) uniq.push(s);
    let passive;
    if (def.rarity >= 6) passive = def.might >= 90 ? 'valor' : 'sage';
    else if (def.troop === '기병') passive = 'charge';
    else if (def.troop === '궁병') passive = 'aim';
    else if (def.command >= 82) passive = 'bulwark';
    else if (def.might >= 85) passive = 'valor';
    else if (def.intellect >= 85) passive = 'sage';
    else passive = 'swift';
    def._kit = { skills: uniq.slice(0, 4), passive };
    return def._kit;
  }

  const DUEL_HP_MUL = 2.4;   // 일기토는 스킬·쿨다운이 의미 있게 여러 합 오가도록 체력 가중
  function makeHero(def, side) {
    const kit = buildKit(def), hp = Math.round(maxHpOf(def) * DUEL_HP_MUL);
    return { def, side, name: def.name, faction: def.faction, troop: def.troop,
      might: def.might, command: def.command, intellect: def.intellect, agility: def.agility,
      hp, maxHp: hp, alive: true, kit: kit.skills, passive: kit.passive, cds: {}, buffs: [], firstAtk: true };
  }
  // 국가 시너지(RQ-V4-008 상품성): 같은 진영 2명↑ → 공격 버프(2명+5%/3명+10%/4명+15%).
  function applySynergy(heroes) {
    const cnt = {}; for (const h of heroes) cnt[h.faction] = (cnt[h.faction] || 0) + 1;
    for (const h of heroes) { const n = cnt[h.faction] || 1; if (n >= 2) { h.buffs.push({ type: 'atk', amt: 0.05 * (n - 1), turns: 9999 }); h.synergy = n; } }
  }
  // 1:1 또는 N:N(최대 4:4). pDefs/eDefs는 def 또는 def 배열.
  function createDuel(pDefs, eDefs, opts) {
    opts = opts || {};
    const P = (Array.isArray(pDefs) ? pDefs : [pDefs]).filter(Boolean);
    const E = (Array.isArray(eDefs) ? eDefs : [eDefs]).filter(Boolean);
    const teams = { p: P.map((d) => makeHero(d, 'p')), e: E.map((d) => makeHero(d, 'e')) };
    applySynergy(teams.p); applySynergy(teams.e);
    const order = [...teams.p, ...teams.e].sort((a, b) => (b.agility - a.agility) || 0);
    return { teams, p: teams.p[0], e: teams.e[0], order, idx: 0, round: 1, turn: 0,
      maxTurns: opts.maxTurns || (P.length + E.length) * 30,
      log: [], finished: false, winner: null, morale: { p: 50, e: 50 }, rng: opts.rng || Math.random };
  }
  const foesOf = (duel, h) => duel.teams[h.side === 'p' ? 'e' : 'p'].filter((x) => x.alive);
  function lowestHpEnemy(duel, h) { const f = foesOf(duel, h); return f.length ? f.reduce((a, b) => (b.hp < a.hp ? b : a), f[0]) : null; }
  function teamHp(duel, s) { const t = duel.teams[s]; return t.reduce((a, h) => a + Math.max(0, h.hp), 0) / t.reduce((a, h) => a + h.maxHp, 0); }
  function skillReady(actor, id) { return !(actor.cds[id] > 0); }

  function applyDmg(duel, target, dmg) {
    target.hp -= dmg;
    if (target.hp <= 0 && target.alive) { target.hp = 0; target.alive = false; duel.log.push(`💀 ${target.name} 쓰러짐!`); }
  }
  function calcDamage(duel, actor, target, sk) {
    const rng = duel.rng; let mult = sk.mult || 1;
    for (const b of actor.buffs) { if (b.type === 'atk') mult *= (1 + b.amt); if (b.type === 'weak') mult *= 0.7; }
    if (actor.passive === 'sage' && sk.cd > 0) mult *= 1.2;
    if (actor.passive === 'charge' && actor.firstAtk) mult *= 1.5;
    if (actor.passive === 'valor' && actor.hp < actor.maxHp * 0.5) mult *= 1.25;
    if (target.passive === 'swift' && rng() < 0.15) return { dmg: 0, dodged: true };
    const tp = typeMult(actor.troop, target.troop), variance = 0.9 + rng() * 0.2, pierce = sk.pierce || 0;
    let critC = 0.1; if (actor.passive === 'aim') critC += 0.2;
    const crit = rng() < critC;
    let dmg = actor.might * 5 * mult * tp * variance * (100 / (100 + target.command * (1 - pierce)));
    if (crit) dmg *= 1.5;
    for (const b of target.buffs) if (b.type === 'guard') dmg *= 0.5;
    if (target.passive === 'bulwark') dmg *= 0.85;
    return { dmg: Math.max(1, Math.round(dmg)), crit };
  }

  // 액티브 스킬 예상 최대 피해(AI 판단용, 평균치)
  function estimate(duel, actor, target, id) {
    const sk = SKILLS[id]; if (!sk || (sk.kind !== 'atk' && sk.kind !== 'buff' && sk.kind !== 'dot')) return 0;
    let mult = sk.mult || 1; if (actor.passive === 'valor' && actor.hp < actor.maxHp * 0.5) mult *= 1.25;
    const tp = typeMult(actor.troop, target.troop);
    return actor.might * 5 * mult * (sk.hits || 1) * tp * (100 / (100 + target.command * (1 - (sk.pierce || 0))));
  }

  // 턴 시작 처리: 쿨다운·화상(DoT)·버프 감소. (해당 액터가 행동하기 직전 호출)
  function beginTurn(duel) {
    if (duel.finished) return;
    const actor = duel.order[duel.idx];
    for (const k in actor.cds) if (actor.cds[k] > 0) actor.cds[k]--;
    for (const b of actor.buffs) if (b.type === 'dot') { const d = Math.round(actor.maxHp * b.amt); applyDmg(duel, actor, d); duel.log.push(`🔥 ${actor.name} 화상 ${d}`); }
    actor.buffs.forEach((b) => b.turns--); actor.buffs = actor.buffs.filter((b) => b.turns > 0);
    checkEnd(duel);
  }

  function useSkill(duel, id) {
    if (duel.finished) return;
    const actor = duel.order[duel.idx]; if (!actor.alive) return advance(duel);
    const target = lowestHpEnemy(duel, actor); if (!target) { checkEnd(duel); return; }
    const sk = SKILLS[id];
    if (!sk || !skillReady(actor, id)) id = 'strike';
    const s = SKILLS[id];
    let msg = `${actor.name} · ${s.name}`;
    if (s.kind === 'atk' || s.kind === 'buff' || s.kind === 'dot') {
      const hits = s.hits || 1; let total = 0, anyCrit = false, dodged = false;
      for (let h = 0; h < hits; h++) { const r = calcDamage(duel, actor, target, s); if (r.dodged) { dodged = true; continue; } total += r.dmg; anyCrit = anyCrit || r.crit; applyDmg(duel, target, r.dmg); if (!target.alive) break; }
      actor.firstAtk = false;
      msg += dodged && total === 0 ? ` — ${target.name} 회피!` : ` → ${target.name} ${total}${anyCrit ? ' (치명타!)' : ''}`;
      if (s.kind === 'buff') { actor.buffs.push({ type: 'atk', amt: s.amt, turns: s.turns }); msg += ' · 공격력↑'; duel.morale[actor.side] = Math.min(100, duel.morale[actor.side] + 8); }
      if (s.kind === 'dot' && target.alive) { target.buffs.push({ type: 'dot', amt: s.dot, turns: s.dotTurns }); msg += ' · 화상'; }
    } else if (s.kind === 'selfbuff') { actor.buffs.push({ type: 'atk', amt: s.amt, turns: s.turns }); msg += ' — 공격력 대폭↑'; duel.morale[actor.side] = Math.min(100, duel.morale[actor.side] + 10); }
    else if (s.kind === 'guard') { actor.buffs.push({ type: 'guard', turns: s.turns }); msg += ' — 방어 태세'; duel.morale[actor.side] = Math.min(100, duel.morale[actor.side] + 5); }
    else if (s.kind === 'debuff') { target.buffs.push({ type: 'weak', turns: s.turns }); msg += ` → ${target.name} 약화`; }
    else if (s.kind === 'heal') { const h = Math.round(actor.maxHp * s.pct); actor.hp = Math.min(actor.maxHp, actor.hp + h); msg += ` — 체력 +${h}`; }
    if (s.cd > 0) actor.cds[id] = s.cd;
    duel.log.push(msg);
    checkEnd(duel);
    if (!duel.finished) advance(duel);
  }

  function advance(duel) {   // 다음 생존 장수로(사망자 건너뜀)
    for (let i = 0; i < duel.order.length; i++) {
      duel.idx = (duel.idx + 1) % duel.order.length; duel.turn++; if (duel.idx === 0) duel.round++;
      if (duel.order[duel.idx].alive) return;
    }
  }

  // AI: 마무리 가능하면 최대 피해, 위급하면 회복/방어, 아니면 준비된 강스킬.
  function aiPick(duel) {
    const actor = duel.order[duel.idx], target = lowestHpEnemy(duel, actor);
    if (!target) return 'strike';
    const ready = actor.kit.filter((id) => skillReady(actor, id));
    // 처치 가능?
    let kill = null, kd = 0; for (const id of ready) { const e = estimate(duel, actor, target, id); if (e >= target.hp && e > kd) { kd = e; kill = id; } }
    if (kill) return kill;
    if (actor.hp < actor.maxHp * 0.28 && ready.includes('heal')) return 'heal';
    if (actor.hp < actor.maxHp * 0.22 && ready.includes('guard') && duel.rng() < 0.5) return 'guard';
    const prio = ['crush', 'heavy', 'snipe', 'pierce', 'rally', 'warcry', 'flurry', 'fire', 'confuse'];
    for (const id of prio) if (ready.includes(id)) return id;
    return 'strike';
  }

  function checkEnd(duel) {
    if (duel.finished) return;
    const pA = duel.teams.p.some((h) => h.alive), eA = duel.teams.e.some((h) => h.alive);
    if (!pA || !eA) finish(duel, !pA && eA ? 'e' : (!eA && pA ? 'p' : (teamHp(duel, 'p') >= teamHp(duel, 'e') ? 'p' : 'e')), 'kill');
    else if (duel.turn >= duel.maxTurns) finish(duel, teamHp(duel, 'p') >= teamHp(duel, 'e') ? 'p' : 'e', 'timeout');
  }
  function finish(duel, winner, reason) {
    duel.finished = true; duel.winner = winner; duel.reason = reason;
    const loserSide = winner === 'p' ? 'e' : 'p', anyAlive = duel.teams[loserSide].some((h) => h.alive);
    duel.result = { winner, reason, rounds: duel.round, killed: !anyAlive,
      grade: !anyAlive ? (teamHp(duel, winner) > 0.6 ? '대승' : '승') : '판정승' };
  }

  // 헤드리스 자동 판정(전쟁 auto-resolve·테스트용): 끝까지 자동 진행.
  function auto(pDef, eDef, rng) {
    const duel = createDuel(pDef, eDef, { rng: rng || Math.random });
    let guard = 0;
    while (!duel.finished && guard++ < 500) { beginTurn(duel); if (duel.finished) break; useSkill(duel, aiPick(duel)); }
    if (!duel.finished) finish(duel, teamHp(duel, 'p') >= teamHp(duel, 'e') ? 'p' : 'e', 'cap');
    return duel;
  }

  const Duel = { SKILLS, PASSIVES, buildKit, createDuel, beginTurn, useSkill, aiPick, auto, skillReady };
  if (typeof module !== 'undefined' && module.exports) module.exports = Duel;
  if (typeof window !== 'undefined') window.Duel = Duel;
})();
