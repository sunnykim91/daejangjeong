// 샘플 로스터 (GAMERULE.md 10장). 역사 실존 인물 기반(공용).
// 장비: 6슬롯(무기/갑옷/방패/장갑/투구/부츠). 각 아이템 = 스탯 보너스 + 외형(look) + 세트 태그(set).
const STAT_KEYS = ['might', 'command', 'intellect', 'agility'];

// 세트 효과(요구사항 v4 §7). s2=2개↑ 보너스, s4=4개↑ 추가 보너스.
// 스탯키(might/command/intellect/agility)는 능력치로, 그 외(march/duel/raid/hold/morale)는 특수효과(_setFx).
const SETS = {
  기병: { name: '기병', desc: '기동·돌격·추격', s2: { agility: 6 }, s4: { agility: 10, march: 0.14 } },
  맹장: { name: '맹장', desc: '무력·치명·일기토', s2: { might: 6 }, s4: { might: 10, duel: 0.18 } },
  책사: { name: '책사', desc: '계략·혼란·야습', s2: { intellect: 6 }, s4: { intellect: 10, raid: 0.15 } },
  수비: { name: '수비', desc: '방어·사기·성방어', s2: { command: 6 }, s4: { command: 10, hold: 0.15 } },
  군주: { name: '군주', desc: '민심·통솔·사기', s2: { command: 4, intellect: 4 }, s4: { command: 6, intellect: 6, morale: 0.12 } },
};

