# 대장정(大長征) — 인계 문서

> 개정 2026-07-02 · 웹(서버리스, 순수 HTML/JS/Canvas) · 빌드 불필요

삼국(백제 vs 고구려) 소재 전략 게임 프로토타입. 이미지·빌드 의존 없이 **HTML을 브라우저로 바로 열면 동작**. 전투 코어는 DOM 없는 순수 모듈이라 `node`로 헤드리스 검증된다.

**컨셉**: **삼국지7(코에이)의 RTS화** — 장수를 성에 주둔시켰다 출진시키고, 병력을 이끌고 실시간으로 천하를 정벌하는 **총력전 토탈맵(`total.html`)이 메인 모드**. 삼국지7 색은 UI/프레젠테이션(초상·액자·컷씬)에만 얹고 전장은 픽셀.

**아트**: 픽셀아트. 유닛/장수/성/UI는 순수 canvas 절차생성(장수·장비별 고유 조형). 지형만 CC0 타일셋(`assets/art/gfx/Overworld.png`)을 플레이스홀더로 사용 — **디자이너 에셋 오면 교체 예정**(라이선스는 프로토 단계라 비중요, CC0 우선). 참고 스샷 `previews/`.

> 정리: 옛 스냅샷 중복 폴더 `howon/`(06-29, 제거된 4:4 일기토 코드 잔존)는 2026-07-02 삭제함. 현행은 리포 루트 하나뿐.

---

## 1. 실행 & 테스트

브라우저로 `index.html` 열면 메뉴. 로컬 `file://`로 전 스크립트 로드(classic `<script src>`, fetch 없음). 권장: 데스크톱 크롬.

```
C:\Users\TheCoderYoon\IdeaProjects\howon\index.html
```

### 헤드리스 테스트 (node 18+) — 현재 전부 통과
```bash
node test/verify.js        # engine.js(4:4 판정 라이브러리) 5/5 — 현재 warsim/rts/codex의 의존(typeMult·maxHpOf)으로만 쓰임
node test/war_sim.js       # warsim.js 실시간 전투 — 종료성/균형, 40판 0미종료
node test/campaign_sim.js  # ⚠️ 옛 engine 기반 영지전 판정을 검증(300판). 지금 영지전은 warsim/rts로 개편되어 이 테스트는 stale
node test/tune.js          # (참고) 영지전 파라미터 스윕
```
> 새 코어 `src/rts.js`는 아직 전용 테스트 파일 없음(스모크는 인라인으로 확인). 추가 권장.

### 헤드리스 스크린샷(참고, WSL)
snap chromium은 `/tmp`·`/mnt/c` 접근 제한 → `~/wfp/`에 `total.html`+`src/*.js`+`assets/art/`를 복사 후 실행:
```
chromium-browser --headless=new --no-sandbox --disable-gpu --window-size=1200,800 --virtual-time-budget=4000 --screenshot=out.png "file:///home/<user>/wfp/x.html"
```
가상시간에서 rAF가 잘 안 돎 → 사본에 **드라이버 `<script>` 주입**: `setTimeout`으로 `RTS.sortie/moveArmy` + `for(...)RTS.step(world,dt)`(일기토 중엔 `RTS.stepDuels`) 돌린 뒤 `cam` 세팅+`render()`. `window.onerror`로 ERRS 집계, `document.title`에 결과 실어 `--dump-dom`으로 회수. 한글 폰트는 헤드리스에 없어 □로 보임(데스크톱 정상).

---

## 2. 모드 / 화면

| 파일 | 모드 | 설명 | 상태 |
|---|---|---|---|
| `index.html` | 메인 메뉴 | 4개 모드 진입(픽셀 히어로 씬) | ✅ |
| `total.html` | **총력전 토탈맵 (메인)** | 장수 성 주둔→출진(편성)→실시간 이동·교전·공성. 장비/일기토/지형/경로탐색/안개/효과음 | ✅ v2 |
| `warfield.html` | 실전 전투 | 단일 회전. 병력 배정·진형·배치 후 수십~백명 실시간 충돌. 지형·진형상성·지력스킬·장수강화 | ✅ 핵심 |
| `campaign.html` | 영지전 | 지도 6영지 정복. 편성(병력/진형) 후 출정→**warfield 실전 전투로 개전** | ✅ |
| `codex.html` | 장수 도감 | 8장수 스탯·병종 상성·스킬 해설(도트 흉상) | ✅ |
| `gacha.html` | **등용(가챠)** | 등용서로 56장 장수풀 뽑기 + 진영별 수집/시너지 + 에너지. Track A 상업층 목업 | ✅ Phase2b |
| `arena.html` | **일기토 아레나(4:4)** | 보유 장수로 4인 팀 편성 → AI 팀과 스킬킷 턴제 결투. 국가 시너지 적용 | ✅ (RQ-V4-002) |
| `index_cards.html` | (백업) | 최초 카드형 UI | deprecated |

