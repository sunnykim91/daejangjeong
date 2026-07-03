// 「대장정」 일기토 전투 엔진 (v1)
// GAMERULE.md 명세를 그대로 구현. DOM 의존 없음 → 브라우저/Node 양쪽에서 사용.
// 같은 시드면 같은 결과(시드 기반 난수).

// ─────────────────────────────────────────────────────────────
// 0. 시드 기반 난수 (mulberry32)
// ─────────────────────────────────────────────────────────────
function makeRNG(seed) {
  let s = seed >>> 0;
  function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range: (a, b) => a + (b - a) * next(),     // [a, b)
    int: (n) => Math.floor(next() * n),        // 0..n-1
    chance: (p) => next() < p,                 // p 확률로 true
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

// ─────────────────────────────────────────────────────────────
// 1. 병종 / 상성 / 사기 기본 상수 (명세 1·2·3장)
// ─────────────────────────────────────────────────────────────
const BASE_HP = { 보병: 1100, 창병: 1000, 기병: 850, 궁병: 750 };

// 상성 배수: 행=공격자, 열=방어자
const TYPE_TABLE = {
  보병: { 보병: 1.0, 창병: 1.0, 기병: 1.0, 궁병: 1.0 },
  창병: { 보병: 1.0, 창병: 1.0, 기병: 1.3, 궁병: 0.8 },
  기병: { 보병: 1.0, 창병: 0.8, 기병: 1.0, 궁병: 1.3 },
  궁병: { 보병: 1.0, 창병: 1.3, 기병: 0.8, 궁병: 1.0 },
};

function typeMult(att, def) {
  return TYPE_TABLE[att][def];
}

function maxHpOf(g) {
  return Math.floor(BASE_HP[g.troop] * (1 + g.command / 200));
}

// 사기 배수 (3.1): 0→0.8 / 50→1.0 / 100→1.2
function moraleMult(m) {
  return 0.8 + (m / 100) * 0.4;
}

// ─────────────────────────────────────────────────────────────
// 5.1 데미지 공식 (순수 함수 — 검증/테스트 용이)
// ─────────────────────────────────────────────────────────────
// opts: { might, typeMult, moraleMult, variance, targetCommand,
//         multiplier, crit, defending, weakened, buffed }
function rawDamage(o) {
  let d = o.might * 5
    * o.typeMult
    * o.moraleMult
    * (o.variance ?? 1)
    * (100 / (100 + o.targetCommand));
  if (o.multiplier) d *= o.multiplier;     // 스킬 배수
  if (o.crit) d *= 1.5;                     // 치명타
  if (o.buffed) d *= 1.2;                   // 분기 버프
  if (o.weakened) d *= 0.8;                 // 위축(붕괴)
  if (o.defending) d *= 0.5;                // 방어 중인 대상
  return Math.max(1, d);                    // 최소 1
}

// ─────────────────────────────────────────────────────────────
// 전투 상태 구성
// ─────────────────────────────────────────────────────────────
function makeFighter(def, team) {
  const maxHp = maxHpOf(def);
  return {
    ...def,
    team,
    maxHp,
    hp: maxHp,
    alive: true,
    cd: { skill: 0, stratagem: 0, rally: 0 },
    statuses: [],   // { type, turns }
  };
}

function hasStatus(f, type) {
  return f.statuses.some((s) => s.type === type);
}
function addStatus(f, type, turns) {
  const ex = f.statuses.find((s) => s.type === type);
  if (ex) ex.turns = Math.max(ex.turns, turns);
  else f.statuses.push({ type, turns });
}
function removeStatus(f, type) {
  f.statuses = f.statuses.filter((s) => s.type !== type);
}

// ─────────────────────────────────────────────────────────────
// 전투 객체
// ─────────────────────────────────────────────────────────────
function createBattle(roster, opts = {}) {
  const seed = opts.seed ?? 12345;
  const rng = makeRNG(seed);
  const players = roster.player.map((d) => makeFighter(d, 'player'));
  const enemies = roster.enemy.map((d) => makeFighter(d, 'enemy'));

  return {
    rng,
    seed,
    teams: { player: players, enemy: enemies },
    morale: { player: 50, enemy: 50 },   // 3장 시작값 50
    rout: { player: false, enemy: false },
    round: 0,
    maxRounds: opts.maxRounds ?? 30,
    log: [],
    finished: false,
    result: null,
    // 행동 선택 전략. 기본은 양쪽 AI(헤드리스 시뮬레이션).
    strategy: opts.strategy || { player: aiChooseAction, enemy: aiChooseAction },
  };
}

function allOf(battle) {
  return [...battle.teams.player, ...battle.teams.enemy];
}
function aliveOf(battle, team) {
  return battle.teams[team].filter((f) => f.alive);
}
function enemyTeam(team) {
  return team === 'player' ? 'enemy' : 'player';
}

function logEvent(battle, msg, kind = 'info') {
  battle.log.push({ round: battle.round, msg, kind });
}

// ─────────────────────────────────────────────────────────────
// 사기 변동 (3.2)
// ─────────────────────────────────────────────────────────────
function changeMorale(battle, team, delta) {
  battle.morale[team] = Math.max(0, Math.min(100, battle.morale[team] + delta));
}

// ─────────────────────────────────────────────────────────────
// 데미지 적용 + 사망/처치 처리 (3.2 kill ±15)
// ─────────────────────────────────────────────────────────────
function applyDamage(battle, target, dmg) {
  const amount = Math.floor(dmg);
  target.hp -= amount;
  if (target.hp <= 0 && target.alive) {
    target.hp = 0;
    target.alive = false;
    logEvent(battle, `💀 ${target.name} 전사!`, 'kill');
    // 처치: 처치한 팀 +15, 당한 팀 -15
    const killerTeam = enemyTeam(target.team);
    changeMorale(battle, killerTeam, +15);
    changeMorale(battle, target.team, -15);
  }
  return amount;
}

// ─────────────────────────────────────────────────────────────
// 공격 실행 (5.1)
// ─────────────────────────────────────────────────────────────
function performAttack(battle, attacker, target, multiplier = 1, label = '공격') {
  const crit = battle.rng.chance(0.1);                       // 치명타 10%
  const variance = battle.rng.range(0.9, 1.1);              // ±10%
  const dmg = rawDamage({
    might: attacker.might,
    typeMult: typeMult(attacker.troop, target.troop),
    moraleMult: moraleMult(battle.morale[attacker.team]),
    variance,
    targetCommand: target.command,
    multiplier,
    crit,
    buffed: hasStatus(attacker, '분기'),
    weakened: battle.rout[attacker.team],                   // 붕괴 위축 ×0.8
    defending: hasStatus(target, '방어'),
  });
  const dealt = applyDamage(battle, target, dmg);
  let txt = `${attacker.name} → ${target.name} : ${label} ${dealt} 피해`;
  if (crit) {
    txt += ' (치명타!)';
    changeMorale(battle, attacker.team, +5);
    changeMorale(battle, target.team, -5);
  }
  logEvent(battle, txt, 'attack');
  return dealt;
}

// ─────────────────────────────────────────────────────────────
// 5. 행동 5종 실행
// ─────────────────────────────────────────────────────────────
function lowestHpEnemy(battle, team) {
  const foes = aliveOf(battle, enemyTeam(team));
  return foes.reduce((a, b) => (b.hp < a.hp ? b : a), foes[0]);
}

function doAction(battle, actor, action) {
  const foeTeam = enemyTeam(actor.team);
  const foes = aliveOf(battle, foeTeam);
  if (foes.length === 0) return;

  switch (action.type) {
    case '공격':
      performAttack(battle, actor, action.target || foes[0]);
      break;

    case '방어':
      addStatus(actor, '방어', 1);
      changeMorale(battle, actor.team, +3);
      logEvent(battle, `${actor.name} 방어 태세 (받는 피해 ½)`, 'guard');
      break;

    case '스킬':
      doSkill(battle, actor, action.target || foes[0]);
      actor.cd.skill = 3;
      break;

    case '책략':
      doStratagem(battle, actor, action.target || foes[0]);
      actor.cd.stratagem = 3;
      break;

    case '사기고양':
      changeMorale(battle, actor.team, +20);
      actor.cd.rally = 2;
      logEvent(battle, `📣 ${actor.name} 사기고양! (+20)`, 'rally');
      break;
  }
}

function doSkill(battle, actor, target) {
  switch (actor.skill) {
    case '강타':
      performAttack(battle, actor, target, 2.0, '강타');
      break;
    case '연격': {
      const foes = aliveOf(battle, enemyTeam(actor.team));
      for (const f of foes) performAttack(battle, actor, f, 0.6, '연격');
      break;
    }
    case '분기':
      performAttack(battle, actor, target, 1.5, '분기');
      changeMorale(battle, actor.team, +10);
      addStatus(actor, '분기', 2);             // 자기 강화(×1.2, 행동치+5)
      break;
    case '저격': {
      const t = lowestHpEnemy(battle, actor.team);
      performAttack(battle, actor, t, 1.8, '저격');
      break;
    }
    default:
      performAttack(battle, actor, target);
  }
}

function doStratagem(battle, actor, target) {
  const rate = Math.max(5, Math.min(95, 50 + (actor.intellect - target.intellect) / 2));
  const success = battle.rng.chance(rate / 100);
  if (!success) {
    logEvent(battle, `${actor.name}의 ${actor.stratagem} 실패 (${Math.round(rate)}%)`, 'info');
    return;
  }
  if (actor.stratagem === '화계') {
    addStatus(target, '화상', 3);
    logEvent(battle, `🔥 ${actor.name} 화계 성공! ${target.name} 화상(3턴)`, 'stratagem');
  } else if (actor.stratagem === '교란') {
    addStatus(target, '혼란', 2);
    changeMorale(battle, enemyTeam(actor.team), -15);
    logEvent(battle, `🌀 ${actor.name} 교란 성공! ${target.name} 혼란 + 적 사기 −15`, 'stratagem');
  }
}

// ─────────────────────────────────────────────────────────────
// 12. 적 AI (규칙 기반) — 플레이어 AI로도 사용
// ─────────────────────────────────────────────────────────────
function aiChooseAction(battle, actor) {
  const foeTeam = enemyTeam(actor.team);
  const foes = aliveOf(battle, foeTeam);
  if (foes.length === 0) return { type: '공격', target: null };

  const myMorale = battle.morale[actor.team];

  // 상성 좋은 대상 고르기
  const bestTargetBy = (filter) => {
    const cand = filter ? foes.filter(filter) : foes;
    const list = cand.length ? cand : foes;
    return list.reduce((a, b) =>
      typeMult(actor.troop, b.troop) > typeMult(actor.troop, a.troop) ? b : a, list[0]);
  };

  // 1. 이번 턴 처치 가능한 적 → 공격
  const killable = foes.find((f) => estimateDamage(battle, actor, f) >= f.hp);
  if (killable) return { type: '공격', target: killable };

  // 2. 팀 사기 < 30 & 사기고양 가능
  if (myMorale < 30 && actor.cd.rally === 0) return { type: '사기고양' };

  // 3. 책략 보유 & 쿨다운 OK → 최고 무력 적
  if (actor.stratagem && actor.cd.stratagem === 0) {
    const strongest = foes.reduce((a, b) => (b.might > a.might ? b : a), foes[0]);
    return { type: '책략', target: strongest };
  }

  // 4. 스킬 쿨다운 OK → 상성 유리한 적
  if (actor.cd.skill === 0) {
    const t = actor.skill === '저격' ? lowestHpEnemy(battle, actor.team) : bestTargetBy();
    return { type: '스킬', target: t };
  }

  // 5. 자기 체력 < 25% → 방어
  if (actor.hp < actor.maxHp * 0.25) return { type: '방어' };

  // 6. 그 외 → 체력 낮은 적 중 상성 좋은 대상
  const weak = [...foes].sort((a, b) => a.hp - b.hp).slice(0, 2);
  return { type: '공격', target: bestTargetBy((f) => weak.includes(f)) };
}

// AI 처치 판단용 데미지 추정(변량/치명타 제외 평균치)
function estimateDamage(battle, attacker, target) {
  return rawDamage({
    might: attacker.might,
    typeMult: typeMult(attacker.troop, target.troop),
    moraleMult: moraleMult(battle.morale[attacker.team]),
    variance: 1,
    targetCommand: target.command,
    weakened: battle.rout[attacker.team],
    defending: hasStatus(target, '방어'),
  });
}

// ─────────────────────────────────────────────────────────────
// 7. 행동 순서 (initiative)
// ─────────────────────────────────────────────────────────────
function computeOrder(battle) {
  const actors = allOf(battle).filter((f) => f.alive);
  for (const f of actors) {
    let mod = 0;
    if (hasStatus(f, '분기')) mod += 5;
    if (battle.rout[f.team]) mod -= 5;          // 위축
    f._init = f.agility + mod + battle.rng.range(0, 10);
  }
  actors.sort((a, b) => {
    if (b._init !== a._init) return b._init - a._init;
    if (b.command !== a.command) return b.command - a.command;
    return battle.rng.next() - 0.5;
  });
  return actors;
}

// ─────────────────────────────────────────────────────────────
// 한 장수의 턴 처리 (7.2)
// ─────────────────────────────────────────────────────────────
function takeTurn(battle, actor) {
  if (!actor.alive) return;

  // a. 화상 DoT
  if (hasStatus(actor, '화상')) {
    const dot = Math.floor(actor.maxHp * 0.08);
    applyDamage(battle, actor, dot);
    logEvent(battle, `🔥 ${actor.name} 화상 피해 ${dot}`, 'dot');
    if (!actor.alive) return;
  }

  // b. 붕괴 동요 40%
  if (battle.rout[actor.team] && battle.rng.chance(0.4)) {
    logEvent(battle, `${actor.name} 동요로 행동 불가`, 'info');
    return;
  }

  // c. 혼란 50%
  let forceRandom = false;
  if (hasStatus(actor, '혼란') && battle.rng.chance(0.5)) {
    forceRandom = true;
    logEvent(battle, `🌀 ${actor.name} 혼란!`, 'info');
  }

  // d. 행동 선택
  let action = battle.strategy[actor.team](battle, actor);

  // 혼란: 대상을 무작위로 비틀기 (공격류만)
  if (forceRandom) {
    const everyone = allOf(battle).filter((f) => f.alive && f !== actor);
    if (everyone.length) action = { type: '공격', target: battle.rng.pick(everyone) };
  }

  doAction(battle, actor, action);
}

// ─────────────────────────────────────────────────────────────
// 라운드/붕괴 판정
// ─────────────────────────────────────────────────────────────
function updateRout(battle) {
  for (const team of ['player', 'enemy']) {
    if (!battle.rout[team] && battle.morale[team] <= 0) {
      battle.rout[team] = true;
      logEvent(battle, `⚠️ ${teamName(team)} 붕괴!`, 'rout');
    } else if (battle.rout[team] && battle.morale[team] >= 20) {
      battle.rout[team] = false;
      logEvent(battle, `${teamName(team)} 붕괴 회복`, 'info');
    }
  }
}

function teamName(team) {
  return team === 'player' ? '아군' : '적군';
}

function endRound(battle) {
  // 3.2 매 라운드 종료: 50쪽으로 ±2 수렴
  for (const team of ['player', 'enemy']) {
    const m = battle.morale[team];
    if (m > 50) battle.morale[team] = Math.max(50, m - 2);
    else if (m < 50) battle.morale[team] = Math.min(50, m + 2);
  }
  updateRout(battle);

  // 쿨다운/상태 지속시간 −1
  for (const f of allOf(battle)) {
    if (!f.alive) continue;
    for (const k of ['skill', 'stratagem', 'rally']) {
      if (f.cd[k] > 0) f.cd[k]--;
    }
    f.statuses.forEach((s) => s.turns--);
    f.statuses = f.statuses.filter((s) => s.turns > 0);
  }
}

function teamWiped(battle, team) {
  return aliveOf(battle, team).length === 0;
}

// ─────────────────────────────────────────────────────────────
// 8·9. 승패 판정 + 결과 출력
// ─────────────────────────────────────────────────────────────
function gradeFor(survivorCount) {
  if (survivorCount >= 4) return '대승';
  if (survivorCount >= 2) return '승';
  return '신승';
}

function buildResult(battle, winner, reason) {
  const survivors = aliveOf(battle, winner).map((f) => ({
    id: f.id,
    name: f.name,
    hpPct: Math.round((f.hp / f.maxHp) * 100),
  }));
  const result = {
    winner,
    rounds: battle.round,
    grade: gradeFor(survivors.length),
    reason,
    survivors,
    finalMorale: { ...battle.morale },
    moraleDiff: battle.morale.player - battle.morale.enemy,
  };
  battle.finished = true;
  battle.result = result;
  logEvent(battle, `🏁 ${teamName(winner)} 승리 — ${result.grade}`, 'end');
  return result;
}

function checkVictory(battle) {
  const pWiped = teamWiped(battle, 'player');
  const eWiped = teamWiped(battle, 'enemy');
  if (eWiped && !pWiped) return buildResult(battle, 'player', 'wipe');
  if (pWiped && !eWiped) return buildResult(battle, 'enemy', 'wipe');
  if (pWiped && eWiped) {
    // 동시 전멸 → 사기 높은 쪽
    return buildResult(battle, battle.morale.player >= battle.morale.enemy ? 'player' : 'enemy', 'double-wipe');
  }
  return null;
}

// 8.2 시간 초과 판정
function judgeTimeout(battle) {
  const hpSum = (team) =>
    aliveOf(battle, team).reduce((s, f) => s + f.hp / f.maxHp, 0);
  const p = hpSum('player');
  const e = hpSum('enemy');
  let winner;
  if (p !== e) winner = p > e ? 'player' : 'enemy';
  else winner = battle.morale.player >= battle.morale.enemy ? 'player' : 'enemy';
  return buildResult(battle, winner, 'timeout');
}

// ─────────────────────────────────────────────────────────────
// 메인 루프
// ─────────────────────────────────────────────────────────────
function runRound(battle) {
  if (battle.finished) return battle.result;
  battle.round++;
  logEvent(battle, `━━━ 라운드 ${battle.round} ━━━`, 'round');

  const order = computeOrder(battle);
  for (const actor of order) {
    if (battle.finished) break;
    takeTurn(battle, actor);
    const v = checkVictory(battle);
    if (v) return v;
  }

  endRound(battle);

  if (battle.round >= battle.maxRounds) return judgeTimeout(battle);
  return null;
}

function runBattle(battle) {
  while (!battle.finished) {
    runRound(battle);
  }
  return battle.result;
}

// ─────────────────────────────────────────────────────────────
// 내보내기 (Node + 브라우저)
// ─────────────────────────────────────────────────────────────
const Engine = {
  makeRNG, BASE_HP, TYPE_TABLE, typeMult, maxHpOf, moraleMult, rawDamage,
  createBattle, runRound, runBattle, computeOrder, takeTurn, doAction,
  aiChooseAction, aliveOf, allOf, enemyTeam, hasStatus, teamName,
  // 인터랙티브 UI가 라운드를 직접 몰 때 쓰는 저수준 함수들
  endRound, checkVictory, judgeTimeout, logEvent, estimateDamage,
};

if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
if (typeof window !== 'undefined') window.Engine = Engine;