const ITEMS = {
  weapon: [
    { id: 'w_spear',   name: '장창',     slot: 'weapon', might: 4,            look: { wp: 'spear',   wc: '#cdd3da' } },
    { id: 'w_sword',   name: '보검',     slot: 'weapon', might: 6, agility: 2, look: { wp: 'sword',   wc: '#dfe6ef' } },
    { id: 'w_bow',     name: '철태궁',   slot: 'weapon', might: 3, agility: 4, set: '책사', look: { wp: 'bow',     wc: '#8a5a2a' } },
    { id: 'w_lance',   name: '기창',     slot: 'weapon', might: 5, agility: 3, set: '기병', look: { wp: 'spear',   wc: '#e0d6b0' } },
    { id: 'w_glaive',  name: '언월도',   slot: 'weapon', might: 8, command: 2, set: '맹장', look: { wp: 'glaive',  wc: '#e0e6ee' } },
    { id: 'w_halberd', name: '방천화극', slot: 'weapon', might: 11, command: 3, set: '맹장', look: { wp: 'halberd', wc: '#f0e6c0' } },
    { id: 'w_command', name: '절월',     slot: 'weapon', command: 5, intellect: 3, set: '군주', look: { wp: 'glaive', wc: '#d9b24a' } },
  ],
  armor: [
    { id: 'a_leather', name: '가죽갑', slot: 'armor', command: 3,             look: { ac: '#7c5a2e' } },
    { id: 'a_scale',   name: '찰갑',   slot: 'armor', command: 6, might: 1,   look: { ac: '#8a8f98' } },
    { id: 'a_robe',    name: '학창의', slot: 'armor', intellect: 5, command: 2, set: '책사', look: { ac: '#5a6a8a' } },
    { id: 'a_plate',   name: '명광개', slot: 'armor', command: 10, might: 2, set: '수비', look: { ac: '#c9d0da' } },
    { id: 'a_gold',    name: '황금갑', slot: 'armor', command: 12, intellect: 2, set: '군주', look: { ac: '#d9b24a' } },
  ],
  shield: [
    { id: 's_wood',  name: '목방패',   slot: 'shield', command: 2, agility: 1,   look: { sc: '#7c5a2e' } },
    { id: 's_round', name: '원형방패', slot: 'shield', command: 4,               look: { sc: '#9aa0aa' } },
    { id: 's_rider', name: '기병소반', slot: 'shield', command: 2, agility: 3, set: '기병', look: { sc: '#b0a070' } },
    { id: 's_iron',  name: '철방패',   slot: 'shield', command: 6, set: '수비', look: { sc: '#8a8f98' } },
    { id: 's_royal', name: '어전방패', slot: 'shield', command: 4, intellect: 3, set: '군주', look: { sc: '#d9b24a' } },
  ],
  gloves: [
    { id: 'g_cloth', name: '천 완갑', slot: 'gloves', agility: 2,            look: { gc: '#8a6a3a' } },
    { id: 'g_iron',  name: '철 완갑', slot: 'gloves', might: 2, agility: 1, set: '맹장', look: { gc: '#9aa0aa' } },
    { id: 'g_silk',  name: '비단완갑', slot: 'gloves', intellect: 3, set: '책사', look: { gc: '#6a7a9a' } },
    { id: 'g_ride',  name: '기병완갑', slot: 'gloves', agility: 3, set: '기병', look: { gc: '#b0a070' } },
  ],
  helmet: [
    { id: 'h_leather', name: '가죽투구', slot: 'helmet', command: 2,             look: { hc: '#7c5a2e' } },
    { id: 'h_iron',    name: '철투구',   slot: 'helmet', command: 4, set: '수비', look: { hc: '#9aa0aa' } },
    { id: 'h_horn',    name: '귀면투구', slot: 'helmet', might: 3, command: 1, set: '맹장', look: { hc: '#8a5a4a' } },
    { id: 'h_scholar', name: '윤건',     slot: 'helmet', intellect: 4, set: '책사', look: { hc: '#5a6a8a' } },
    { id: 'h_light',   name: '경투구',   slot: 'helmet', agility: 3, set: '기병', look: { hc: '#b0a070' } },
    { id: 'h_phoenix', name: '봉황투구', slot: 'helmet', command: 4, intellect: 3, set: '군주', look: { hc: '#d9b24a' } },
  ],
  boots: [
    { id: 'b_cloth',  name: '전투화',     slot: 'boots', agility: 3,             look: { bc: '#5a3a1c' } },
    { id: 'b_iron',   name: '철 전투화',  slot: 'boots', agility: 2, command: 1, look: { bc: '#8a8f98' } },
    { id: 'b_war',    name: '기병전투화', slot: 'boots', agility: 3, might: 2, set: '기병', look: { bc: '#b0a070' } },
    { id: 'b_guard',  name: '방수전투화', slot: 'boots', command: 3, set: '수비', look: { bc: '#8a8f98' } },
    { id: 'b_charge', name: '돌격화',     slot: 'boots', might: 2, agility: 2, set: '맹장', look: { bc: '#8a5a4a' } },
  ],
};
const SLOTS = ['weapon', 'armor', 'shield', 'gloves', 'helmet', 'boots'];
function itemById(id) { for (const s of SLOTS) for (const it of ITEMS[s]) if (it.id === id) return it; return null; }

// 장착 스탯 + 세트효과를 기본 스탯에 반영(기본값은 _base에 스냅샷). 장비 변경 시 재호출.
function applyEquip(g) {
  if (!g._base) g._base = { might: g.might, command: g.command, intellect: g.intellect, agility: g.agility };
  for (const k in g._base) g[k] = g._base[k];
  const setCount = {};
  if (g.equip) for (const s of SLOTS) {
    const it = itemById(g.equip[s]); if (!it) continue;
    for (const k of STAT_KEYS) if (it[k]) g[k] += it[k];
    if (it.set) setCount[it.set] = (setCount[it.set] || 0) + 1;
  }
  g._setFx = { march: 0, duel: 0, raid: 0, hold: 0, morale: 0 };   // 세트 특수효과(rts가 읽음)
  g._sets = [];
  for (const sk in setCount) {
    const n = setCount[sk], def = SETS[sk]; if (!def) continue; let tier = 0;
    if (n >= 2) { tier = 2; for (const k in def.s2) if (STAT_KEYS.includes(k)) g[k] += def.s2[k]; }
    if (n >= 4) { tier = 4; for (const k in def.s4) { if (STAT_KEYS.includes(k)) g[k] += def.s4[k]; else if (g._setFx[k] != null) g._setFx[k] += def.s4[k]; } }
    if (tier) g._sets.push({ key: sk, name: def.name, tier, n, desc: def.desc });
  }
  return g;
}