> **일기토 = 턴제 + RAID(그림자의 전설)식 스킬킷** (Phase3 복원 → 2차답변으로 스킬킷 확장, 2026-07-03). `src/duel.js`: 장수마다 **액티브 스킬 1~4개 + 고유 특성(패시브)** 을 스탯·병종·등급으로 자동 구성(`buildKit`; 명장 오버라이드 가능). 스킬(강타/연격/저격/관통/분쇄/분기/함성/방어/화계/교란/정비) + 특성(돌격/정밀/맹공/견고/지장/질풍). 쿨다운·버프·화상DoT·회피·치명. 일기토 체력 `×DUEL_HP_MUL(2.4)`로 4~6R 지속. 전쟁 중 근접 시 `world.duelRequest` → total.html 스킬킷 모달(`openDuel`: `Duel.beginTurn`/`useSkill`/`aiPick`, 킷 버튼 선택). 종료 시 `RTS.applyDuelResult`(승리 사기↑ / 패배 전사→와해 or 생존→사기급락·혼란)로 전쟁 반영(RQ-V4-006). 헤드리스는 `world.autoDuel=true`→`resolveDuelAuto`→`Duel.auto`. 검증 `test/duel2_sim.js`. **4:4(N:N) 지원**: `createDuel(defs[], defs[])` 팀 전투 + **국가 시너지**(`applySynergy`: 같은 진영 2/3/4명 → 공격 +5/10/15%). 전쟁 발동은 1:1, 4:4는 `arena.html`(보유 팀 편성). 검증 `test/team_duel_sim.js`. ⚠️ 옛 engine.js 4:4 판정은 유틸(typeMult/maxHpOf)로만, 실시간 컷씬 코드는 미사용. `index_cards.html`은 최초 카드 UI 백업(deprecated).

---

## 3. 파일 구조

```
howon/
├─ index.html  total.html  warfield.html  campaign.html  codex.html  index_cards.html(백업)
├─ src/
│  ├─ engine.js    4:4 판정 라이브러리(GAMERULE). 이제 typeMult/maxHpOf 등 유틸 의존으로만 사용. 순수.
│  ├─ warsim.js    실시간 군세 전투 코어(2팀 고정전투). 병사스탯·진형(유지)·사기·투사체·지력스킬·장수강화. 순수.
│  ├─ rts.js       총력전 토탈맵 코어(다중 부대 오케스트레이션·이동명령·성점령). warsim 수학 재사용. 순수.
│  ├─ data.js      로스터(백제4/고구려4) + **장비(ITEMS·equip·applyEquip)** — 장착 스탯이 능력치에 반영됨
│  └─ glossary.js  스킬/책략/병종 설명(도감·툴팁)
├─ assets/art/gfx/Overworld.png   CC0 지형 타일셋(플레이스홀더). (구 배경 png 슬롯/PROMPTS.md는 미사용)
├─ previews/       화면별 스크린샷(픽셀 리스킨/토탈맵 등)
├─ tools/gen_assets.py   (구) 배경 생성 스크립트 — 현재 불필요
├─ test/  verify.js  war_sim.js  campaign_sim.js(stale)  tune.js
├─ GAMERULE.md   (구) 일기토 규칙 명세 — 일기토 제거로 참고용
├─ CAMPAIGN.md   영지전 규칙/밸런스값
└─ HANDOVER.md   (이 문서)
```

스크립트 로드 순서: `warfield`=engine→data→warsim · `total`=engine→data→warsim→rts · `campaign`=engine→data→warsim→glossary · `codex`=engine→data→glossary.

---

## 4. 핵심 시스템 & 튜닝 위치

