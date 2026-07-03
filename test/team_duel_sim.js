// 4:4 팀 일기토(RQ-V4-002) + 국가 시너지 헤드리스 검증.
const D = require('../src/duel.js');
const C = require('../src/cards.js');

let fails = 0;
function ok(cond, msg) { console.log((cond ? '  ✅ ' : '  ❌ ') + msg); if (!cond) fails++; }
function seed(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const shu = ['liubei', 'guanyu', 'zhangfei', 'zhaoyun'].map(C.byId);
const wei = ['caocao', 'simayi', 'zhangliao', 'xiahoudun'].map(C.byId);

console.log('\n[1] 4:4 팀 전투 종료성');
{
  let end = 0, kills = 0; const rounds = [];
  for (let s = 1; s <= 50; s++) { const d = D.auto(shu, wei, seed(s * 17)); if (d.finished && (d.winner === 'p' || d.winner === 'e')) end++; if (d.result.killed) kills++; rounds.push(d.round); }
  ok(end === 50, `50전 전부 종료 (${end}/50)`);
  ok(kills > 0, `전멸 결착 ${kills}/50`);
  rounds.sort((a, b) => a - b); ok(rounds[25] >= 3, `충분한 합수(중앙 ${rounds[25]}R)`);
}

console.log('\n[2] 국가 시너지');
{
  const d = D.createDuel(shu, wei, {});
  ok(d.teams.p[0].synergy === 4, `촉 4인 완전 시너지 (n=${d.teams.p[0].synergy})`);
  const buff = d.teams.p[0].buffs.find((b) => b.type === 'atk');
  ok(buff && Math.abs(buff.amt - 0.15) < 1e-9, `4인 시너지 공격 +15% (${buff ? (buff.amt * 100).toFixed(0) : 0}%)`);
  const mix = [C.byId('guanyu'), C.byId('caocao'), C.byId('sunquan'), C.byId('gwanggaeto')];
  const d2 = D.createDuel(mix, wei, {});
  ok(!d2.teams.p[0].synergy, '4진영 혼합팀 = 시너지 없음');
  const duo = [C.byId('guanyu'), C.byId('zhangfei')];
  const d3 = D.createDuel(duo, wei, {});
  ok(d3.teams.p[0].synergy === 2, '촉 2인 = 부분 시너지(n=2)');
}

console.log('\n[3] 비대칭(3:4) + 인터랙티브 구동');
{
  const d = D.createDuel(shu.slice(0, 3), wei, { rng: seed(5) });
  let steps = 0;
  while (!d.finished && steps++ < 600) { D.beginTurn(d); if (d.finished) break; D.useSkill(d, D.aiPick(d)); }
  ok(d.finished, '3:4 비대칭 전투 정상 종료');
  ok(d.log.length > 0, `로그 ${d.log.length}줄`);
}

console.log('\n[4] 시드 재현');
{
  const a = D.auto(shu, wei, seed(42)), b = D.auto(shu, wei, seed(42));
  ok(a.winner === b.winner && a.round === b.round, '같은 시드 → 같은 결과');
}

console.log('\n' + (fails === 0 ? '🎉 전체 통과' : `⚠️ ${fails}개 실패`));
process.exit(fails === 0 ? 0 : 1);