const ROSTER = {
  player: [
    { id: 'geunchogo', name: '근초고왕', faction: '백제', troop: '기병',
      might: 92, command: 88, intellect: 78, agility: 75, skill: '분기', stratagem: null, rarity: 5,
      equip: { weapon: 'w_halberd', armor: 'a_gold', shield: 's_royal', gloves: 'g_iron', helmet: 'h_phoenix', boots: 'b_iron' } },   // 군주3 + 맹장2
    { id: 'gyebaek', name: '계백', faction: '백제', troop: '보병',
      might: 86, command: 83, intellect: 60, agility: 62, skill: '강타', stratagem: null, rarity: 4,
      equip: { weapon: 'w_glaive', armor: 'a_plate', shield: 's_iron', gloves: 'g_iron', helmet: 'h_iron', boots: 'b_guard' } },      // 수비4 + 맹장2
    { id: 'dochim', name: '도침', faction: '백제', troop: '궁병',
      might: 58, command: 55, intellect: 90, agility: 80, skill: '저격', stratagem: '화계', rarity: 4,
      equip: { weapon: 'w_bow', armor: 'a_robe', shield: 's_wood', gloves: 'g_silk', helmet: 'h_scholar', boots: 'b_cloth' } },        // 책사4(야습↑)
    { id: 'heukchi', name: '흑치상지', faction: '백제', troop: '창병',
      might: 84, command: 80, intellect: 66, agility: 58, skill: '연격', stratagem: null, rarity: 4,
      equip: { weapon: 'w_spear', armor: 'a_scale', shield: 's_iron', gloves: 'g_iron', helmet: 'h_iron', boots: 'b_iron' } },         // 수비2
  ],
  enemy: [
    { id: 'gwanggaeto', name: '광개토대왕', faction: '고구려', troop: '기병',
      might: 95, command: 92, intellect: 80, agility: 78, skill: '강타', stratagem: null, rarity: 5,
      equip: { weapon: 'w_halberd', armor: 'a_gold', shield: 's_royal', gloves: 'g_iron', helmet: 'h_horn', boots: 'b_charge' } },     // 맹장4(일기토↑) + 군주2
    { id: 'eulji', name: '을지문덕', faction: '고구려', troop: '궁병',
      might: 62, command: 70, intellect: 95, agility: 72, skill: '저격', stratagem: '교란', rarity: 5,
      equip: { weapon: 'w_bow', armor: 'a_robe', shield: 's_wood', gloves: 'g_silk', helmet: 'h_scholar', boots: 'b_iron' } },         // 책사4(야습↑)
    { id: 'gochuga', name: '고추가', faction: '고구려', troop: '보병',
      might: 80, command: 78, intellect: 55, agility: 60, skill: '강타', stratagem: null, rarity: 3,
      equip: { weapon: 'w_glaive', armor: 'a_plate', shield: 's_iron', gloves: 'g_cloth', helmet: 'h_iron', boots: 'b_guard' } },      // 수비4
    { id: 'mockji', name: '막리지', faction: '고구려', troop: '창병',
      might: 78, command: 74, intellect: 64, agility: 56, skill: '연격', stratagem: null, rarity: 3,
      equip: { weapon: 'w_spear', armor: 'a_scale', shield: 's_round', gloves: 'g_cloth', helmet: 'h_leather', boots: 'b_cloth' } },   // 세트 없음(기본형)
  ],
};
for (const t of ['player', 'enemy']) for (const g of ROSTER[t]) applyEquip(g);   // 장착 스탯 반영

if (typeof module !== 'undefined' && module.exports) module.exports = ROSTER;
if (typeof window !== 'undefined') { window.ROSTER = ROSTER; window.ITEMS = ITEMS; window.SLOTS = SLOTS; window.SETS = SETS; window.itemById = itemById; window.applyEquip = applyEquip; }