### 4-1. 실시간 전투 `src/warsim.js` (warfield의 두뇌)
- **병사 스탯**(`soldierStats`): `hp=24+통솔*0.45`, `atk=3+무력*0.10`, `spd=24+민첩*0.45`. 병종: 보병 hp×1.3 / 기병 spd×1.45·atk×1.15 / 궁병 사거리110·hp×0.85.
- **장수(강화)**: 병사의 **hp×16 · atk×4 · 공속(cd)×0.7 · spd×1.14**. 압도적 영웅 유닛(일당백). `makeSquad` 내부.
- **진형 유지(통솔)**: `formedRatio(command)=clamp(0.30+통솔*0.007, .3~.97)` 비율만 유지, 나머지(뒤열)=이탈병 → atk `BROKEN_PERF=0.6`배·위치산개(`_sx/_sy`)·렌더 반투명. `분기` 스킬이 이탈병 재집결(atk 복원, `baseAtk` 사용).
- **지력 스킬(액티브)**: 장수가 `SKILL_CD=8s`마다 자동 발동. 위력 `skillPow(지력)=0.6+지력*0.011`. 강타=단일×2 / 연격=반경48 각각×0.6 / 저격=체력최저 적×1.8(장수우선) / 분기=아군사기+10×pow+재집결. `castSkill`, `war.skillFx`.
- **진형 상성**(`FORM_STATS`,`FORM_BEATS`): 쐐기▶방진▶횡대▶종대▶쐐기, 카운터 ×1.2/역 ×0.85.
- **지형**(`defaultTerrain`): 언덕(공↑방↑)·숲(원거리↓·기병↓·느림)·하천(피해↑·느림). 중앙선 대칭 배치 유지.
- **사기/도주**: 시작 75(campaign 출정 시 방어민심 반영). 사기<30 확률 도주. **패주(flee) 적은 추격 안 함** — 타겟 획득 시 flee 제외, 교전 중 적 우선.
- **병력 배정**: `createWar({troops:{player:[..],enemy:[..]}})` = 부대별 도트 수(없으면 22). warfield에서 **도트1=병사100**. `war.startCount` 제공.
- 종료: 한쪽 전멸 또는 120초.

