# 일러스트 에셋 가이드 + 생성 프롬프트

> 🗄️ **[STALE]** 이 이미지-슬롯 방식은 현재 미사용. 유닛/장수/성/UI는 **절차생성 픽셀**(장수·장비별 고유 조형), 지형은 **CC0 타일셋**(`assets/art/gfx/Overworld.png`)을 플레이스홀더로 씀. 디자이너 에셋 통합 시 방식 재검토(HANDOVER §4-4/4-5 참고).

게임 코드는 이미 **이미지 슬롯**을 갖고 있다. 아래 경로/파일명 그대로 PNG를 넣으면 자동으로 표시되고, 없으면 기존 도형(글자 메달)으로 폴백한다. **코드 수정 불필요 — 파일만 떨구면 됨.**

```
assets/
├── portraits/   장수 초상  (정사각, 권장 512×512, 투명/단색 배경)
│   ├── geunchogo.png  근초고왕   ├── gwanggaeto.png 광개토대왕
│   ├── gyebaek.png    계백        ├── eulji.png      을지문덕
│   ├── dochim.png     도침        ├── gochuga.png    고추가
│   └── heukchi.png    흑치상지    └── mockji.png     막리지
├── buildings/   영지 건물  (정사각, 권장 256×256, 투명 배경 PNG 권장)
│   ├── wirye.png 위례성  ungjin.png 웅진  hanseong.png 한성
│   └── jolbon.png 졸본  gungnae.png 국내성  pyongyang.png 평양성
└── bg/
    ├── battle.png  전장 배경 (가로, 권장 1600×1000)
    └── map.png     영지전 지도 배경 (가로, 권장 1600×1000)
```

생성 후 둘 중 하나로 변환/리사이즈하면 깔끔하다:
- 누끼(투명배경): remove.bg 등으로 배경 제거 → 메달 안에 인물만.
- 정사각 크롭: 얼굴/상반신이 가운데 오도록.

---

## 0. 공통 아트 디렉션 (모든 프롬프트 앞에 붙이기)

> **Style base**: Korean Three Kingdoms (Samhan) era historical painting, semi-realistic painterly digital art, dramatic rim lighting, muted earth-tone palette with gold accents, aged ink-and-wash texture, cinematic, high detail, consistent art style across a character roster. NOT anime, NOT chibi.

> **Negative (지원되면)**: text, watermark, signature, logo, modern clothing, modern background, blurry, lowres, extra fingers, cartoon, chibi, photo.

> **일관성 팁**: 8장 초상은 같은 모델·같은 seed 계열·같은 style 문자열로 뽑아야 "한 게임의 캐릭터들"처럼 보인다. 미드저니라면 `--style raw --ar 1:1`, 같은 `--sref`(스타일 레퍼런스) 권장.

---

## 1. 장수 초상 (portraits/*.png · 512×512 · 정사각 상반신)

각 프롬프트 = `[공통 아트 디렉션]` + 아래 문장.

**geunchogo.png — 근초고왕 (백제 / 기병 / 정복군주)**
> Portrait of a Baekje conqueror-king, 4th century Korea, mid-40s, regal and commanding, ornate lamellar armor with blue and gold, dragon motif, confident fierce gaze, riding-general aura, dark hair in topknot with a crown band. Bust shot, 3/4 view.

**gyebaek.png — 계백 (백제 / 보병 / 비장한 명장)**
> Portrait of a stern Baekje general, late 50s, weathered grim face, scarred, heavy iron infantry armor, resolute tragic-hero expression, gray-streaked beard. Bust shot.

**dochim.png — 도침 (백제 / 궁병 / 책략형 승려장수)**
> Portrait of a Baekje warrior-monk strategist, shaved head, sharp intelligent eyes, simple robe over light leather, holding a bow, calm cunning expression. Bust shot.

**heukchi.png — 흑치상지 (백제 / 창병 / 충직한 맹장)**
> Portrait of a powerful Baekje spear general, dark-skinned, broad and muscular, disciplined loyal expression, spear over shoulder, practical lamellar armor. Bust shot.

**gwanggaeto.png — 광개토대왕 (고구려 / 기병 / 최강 정복군주)**
> Portrait of the great Goguryeo conqueror-king, early 30s, imposing and heroic, magnificent black-and-gold heavy cavalry armor, fur-trimmed cloak, crowned helmet, overwhelming presence, fierce eyes. Bust shot, 3/4 view.

**eulji.png — 을지문덕 (고구려 / 궁병 / 최고 책략가)**
> Portrait of a legendary Goguryeo master strategist, 50s, long thin beard, piercing wise eyes, scholar-general in elegant dark robes with subtle armor, calm dangerous intellect. Bust shot.

**gochuga.png — 고추가 (고구려 / 보병 / 무장)**
> Portrait of a burly Goguryeo noble warrior, 40s, thick beard, rough confident grin, sturdy infantry armor with red accents, battle-hardened. Bust shot.

**mockji.png — 막리지 (고구려 / 창병 / 무장)**
> Portrait of a veteran Goguryeo spear commander, lean and stern, topknot, plain functional armor with green cloth, watchful expression. Bust shot.

---

## 2. 영지 건물 (buildings/*.png · 256×256 · 투명배경 권장)

각 = `[공통 아트 디렉션]` + 아래.

- **wirye.png 위례성** / **pyongyang.png 평양성**: `isometric ancient Korean walled capital fortress city with grand palace, stone walls, watchtowers, banners, game asset icon, transparent background.` (수도 — 가장 웅장하게)
- **hanseong.png 한성** / **gungnae.png 국내성**: `isometric ancient Korean fortified town, stone gate and wooden buildings, banners, game asset icon, transparent background.`
- **ungjin.png 웅진** / **jolbon.png 졸본**: `isometric small ancient Korean mountain fortress, wooden palisade and watchtower, game asset icon, transparent background.`

> 색 구분이 필요하면 백제 계열은 청색/금색 깃발, 고구려 계열은 적색/흑색 깃발로 프롬프트에 명시. (단, 소유권이 바뀌면 같은 그림을 쓰므로 깃발색은 중립으로 둬도 됨.)

---

## 3. 배경 (bg/*.png · 1600×1000 · 가로)

**battle.png — 전장 배경**
> `[공통 아트 디렉션]` + `wide ancient Korean battlefield from a slightly elevated view, open grassy plain with distant mountains and a river, overcast dramatic sky, empty foreground for unit placement, no characters, environment art.`

**map.png — 영지전 지도 배경**
> `[공통 아트 디렉션]` + `aged parchment war map of ancient Korea (Three Kingdoms), hand-drawn ink mountains rivers and forests, sepia tones, cartography style, no labels, no text, top-down strategic map.`

> 배경은 어둡고 디테일 과하지 않게 — 그 위에 유닛/노드가 올라가므로 **중앙은 비교적 비워**둬야 가독성이 산다. 너무 밝으면 코드에서 `.bgart { opacity:.6 }`로 낮추면 됨.

---

## 4. 넣은 뒤 확인

1. PNG를 위 경로/파일명 **정확히** 맞춰 저장 (소문자, 확장자 `.png`).
2. 브라우저 새로고침. 초상은 메달 안에, 건물은 노드 안에, 배경은 화면 전체에 자동 적용.
3. 안 보이면: 파일명 오타 / 경로 / 캐시(강력 새로고침 Ctrl+F5) 확인.
4. 비율이 어색하면 정사각으로 크롭하거나, 코드에서 `object-fit` 조정 요청.
