// 샘플 로스터 (GAMERULE.md 10장). 역사 실존 인물 기반(공용).
// 장비: weapon/armor/gloves/boots 슬롯. 각 아이템은 스탯 보너스 + 외형(look) 파라미터를 가짐.
const ITEMS = {
  weapon: [
    { id: 'w_spear',   name: '장창',       slot: 'weapon', might: 4,           look: { wp: 'spear',   wc: '#cdd3da' } },
    { id: 'w_sword',   name: '보검',       slot: 'weapon', might: 6, agility: 2, look: { wp: 'sword',   wc: '#dfe6ef' } },
    { id: 'w_bow',     name: '철태궁',     slot: 'weapon', might: 3, agility: 4, look: { wp: 'bow',     wc: '#8a5a2a' } },
    { id: 'w_glaive',  name: '언월도',     slot: 'weapon', might: 8, command: 2, look: { wp: 'glaive',  wc: '#e0e6ee' } },
    { id: 'w_halberd', name: '방천화극',   slot: 'weapon', might: 11, command: 3, look: { wp: 'halberd', wc: '#f0e6c0' } },
  ],
  armor: [
    { id: 'a_leather', name: '가죽갑', slot: 'armor', command: 3,            look: { ac: '#7c5a2e' } },
    { id: 'a_scale',   name: '찰갑',   slot: 'armor', command: 6, might: 1,  look: { ac: '#8a8f98' } },
    { id: 'a_plate',   name: '명광개', slot: 'armor', command: 10, might: 2, look: { ac: '#c9d0da' } },
    { id: 'a_gold',    name: '황금갑', slot: 'armor', command: 12, intellect: 2, look: { ac: '#d9b24a' } },
  ],
  gloves: [
    { id: 'g_cloth', name: '천 완갑', slot: 'gloves', agility: 2,           look: { gc: '#8a6a3a' } },
    { id: 'g_iron',  name: '철 완갑', slot: 'gloves', might: 2, agility: 1,  look: { gc: '#9aa0aa' } },
  ],
  boots: [
    { id: 'b_cloth', name: '전투화',    slot: 'boots', agility: 3,            look: { bc: '#5a3a1c' } },
    { id: 'b_iron',  name: '철 전투화', slot: 'boots', agility: 2, command: 1, look: { bc: '#8a8f98' } },
  ],
};
const SLOTS = ['weapon', 'armor', 'gloves', 'boots'];
function itemById(id) { for (const s of SLOTS) for (const it of ITEMS[s]) if (it.id === id) return it; return null; }
// 장착 스탯을 기본 스탯에 반영(기본값은 _base에 스냅샷). 장비 변경 시 재호출.
function applyEquip(g) {
  if (!g._base) g._base = { might: g.might, command: g.command, intellect: g.intellect, agility: g.agility };
  for (const k in g._base) g[k] = g._base[k];
  if (g.equip) for (const s of SLOTS) { const it = itemById(g.equip[s]); if (it) for (const k of ['might', 'command', 'intellect', 'agility']) if (it[k]) g[k] += it[k]; }
  return g;
}

const ROSTER = {
  player: [
    { id: 'geunchogo', name: '근초고왕', faction: '백제', troop: '기병',
      might: 92, command: 88, intellect: 78, agility: 75, skill: '분기', stratagem: null, rarity: 5,
      equip: { weapon: 'w_halberd', armor: 'a_gold', gloves: 'g_iron', boots: 'b_iron' } },
    { id: 'gyebaek', name: '계백', faction: '백제', troop: '보병',
      might: 86, command: 83, intellect: 60, agility: 62, skill: '강타', stratagem: null, rarity: 4,
      equip: { weapon: 'w_glaive', armor: 'a_plate', gloves: 'g_iron', boots: 'b_iron' } },
    { id: 'dochim', name: '도침', faction: '백제', troop: '궁병',
      might: 58, command: 55, intellect: 90, agility: 80, skill: '저격', stratagem: '화계', rarity: 4,
      equip: { weapon: 'w_bow', armor: 'a_scale', gloves: 'g_cloth', boots: 'b_cloth' } },
    { id: 'heukchi', name: '흑치상지', faction: '백제', troop: '창병',
      might: 84, command: 80, intellect: 66, agility: 58, skill: '연격', stratagem: null, rarity: 4,
      equip: { weapon: 'w_spear', armor: 'a_scale', gloves: 'g_iron', boots: 'b_iron' } },
  ],
  enemy: [
    { id: 'gwanggaeto', name: '광개토대왕', faction: '고구려', troop: '기병',
      might: 95, command: 92, intellect: 80, agility: 78, skill: '강타', stratagem: null, rarity: 5,
      equip: { weapon: 'w_halberd', armor: 'a_gold', gloves: 'g_iron', boots: 'b_iron' } },
    { id: 'eulji', name: '을지문덕', faction: '고구려', troop: '궁병',
      might: 62, command: 70, intellect: 95, agility: 72, skill: '저격', stratagem: '교란', rarity: 5,
      equip: { weapon: 'w_bow', armor: 'a_plate', gloves: 'g_cloth', boots: 'b_iron' } },
    { id: 'gochuga', name: '고추가', faction: '고구려', troop: '보병',
      might: 80, command: 78, intellect: 55, agility: 60, skill: '강타', stratagem: null, rarity: 3,
      equip: { weapon: 'w_glaive', armor: 'a_scale', gloves: 'g_iron', boots: 'b_cloth' } },
    { id: 'mockji', name: '막리지', faction: '고구려', troop: '창병',
      might: 78, command: 74, intellect: 64, agility: 56, skill: '연격', stratagem: null, rarity: 3,
      equip: { weapon: 'w_spear', armor: 'a_leather', gloves: 'g_cloth', boots: 'b_cloth' } },
  ],
};
for (const t of ['player', 'enemy']) for (const g of ROSTER[t]) applyEquip(g);   // 장착 스탯 반영

if (typeof module !== 'undefined' && module.exports) module.exports = ROSTER;
if (typeof window !== 'undefined') { window.ROSTER = ROSTER; window.ITEMS = ITEMS; window.SLOTS = SLOTS; window.itemById = itemById; window.applyEquip = applyEquip; }