### 4-2. 총력전 코어 `src/rts.js` (total.html의 두뇌) — **장수 주둔·출진 모델**
> 2026-07-02 대규모 개편. 시작 시 필드 부대 없음 — 장수가 성에 주둔했다가 **출진**해야 부대가 생김.
- **월드/성**: `createWorld({W,H,castles:[{id,name,x,y,owner,troops,troopMax,prod,min,garrison:[genDef..]}],terrain})`. `armies`는 옵션(테스트/하위호환). `world.generals`=전 장수 레코드 `{def,team,state:'garrison'|'field'|'dead',castle,armyId}`. 성 `troops`=주둔 병력 풀(1도트=100명), `min`=민심(0~100).
- **출진** `sortie(world,castleId,genId,dots,form)` → 성 풀에서 dots*100 차감, 장수+병력 필드 스폰, rec.state='field'. **재입성** `regarrison(world,armyId,castleId)` → 잔여병 풀 환원+장수 재주둔(장수가 '목적지인 아군 성' CAP_R 도달 시 step에서 자동 호출).
- **진형 방향**: 부대 무게중심→명령지점 방향으로 진형 회전(`a._ang`, step 초반 계산). 행군 시 진형 슬롯을 `_ang`으로 회전 적용(정면이 진행방향). 예: 횡대가 동진하면 세로 전열로 재정렬.
- **전투 표적(진형 유지+난전 접적)**: 행군 중엔 진형 슬롯 유지, **접적 반경 `ENGAGE=66`** 안에 적이 들어와야 표적 획득→이탈교전. 한번 물면 **추격 leash `AGGRO=150`**까지 유지(궁병은 사거리 기준). warsim 전투식(typeMult·진형상성·투사체) 재사용.
- **통솔/사기**: `formedRatio(통솔)`로 진형유지병/이탈병(atk×0.6·`_sx/_sy` 산개). 사기붕괴 임계 `routThresh=34-통솔*0.14`(통솔↑ 오래버팀). **비전투 시 사기 회복**(통솔비례, ≤75) → 패주부대 후방 재정비 후 복귀. `_engaged` 플래그로 전투중 회복차단.
- **민심→충원**: 성 생산 `troops += prod*(0.3+민심/100*0.95)*dt`. 평시 민심 서서히 회복(≤88), 적 점거 시 동요(↓), 함락 시 25로 리셋(점령지 반발).
- **공성전**: 적이 성 반경 있으면 **성벽 반격**(`wallDps`, 사격반경 CAP_R*2.1, 주둔군 많을수록 강) → 공격군도 소모. 수비병 0이면 주둔군·민심 소모, **포위 중 생산 중단**(보급차단 → 장수만 남은 소수 부대도 시간 들이면 함락). **함락 조건: troops≤0 또는 민심≤0**. 함락 시 주둔장수 포로(dead).
- **민첩 도망**: 장수 전사 시 `escapeChance(민첩)`(0→25%/50→50%/100→100%, 피스와이즈)로 전사 대신 인근 아군 성 도망→재주둔(`victim.gone=true`, rec.state='garrison'). `killMorale` 내부.
- **일기토**: 적 장수 `DUEL_R=44` 근접+쿨(`DUEL_CD=9`) 시 확률 발동. `world.duels` 결투 객체, 2.6s간 0.55s마다 합(`duelPower`=무력+통솔0.3+지력0.15+체력비+운, 열세측 피해=maxHp의 7~24% → 격파 가능). 결투 중 장수 정상행동 정지. 승자 아군 사기+4. 패자 전사 시 도망 판정 적용. 합 정보(`hitAt/hitSide/clashN`)는 컷씬 연출용.
  - **일시중지 진행**: 일기토 발생 시 **게임 전체 정지**, `RTS.stepDuels(world,dt)`로 결투만 진행(다른 부대·성 동결). rts에서 `procDuels`(진행)/`detectDuels`(신규, 한 번에 하나 가드)로 분리. 루프: `if(world.duels.length) stepDuels; else step`. 결투 종료·여운 후 world.duels 비면 자동 재개.
  - **시네마틱 컷씬**(total.html `drawDuelCutscene`, 삼국지7풍, 안개 위 캔버스 오버레이): 아레나 방사 배경+레터박스(금라인)+스피드라인+좌우 대형 장수(오라·idle bob·피격 적색 플래시)+합마다 충격파 링·다중 슬래시·지속 스파크 파티클(`duelFx`, world.time 기반 해석적)·화면흔들림+**양피지·청동 액자 초상 HUD**(`drawDuelHud`: 초상 `bustCanvas`+무력+세그먼트 기세 게이지)+一騎討 슬램 타이틀+결과(격파 시 전체 화면 플래시). `spawnDuelBurst`가 새 clash(`d.clashN`)마다 파티클/링 생성. (구 DOM 배너 `#duelcut` 미사용.)
