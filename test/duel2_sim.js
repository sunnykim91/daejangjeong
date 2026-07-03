// RAID식 스킬킷 일기토(duel.js) 헤드리스 검증.
const Duel = require('../src/duel.js');
const CARDS = require('../src/cards.js');
const ROSTER = require('../src/data.js');

let fails = 0;
function ok(cond, msg) { console.log((cond ? '  ✅ ' : '  ❌ ') + msg); if (!cond) fails++; }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

console.log('\n[1] 스킬킷 자동 구성');
{
  const g = CARDS.byId('guanyu');          // 신화 관우
  const k = Duel.buildKit(g);
  ok(k.skills.length >= 2 && k.skills[0] === 'strike', `관우 킷: ${k.skills.join('/')} (기본+액티브)`);
  ok(k.passive && Duel.PASSIVES[k.passive], `관우 특성: ${Duel.PASSIVES[k.passive].name}`);
  let allKit = true; for (const g2 of CARDS.POOL) { const kk = Duel.buildKit(g2); if (kk.skills.length < 2 || !kk.passive) allKit = false; }
  ok(allKit, `56장 전원 킷+특성 보유`);
}

console.log('\n[2] 일기토 종료성(자동 판정)');
{
  let allEnd = true, kills = 0, sample = null;
  for (let s = 1; s <= 60; s++) {
    const d = Duel.auto(ROSTER.player[0], ROSTER.enemy[0], mulberry32(s * 13));
    if (!d.finished || (d.winner !== 'p' && d.winner !== 'e')) allEnd = false;
    if (d.result.killed) kills++;
    if (s === 1) sample = d;
  }
  ok(allEnd, '60회 전부 종료(무한루프 없음)');
  ok(kills > 0, `격파 결착 발생 ${kills}/60회`);
  ok(sample.result.grade && sample.round > 0, `결과 구조 정상 (${sample.winner} ${sample.result.grade} ${sample.round}R)`);
}

console.log('\n[3] 인터랙티브 구동(beginTurn/useSkill/aiPick)');
{
  const d = Duel.createDuel(ROSTER.player[0], ROSTER.enemy[0], { rng: mulberry32(7) });
  let steps = 0;
  while (!d.finished && steps++ < 300) { Duel.beginTurn(d); if (d.finished) break; Duel.useSkill(d, Duel.aiPick(d)); }
  ok(d.finished, '턴 단위 구동으로 정상 종료');
  ok(d.log.length > 0, `전투 로그 생성 ${d.log.length}줄 (예: "${d.log[1] || d.log[0]}")`);
}

console.log('\n[4] 쿨다운·회피·시드 재현');
{
  const d = Duel.createDuel(CARDS.byId('gwanggaeto'), CARDS.byId('eulji'), { rng: mulberry32(3) });
  Duel.beginTurn(d); const actor = d.order[d.idx];
  const cdSkill = actor.kit.find((s) => Duel.SKILLS[s].cd > 0);
  Duel.useSkill(d, cdSkill);
  ok(actor.cds[cdSkill] > 0, `쿨다운 스킬 사용 후 대기(${cdSkill} cd=${actor.cds[cdSkill]})`);
  // 시드 재현
  const a = Duel.auto(ROSTER.player[0], ROSTER.enemy[0], mulberry32(99));
  const b = Duel.auto(ROSTER.player[0], ROSTER.enemy[0], mulberry32(99));
  ok(a.winner === b.winner && a.round === b.round, '같은 시드 → 같은 결과');
}

console.log('\n' + (fails === 0 ? '🎉 전체 통과' : `⚠️ ${fails}개 실패`));
process.exit(fails === 0 ? 0 : 1);