- **장수 격파 시 부대 해산**: `killMorale`에서 장수 상실(전사/도망 무관) 시 `a.morale=0, a._disband=true`. 해산 부대는 사기 회복 안 하고, 패주 병사가 좌우 산개(`_fd`)하며 `_fleeT>~1.7s` 또는 맵밖에서 `gone=true`로 **흩어져 소멸**.
- **야습·숙영·피로도·혼란·와해 (Phase1 — 소수 역전 장치, 2026-07-03)**: `world`에 밤/낮 시계(`clock/tod/night`, `updateDayNight`). ⚠️ Track A는 **가짜 시계**(`DAY_LEN=160s`, `nightFrac=0.42`) — 서버판에선 서버 시간(≈30분 주기)으로 교체. 부대 `fatigue`(0 팔팔~100 탈진)는 행군·교전 시 누적, **숙영**(`setCamp(world,id,on)` → `a.camp`) 시 회복(밤 더 빠름)→`fatigueAtk(f)`로 **공격 배수↑**(`a._atkMul`). 야간 숙영 부대는 `aware=false`(방심). **야습**: 활동 부대가 숙영/방심한 적에 접근하면 `detectRaids`가 확률 발동(수동은 `tryRaid`). `raidChance`=공격 지력·기동(기습) vs 수비 통솔·지력(경계)+야간/방심/지형(숲·산) 보정. 성공 시 대상 `confused`(혼란: 공격×0.5·이동×0.55·사기 잠식, `_spdMul`), `CONFUSE_DUR=9s` 내 수습 못 하면 `collapsed`/`_disband`(**와해=해산**). 헤드리스 검증 `test/raid_sim.js`(6/6 통과). **렌더/조작 연동 완료(total.html)**: 밤 화면 어둡게(`nightDarkness`)·숙영 모닥불·혼란/와해/숙영 배지(`drawArmyBadges`)·야습 성공/피격 배너(`checkRaidEvents`)·HUD 밤낮 표시(`updateTodHud`)·장수패널 피로도/상태·숙영 토글(🏕 버튼/`C`키, `commandArmy`가 이동 시 자동 기상). 적 AI는 야간에 전선 밖 부대를 숙영시켜 야습 표적 제공(`enemyAI`).
- **부대 방침(Stance) (Phase4 2026-07-03, 요구사항 v4 §6)**: `a.stance` 10종(`RTS.STANCES`: 진군/대기/방어/정찰/선발/우회/야습/매복/후퇴/합류). `RTS.setStance(world,id,st)`. step 매 틱 `applyStance`가 방침별로 이동목표(order)·플래그를 갱신 — 대기/방어=`_hold`(정지), 정찰=`_noEngage`(교전회피)+기민, 선발=`_stanceSpd`↑, 후퇴=최근접 아군성으로+비교전, 합류=최근접 아군부대로, 야습=밤에 숙영/방심한 적으로, 매복=숲/산에서 은폐(camp). UI: 장수 패널 `방침` 드롭다운(`ofcStance`). 검증 `test/stance_sim.js`(6섹션). "큰 방향만 정하면 통솔·AI가 세부 처리" 구현.
- **통과불가 지형 + 경로탐색(플로우 필드)**: `BLOCK={물,산악}`은 벽. `buildNav`(createWorld)가 `NAV=40` 셀 `_nav.blk` 생성. `computeFlow`=목표 셀 BFS 거리장(대각 코너컷 방지), 부대별 `a._flow` 캐시(명령 변경 시). 행군 시 멀면 플로우 필드로 **장애물 우회+협로 병목/행렬**, 가까우면 진형 슬롯. 이동은 `stepMove`=축별 슬라이드→막히면 벽 접선 우회. **끼임 방지**: 분리(SEP)는 통과불가로 안 밀고, 매 틱 `nearestPassableCell`로 낀 유닛 강제 탈출(unstick). 검증: 산 강제진입도 낀병사 0. ⚠️ 산악 이제 통과불가.
- **지형(6종 컴포넌트)**: `TERRAIN` 테이블(평야/언덕/산악/물/숲/늪) — 각 `{spd,atk,taken,cav,ranged}`. `terrainAt(world,x,y)`가 소dier 이동(spd)·근접피해(atk·기병cav)·피격(taken)·원거리 엄폐(ranged)에 적용. 배치=`world.terrain`의 `{type,shape:'circle'|'rect',x,y,r | x0,y0,x1,y1}` 컴포넌트(total.html `terrain()`에서 정의, 임의 배치). 시각 팔레트는 total.html `TPAL`+`renderMapBg`(타입별 디테일). rts는 `RTS.TERRAIN`/`terrainAt` export.
- **성 = 성벽 진영(total.html 렌더)**: **큰 성벽 enclosure**(`CENC=200×160`). `makeWall(owner)`(캐시)=석축 성벽+여장+각루+성문 문루. 내부 `drawGarrison`=**실제 병사 스프라이트가 안뜰에 열 지어 주둔**(병력량 따라 열이 차고 빔)+앞줄 지휘 장수(고유 조형, §4-5). 성 클릭 판정은 CENC 영역(성벽 어디든 클릭=편성/귀환). ⚠️ 게임 점령 반경 `CAP_R=46`은 시각 스케일과 분리 — 공성 밀착은 병사가 성 중심으로 모임.
- **주의**: warsim(2팀 고정전투)과 별개 레이어. 전투 규칙 수정 시 두 곳(warsim/rts) 동기화 필요할 수 있음. 밸런스 상수는 §4-2 각 항목 위치에서 조정.
- **안개(FoW)+미니맵**: rts.js 코어가 아니라 **total.html 렌더 레이어**에만 존재. `FCELL=30` 셀 그리드로 `explored`(한번 본 곳)/`vis`(현재 시야) 관리. 시야원=아군 성(r220)+부대 centroid(r=AGGRO+70). `computeVision()`이 매 render마다 갱신하고 적 유닛·화살·성을 게이팅(적 성은 `everSeen/seenOwner` 스냅샷). 안개는 저해상도 `fogCv`를 smoothing 확대 blit해 경계를 부드럽게. 미니맵은 `#mm` 캔버스(전역 `canvas` CSS를 #id로 오버라이드해야 함 — 안 하면 collapse). 클릭/드래그로 카메라 이동.
- **삼국지7 UI 레이어(total.html)**: 픽셀 전장은 유지하고 삼국지7 색은 UI/프레젠테이션에만 얹는 방향.
  - **장수 정보 패널**(`.ofc`, 좌하단): 부대 선택 시 도트 흉상(`makeBust`)+이름·★등급+스탯4종 막대+진형/스킬+병력/사기. `fillOfficer`·`updateOfficerLive`(장수 전사 시 자동 해제). **삼국지7 무장 카드 톤**(양피지·청동 액자·하늘 배경 초상)으로 편성 팝업과 통일.
  - **장수 로스터 바**(`.roster`/`.chip`, 하단 중앙): 아군 장수 초상 칩. 클릭=`selectFromRoster`(선택+카메라 점프). `buildRoster`(init 1회)·`updateRoster`(매 render: HP게이지·sel·dead✕·패주⚑). `chipRefs`에 el 캐시.
  - **문양 프레임**: `.orn`(금색 코너 브래킷 ::after) + `.seal`(붉은 印). HUD/패널/로스터/미니맵/오버레이 통일. ⚠️ `.orn`은 position을 안 건드림 — 대상이 이미 positioned(absolute)여야 ::after inset가 먹고, static이면(.roster/.box) 각자 position:relative 부여.
  - **출진 편성 팝업(삼국지7 명령창 톤)**: 라커 제목배너(出 인장)+좌측 무장 초상 카드(대형 초상·무/통/지/민 막대·특기, `selectSortieGen`으로 선택 시 갱신)+우측 명령창(주둔병력·민심, 무장 gchip 선택, 병력 슬라이더, 진형+상성힌트)+강조 出陣 버튼. `.box.sortie` CSS.
  - **효과음+화면 연출**: `AU`(WebAudio 신스, 외부 에셋 없음 — horn/boom/duel/hit/win, 첫 입력 시 resume). `screenFx({flash,text,sub,shake})`+`stepScreenFx`(감쇠)+`drawScreenFx`(캔버스 플래시·배너)+화면흔들림(stage transform). 이벤트: **출진**=horn+금플래시+"○○ 出陣!" 배너, **함락/점령**=`checkCastleEvents`(소유권 변화 감지)→boom+흔들림+적/청플래시+"○○ 陷落!/占領!", **일기토**=개시/합(clash)/종료 SFX(격파 boom·勝 win). 🔊 뮤트 토글.
  - **명령/시야**: 아군 장수(성+필드) 모두 시야원 공유. 플레이어가 부대 명령(`commandArmy`) 시 패주 해제·재정비(rally)로 명령이 먹힘. 로스터/맵/미니맵 클릭 선택.

### 4-3. 영지전 `campaign.html`
- 하단 **편성 바**: 장수별 진형 사이클 + 병력 ±(풀 `POOL_TOTAL=100`도트=10,000명). 이게 "출진 확정".
- 출정 = `warfield.html?campaign=1&auto=1&def=<민심>&forms=..&dots=..` **iframe** → warfield가 셋업 생략 즉시 개전(`CAUTO`), 종료 시 `postMessage({type:'warfield-result',...})` → 등급(`gradeFromResult`=생존비율)·민심 반영.
- 적 침공(`enemyTurn`)은 **헤드리스 warsim** 자동 판정. 밸런스 상수: `GRADE_DROP 대승55/승38/신승23`, 방어사기 `20+민심*0.6`, 함락 리셋 68 (CAMPAIGN.md).

### 4-4. 장비 시스템 & 장수 고유 조형(장비 반영)
- **장비 6슬롯 + 세트효과**(`src/data.js`, Phase2a 2026-07-03): 슬롯 `SLOTS=[weapon,armor,shield,gloves,helmet,boots]`(방패·투구 추가), `ITEMS` 테이블(각 아이템 스탯보너스+`look`+`set` 태그). **세트 5종**(`SETS`): 기병(기동)·맹장(무력·일기토)·책사(계략·야습)·수비(방어·사기)·군주(민심·통솔). `applyEquip(g)`가 `_base`에 장착 보너스 + **세트 보너스**(2개↑ `s2`, 4개↑ `s4`)를 합쳐 `g.might` 등에 반영하고, 세트 특수효과를 `g._setFx`(march/duel/raid/hold/morale)·활성 세트를 `g._sets`에 기록. **rts 연동**: 책사4 → `raidChance` 야습성공+0.15, 맹장4 → `duelPower` 일기토+18%, 기병4 → `army._marchMul` 행군속도+14%. 검증 `test/equip_sim.js`(8/8). window 노출: `ITEMS`/`SLOTS`/`SETS`/`itemById`/`applyEquip`. UI: 편성팝업 장비 버튼 → 6슬롯 선택 + 세트 활성 표시(total.html `renderEquip`).
- **장비 UI**(total.html): 편성 팝업 `장비` 버튼 → `openEquip(def)` 팝업(`#equipOv`). 슬롯별 아이템 선택 → `equipItem`(applyEquip+재렌더+buildRoster). 스프라이트/초상 캐시는 equip 시그니처를 키에 포함 → 교체 시 자동 재생성.
- **장수 고유 조형/일러스트**: `genLook(def)`=장비 look + id 시드(볏색 PLUMES/수염). `makeGenSprite(team,def)`=투구+볏+수염+갑주(장비색)+무기(장비형: 창/도/궁/언월도/방천화극)로 8장수 각기 다른 맵 조형. `makeBust(side,troop,def)`=초상에 갑옷색·볏·수염 반영(`bustKey`로 캐시). `spriteFor`/drawGarrison/일기토/officer/roster/sortie 전부 def 전달.
- **일기토 애니**(`drawDuelFighter(team,def,...,swing)`): 장수 고유 조형 + 합마다 앞으로 기울여 베는 스윙(회전+전진)+무기 궤적 호. 武(장착 무력) HUD 표기.

### 4-5. 실제 아트 에셋(프로토타입 플레이스홀더) & 게임 필
- **지형 렌더 = 양피지 고지도 톤(2026-07-03 리스킨)**: total.html `renderMapBg`가 **절차 카토그래픽**으로 그림 — 크림 양피지 베이스+종이 얼룩+옅은 경위선 격자, 지형 존별 기호(`drawZone`/`ZONE_STYLE`): 숲=수풀 점, 산악=봉우리(^), 언덕=등고선, 물=물결선, 늪/습지=갈대. 가장자리 갈변 vignette. 안개는 세피아(미탐색=오래된 종이) 톤. 외부 타일셋(`Overworld.png`) 의존 제거. ⚠️ 성(픽셀 성벽)·유닛(픽셀 스프라이트)은 아직 픽셀 — 지도 톤과 완전 통일하려면 성=고지도 요새 아이콘/유닛=깃발 아이콘으로 재작화 필요(별도 큰 작업).
- **주둔 병력 렌더**(total.html `drawGarrison`): 도트가 아니라 **실제 병사 스프라이트가 성 안뜰에 열 지어 주둔**(병력량 따라 열이 차고 빔) + 앞줄에 지휘 장수(makeGenSprite, 여러 명 나란히+깃발). "군이 주둔 중" 느낌. drawWall 이후 그려 성벽 안에 보임.
- **유닛 애니**(total.html `drawSoldier`): 걷기/대기 흔들림(bob)·이동 방향 좌우 반전(`_face`)·공격 런지·피격 적색 섬광(`_hitT`). 코어 불변, 렌더 상태(`_ax/_ay/_ahp`)만 소dier에 부착.

### 4-6. 픽셀 렌더 (warfield/total/campaign/codex 공통 패턴)
- `imageSmoothingEnabled=false` + CSS `image-rendering:pixelated`. 유닛/장수/성 = 절차생성 도트 스프라이트(팀+병종별 캐시, `makeUnitSprite`/`makeGenSprite`/`makeCastle`). 지형=오프스크린 타일 배경 1회 렌더 후 blit(`PX=5`). 장수는 대형(GSCALE~2.1~2.3)+발광오라·펄스링·깃발.

---

### 4-7. 상업층 — 등용(가챠)·에너지 (Phase2b, Track A 목업 2026-07-03)
> ⚠️ **Track A 목업**: 확률·재화·에너지는 클라 `localStorage`. 서버판(Track B)에서 계정/서버 인증으로 교체. 확률·수치는 **임시값**(기획자 확정 대기).
- **장수 카드풀**(`src/cards.js`): 7진영 42장 — 중국(위·촉·오)/한반도(고구려·백제·신라)/일본(전국). `rarity` 3=노말/4=레어/5=전설/6=신화. `CARDS.POOL`/`byFaction`/`byRarity`, `FACTION_COLOR`/`REGION`/`FACTION_SYNERGY`(표시용). window: `CARDS`/`POOL`.
- **가챠 로직**(`src/gacha.js`, 순수·검증가능): `RATES`(등용서 등급→장수 등급 확률표), `rollGeneral(grade,rng)`(등급 뽑고 해당 rarity 장수 추출, 없으면 인접 폴백), `pickRarity`. 검증 `test/gacha_sim.js`(분포·시드재현).
- **메타 저장**(`src/meta.js`, localStorage): `energy()`(5분당+1, 최대20, 시간기반 충전)·`spendEnergy`/`addEnergy`, `scrolls`/`useScroll`/`addScroll`(등용서 인벤), `owned`/`addOwned`(보유 장수). `Meta.reset()`.
- **등용 화면**(`gacha.html`): 에너지·등용서 인벤 상단바 + 등급별 등용 버튼 + 획득 카드 리빌(NEW/등급색) + 보유 장수 진영별 수집(시너지 표시). 자체 진영색 도트 흉상. "등용서 보충(테스트)" 버튼은 일일퀘/정벌 보상 대체 임시.
- **에너지 연동(total.html)**: 출진(`soGo`) 시 `Meta.spendEnergy(1)`(부족 시 차단·실패 시 환불), HUD `⚡에너지` 표시(`updateEnergyHud`, 1초 폴링).

## 5. 알려진 한계 / 미완
1. **총력전 v2 완료 항목**: 출진 편성 팝업·성별 병력풀·민심충원·공성전(성벽반격/포위충원중단)·민첩도망/재주둔·재입성·일기토(일시정지 시네마틱 컷씬·격파해산)·진형유지+방향+난전접적·**통과불가지형+플로우필드 경로탐색(끼임방지)**·6종지형·안개+미니맵·**장비시스템+장수고유조형/초상**·효과음+화면연출·실제 지형타일셋·삼국지7 UI(장수패널·로스터·편성팝업·문양프레임). **남은 것**: 박스 다중선택·부대 그룹·난이도·계략 필드발동·장수 성장/충성.
2. **밸런스 MVP**: 공성 소모전 수치(wallDps·drain), 사기 곡선, 진형 상성, 일기토 빈도/위력은 대략치 — §4-2 각 항목에서 조정. rts 전용 테스트 파일 아직 없음(스모크는 node 인라인).
3. **campaign_sim.js stale**: 옛 engine 판정 검증(현 경로와 다름).
4. **미사용 스탯**: 책략·성급(rarity) 실시간 미반영(도감 표시만).
5. 성능 O(n²) 현 규모 무난. **세이브/튜토리얼 구현됨**(Phase5): total.html `saveGame`/`loadGame`(localStorage `dj_total_save` 스냅샷 — 성 소유·병력·민심·장수 상태·필드부대 재구성) + 💾📁 버튼, 첫 방문 튜토리얼 오버레이(`tutOv`, ❓ 재열람). ⚠️ **3단계 세계지도(1단계)·군벌전은 미구현 — Track B(서버/지속형 세계) 영역**.

## 6. 다음 작업 후보
- 총력전: 박스 선택/그룹, 난이도, 계략 필드 발동, 장수 성장·충성·발탁.
- 밸런스 패스(공성 소모·사기 곡선·일기토·진형 강도), rts 전용 헤드리스 테스트.
- 사운드/세이브/튜토리얼, 진짜 일러스트(디자이너) 교체.

## 7. 작업 메모(맥락)
- 진행: 4:4엔진 → 카드UI → 영지전 → **실시간 군세(warsim)** → 지형/진형 → 픽셀 리스킨 → 일기토 제거 → **총력전 토탈맵(rts)** → (07-02 대확장) **장수 주둔·출진·성병력풀·민심·공성·민첩도망·재입성·일기토 시네마틱·경로탐색·6종지형·장비시스템·장수고유조형·효과음·삼국지7 UI**. 방향 "삼국지7 RTS화"로 수렴, total.html이 메인.
- 모든 전투 코어는 헤드리스로 종료성·밸런스 검증 후 확정하는 흐름. 새 규칙 추가 시 같은 패턴 권장.
- warsim/rts는 `Math.random` 기반 — 재현 필요 시 `step(...,rng)`에 시드 rng 주입.
