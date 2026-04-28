# Handoff: 해외 생활비 비교 앱 (Cost-of-Living Compare)

## Overview

서울 거주자가 해외 도시로 이동(유학·취업·이민)을 고민할 때, **본인 페르소나에 맞춰** 한 달 생활비를 서울과 비교해서 보여주는 모바일 앱. 메인 가치는 "한눈에 배수(↑1.9×)로 체감" — 환율 자동 변환, 카테고리별 듀얼 바, 항목 단위 상세까지 드릴다운.

PRD 기준 5개 핵심 화면을 hi-fi로 mock한 상태입니다.

## About the Design Files

이 번들의 HTML/JSX 파일들은 **디자인 레퍼런스**입니다 — 의도된 비주얼과 동작을 보여주는 프로토타입이지, 그대로 가져다 쓸 프로덕션 코드가 아닙니다.

작업의 목표는 이 디자인을 **타겟 코드베이스의 기존 환경**(예: React Native, Flutter, SwiftUI, Kotlin Compose 등)에 맞춰 그곳의 컴포넌트 패턴·라이브러리·디자인 시스템으로 **다시 구현하는 것**입니다. 만약 아직 코드베이스가 없다면, 모바일 앱에 가장 적합한 프레임워크를 선택해서 구현하시면 됩니다 (이 앱의 경우 한국어 사용자 + iOS·Android 양쪽 타겟이므로 **React Native** 또는 **Flutter** 추천).

## Fidelity

**High-fidelity (hifi)** — 픽셀 단위 레이아웃, 최종 색상·타이포그래피·간격·인터랙션이 모두 결정된 상태입니다. jhotpot(주문 앱) 스타일을 참고한 주황(#FC6011) + 네이비(#11263C) 팔레트를 적용했습니다.

타겟 코드베이스의 기존 컴포넌트 라이브러리를 사용하되, 색상·간격·타이포 스케일은 아래 디자인 토큰을 정확히 따라주세요.

## Screens / Views

총 5개 화면. 모든 화면은 iPhone 기준 **375×812 viewport**(디자인 mock은 320×680로 줄여 표현됨)로 설계.

---

### 1. Onboarding — 환영 + 페르소나 선택

- **Purpose**: 설치 직후 1회. "어떤 분이신가요?" — 유학생 / 취업자 / 아직 모름. 이후 홈으로 진입.
- **Layout**: 풀 세로 스택. 상단 24px 마진 → 글로브 아이콘(56×56, 주황 배경 18px 라운드) → 환영 메시지(2줄, 두 번째 줄 주황) → 짧은 설명 → "어떤 분이신가요?" 라벨 → 카드 3개 → 푸터 안내문.
- **Components**:
  - **Hero icon**: 56×56, border-radius 18px, background `#FC6011`, shadow `0 8px 24px rgba(252,96,17,0.3)`. 흰색 글로브 아이콘 28px.
  - **Greeting**: Manrope 800, 30px, 첫 줄 navy / 둘째 줄 orange. letter-spacing -0.02em, line-height 1.1.
  - **Persona card (primary, 유학생)**: padding 16px, border-radius 18px, border `1.5px solid #FC6011`, background `#FFF4ED`. 좌측 아이콘 박스 44×44 / 12px 라운드 / 주황 배경. Title `유학생` (Manrope 700, 14px). Sub `학비 · 셰어 · 식비 중심` (11px, gray-2). 우측 chevron 주황.
  - **Persona card (secondary, 취업자)**: 같은 골격, border `1px solid #E4ECF2`, background `#FFFFFF`, 아이콘 박스 `#F0F5F9`.
  - **Persona card (tertiary, 모름)**: border-style dashed, background transparent, 텍스트 `#52616B`로 약화.
  - **Footer text**: `설정에서 언제든 변경할 수 있어요`, 11px, gray-2, center align.
- **Behavior**: 카드 탭 → persona를 로컬 저장 → Home으로 navigation.

---

### 2. Home — 표준 스택 (즐겨찾기 우선)

- **Purpose**: 재방문 사용자가 빠르게 즐겨찾기 도시로 진입하거나, 새 도시를 검색.
- **Layout**: 상단 인사 + 프로필 → 검색 바 → 즐겨찾기 가로 스크롤 → 최근 본 도시 리스트 → 권역 필터 칩 → 하단 탭 바.
- **Components**:
  - **Greeting block**: `안녕하세요 👋` (12px tiny) + `어디 가시나요?` (h1, Manrope 800 24px). 우측 상단 user 아바타 40×40 14px 라운드.
  - **Search bar**: padding 12×14, background `#F0F5F9`, border-radius 14px. 좌측 search icon, placeholder `도시 검색 · 한글/영어`, 우측 filter icon.
  - **Favorite cards (horizontal scroll)**: min-width 168px, padding 16, border-radius 20px. 첫 카드는 `accent: navy`(#11263C 배경, 흰 텍스트). 나머지는 흰 배경 + 1px line border.
    - 상단: 국가코드 박스(32×24, 11px Manrope 800) + star icon
    - 도시명 16px Manrope 800
    - 영문 sub 11px opacity 0.7
    - 배수 24px Manrope 800 orange + `vs 서울` 11px opacity 0.6
  - **Recent cities list**: 카드 padding 10×12, border-radius 14px. 좌측 국가코드 박스 36×36 / 10px 라운드. 도시명 14px Manrope 700, 영문 11px gray-2. 우측 배수 14px Manrope 800 + chevron.
    - 색상 규칙: 배수가 ↑(비쌈)이면 orange, ↓(저렴)이면 gray-2로 약화.
  - **Region pills**: chip 8×14 padding, 12px, label + 카운트(opacity 0.6). active = navy fill / 흰 텍스트.
- **Behavior**: 카드 탭 → Compare(서울 vs 해당 도시)로 진입.

---

### 3. Compare — 듀얼 바 (앱의 메인 화면)

- **Purpose**: 앱의 심장. 한눈에 "서울 vs 도시 X" 한 달 비용 배수를 보여주고, 카테고리별로 SEO/CITY 두 막대를 나란히 비교.
- **Layout**: top bar(back / title / star) → 주황 hero card → 카테고리 듀얼 바 4개 → 출처 영역 → 하단 탭 바.
- **Components**:
  - **Top bar**: 36×36 아이콘 버튼 두 개(좌 back / 우 star), 가운데 `서울 vs 밴쿠버` 14px Manrope 700 + `1 CAD = 980원 · 04-27` 10px tiny. **아이콘 버튼 색이 다름**: back = `#F0F5F9` light, star = `#FFE9DC` orange-soft.
  - **Hero card (orange fill)**: padding 18, border-radius 22px, background `#FC6011`, color white, shadow `0 12px 32px rgba(252,96,17,0.25)`. 우상단에 반투명 흰 원(120×120, opacity 0.08) decorative.
    - 위 라벨: `한 달 예상 총비용` 11px uppercase letter-spacing 0.08em + info icon
    - 3-column row (모두 `whiteSpace: nowrap`, `flexShrink: 0`로 squeeze 방지):
      - 좌: `서울` 11px / `175만` 18px Manrope 700
      - 가운데: `↑1.9×` 30px Manrope 800 / `+165만/월` 10px (caption은 슬래시로 줄바꿈 방지)
      - 우: `밴쿠버` 11px / `340만` 18px Manrope 800
    - 하단 split bar: 6px height, 두 흰 segment(50% opacity 0.5, 45% opacity 1.0) gap 4px
    - 푸터: `평균 가정 기준 · ❓ 자세히` 10px white opacity 0.7
  - **Compare pair card** (월세, 식비, 교통, 비자/정착): padding 12, border-radius 16px, white card, 1px line border.
    - 헤더 row: 좌측 아이콘 박스 32×32 10px 라운드 (hot=`#FFE9DC`+orange icon, normal=`#F0F5F9`+navy icon) + 라벨 14px Manrope 700 (`whiteSpace: nowrap`, `flex: 1`로 squeeze 방지) / 우측 배수 14px Manrope 800 (hot=orange, normal=navy).
    - 두 막대(SEO=gray, VAN=orange): 8px height, 4px radius, track `#F0F5F9`. 좌측 라벨(`SEO`/`VAN`, 28px width, 10px Manrope 700 — 색상 일치) / 막대 / 우측 값 56px width 11px right-align.
    - **Hot rule**: 배수가 ↑2× 이상이면 hot 카드(아이콘 컨테이너 주황). 비자처럼 서울에 없는 항목은 mult `신규`로 표기.
  - **Source footer**: 1px dashed top border, `출처 12개 · 갱신 2026-04-01` tiny / `출처 보기 →` orange 700.
- **Behavior**: 카테고리 카드 탭 → Detail(해당 카테고리)로 진입.

---

### 4. Detail — 식비 (섹션 리스트 예시)

- **Purpose**: 한 카테고리 내 항목 단위 비교. 외식/식재료 두 섹션, 한 줄 = 한 품목.
- **Layout**: top bar(back / 식비 + 도시쌍 / more) → navy hero card(카테고리 합) → 외식 섹션 → 식재료 섹션 → 출처 영역.
- **Components**:
  - **Hero card (navy fill)**: padding 16, border-radius 20px, background `#11263C` color white. 비교 hero와 같은 3-column row 구조지만 색상 위계가 다름 (메인=주황 / 카테고리=네이비). 가운데 배수만 `#FC6011`로 강조.
    - Progress bar: 4px height, 70% orange fill, track `rgba(255,255,255,0.15)`.
    - 푸터: `자취 70% + 외식 30% 가정` 10px white opacity 0.6.
  - **Section label**: `외식` / `식재료` (label-mono: Manrope 600 10px uppercase letter-spacing 0.1em gray-2) + 우측 항목 수 `2 항목` 10px tiny.
  - **Grocery row**: padding 10px 0, 1px bottom border (`#E4ECF2`), gap 12px.
    - 좌측 이모지 박스 36×36, 10px 라운드, 18px 이모지. hot=`#FFE9DC`, normal=`#F0F5F9`.
    - 가운데 col: 품목명 13px Manrope 700 / `1.2만 → 2.2만` 11px tiny.
    - 우측 배수 13px Manrope 800 (hot=orange, normal=gray).
  - **Hot rule**: ↑2× 이상이면 행 hot 처리(예: 신라면 ↑2.5×, 식당 한끼 ↑1.8×는 비-hot이지만 디자인에서는 hot=true로 강조).
  - **Source row**: `출처` label / `Statistics Canada` 11px navy 600 / `출처 보기 →` orange 700.
- **Behavior**: 출처 보기 → 출처 페이지(별도, hi-fi 미작성).

---

### 5. Settings — 프로필 느낌 (모드 + 통계 + 메뉴)

- **Purpose**: 로그인 없이도 '내 앱' 느낌. 현재 페르소나 표시 + 사용 통계 + 메뉴.
- **Layout**: header(`설정` h1 + more) → 페르소나 카드(navy gradient) → 통계 카드 3개 → 메뉴 리스트(단일 카드 그룹) → 푸터.
- **Components**:
  - **Persona card (navy gradient)**: padding 18, border-radius 22px, background `linear-gradient(135deg, #11263C 0%, #1d3a55 100%)`, color white, shadow `0 12px 32px rgba(17,38,60,0.18)`. 우상단에 주황 반투명 원(100×100, `rgba(252,96,17,0.15)`) decorative.
    - 좌측 아이콘 박스 56×56 18px 라운드 orange + 28px 페르소나 아이콘
    - 가운데 col: `유학생 모드` 16px Manrope 800 / `서울에서 출발 · 학비 중심` 11px opacity 0.7
    - 우측 `변경` 버튼: padding 6×12, border-radius 10px, `rgba(255,255,255,0.12)` bg + `rgba(255,255,255,0.2)` border, 11px 600.
  - **Stat cards (3개)**: flex row gap 8px. 각 카드 padding 14, border-radius 16, center align. 큰 숫자 22px Manrope 800 orange + 라벨 11px tiny.
    - `3 즐겨찾기` / `7 최근 본` / `20 도시 DB`
  - **Menu list (single card group)**: padding 0, border-radius 18, overflow hidden. 각 row padding 14×14, gap 12, 1px bottom border (마지막 제외).
    - 아이콘 박스 36×36, 10px 라운드. 첫 항목(`데이터 새로고침`)은 hot=orange로 강조. 나머지는 navy/light. 마지막(`앱 정보`)은 dim gray-2.
    - 라벨 13px Manrope 700 + 우측 보조 텍스트 11px tiny + chevron.
    - 항목: 데이터 새로고침 / 데이터 출처 보기 / 피드백 보내기 / 개인정보 처리방침 / 앱 정보(v1.0.0)
  - **Footer**: `Made with ♥ in Seoul · 2026` 10px tiny center.

---

## Interactions & Behavior

- **Navigation**: 5개 화면은 stack 기반. Onboarding은 root에서 1회, 이후 Home이 root.
- **Bottom tab bar**: 4개 탭(홈 / 비교 / 즐겨찾기 / 설정). active = orange icon + label, inactive = gray-2. icon 22px, label 10px Mulish 600.
- **Card tap**: 약 100ms scale-down (transform: translateY(1px)) — primary button 참고.
- **List rows**: chevron이 있는 행은 모두 탭 가능. tap 시 next screen으로 push.
- **숫자 표기**: 한국어 단위 사용 (만/천). 소수는 만원 단위에서만(예: 1.2만). 배수는 `↑1.9×` 형태 (소수 1자리, × 기호 사용).
- **환율 표시**: Compare 화면 상단에 `1 CAD = 980원 · 04-27` 형태로 항상 노출.
- **Hot threshold**: 배수 ≥ 2.0× → 카드/행을 hot 처리(아이콘 박스 orange tint, 배수 텍스트 orange).
- **데이터 fetch**: 새로고침 버튼은 `2026-04-01` 같은 마지막 갱신 일자를 표시.

## State Management

- `persona`: `student | worker | unknown` — 온보딩에서 결정, 설정에서 변경.
- `homeCity`: 기본 `seoul` (PRD에서 고정).
- `targetCity`: 사용자가 비교 중인 도시 (예: vancouver).
- `favorites`: city id 배열 (max 자유, 가로 스크롤).
- `recentCities`: 최근 본 도시 id 배열 (max 5~10).
- `exchangeRates`: { CAD: 980, USD: 1340, EUR: 1450, ... } — 일별 갱신.
- `lastSync`: ISO date string.

데이터 모델 예시:
```ts
type City = {
  id: string;
  ko: string;          // "밴쿠버"
  en: string;          // "Vancouver"
  countryCode: string; // "CA"
  currency: string;    // "CAD"
  region: 'na' | 'eu' | 'asia' | 'oceania' | 'me';
};

type CategoryComparison = {
  category: 'rent' | 'food' | 'transport' | 'visa';
  seoulValue: number;  // KRW
  cityValue: number;   // local currency
  cityValueKRW: number;
  multiplier: number;  // 1.9
  isNew?: boolean;     // 비자처럼 서울에 없는 경우
};

type ItemComparison = {
  id: string;
  emoji: string;
  name: string;
  seoulPrice: number;
  cityPrice: number;
  multiplier: number;
  section: 'dining' | 'grocery' | 'utilities' | ...;
};
```

## Design Tokens

### Colors

```
--orange:        #FC6011  /* primary, hot, accent */
--orange-soft:   #FFE9DC  /* hot icon container bg */
--orange-tint:   #FFF4ED  /* primary persona card bg */
--navy:          #11263C  /* text primary, bottom-tab inactive bg, hero */
--navy-2:        #1d3a55  /* gradient end (settings persona card) */
--gray:          #52616B  /* secondary text, ghost button */
--gray-2:        #8A98A0  /* tertiary text, inactive icons, captions */
--light:         #F0F5F9  /* light surface (search bar, icon containers) */
--light-2:       #F7FAFC  /* alternate light surface */
--white:         #FFFFFF
--line:          #E4ECF2  /* card borders, dividers */
```

### Shadows

```
--shadow-card:  0 8px 24px rgba(17,38,60,0.06)
--shadow-deep:  0 20px 50px rgba(17,38,60,0.10)
--shadow-orange-cta: 0 6px 16px rgba(252,96,17,0.25)
--shadow-orange-hero: 0 12px 32px rgba(252,96,17,0.25)
--shadow-navy-card: 0 12px 32px rgba(17,38,60,0.18)
```

### Typography

- **Headings / numbers**: `Manrope` (Google Fonts, weights 400 500 600 700 800), letter-spacing -0.02em on display, -0.01em on h2.
- **Body**: `Mulish` (Google Fonts, weights 400 500 600 700 800), line-height 1.4 default.
- 두 폰트 모두 한국어 fallback 필요 (Pretendard, Apple SD Gothic Neo, system-ui 권장).

Type scale:
```
display:   30px / Manrope 800 / line-height 1.1
h1:        24px / Manrope 800 / -0.02em
h2:        18px / Manrope 700 / -0.01em (16px in mobile context often)
h3:        14px / Manrope 700
body:      14px / Mulish 400 / line-height 1.4
small:     12px / Mulish 400 / gray
tiny:      11px / Mulish 400 / gray-2
mono-label: 10px / Manrope 600 / uppercase / letter-spacing 0.1em / gray-2
```

### Spacing & Radius

```
border-radius cards:      18 / 20 / 22px (hero용)
border-radius buttons:    14px
border-radius chips/pills: 999px
border-radius small icons: 10 / 12px
border-radius medium:     14 / 16px

phone screen padding:     16~22px horizontal, 8px top
section gap:              14~18px vertical
card internal padding:    12~18px
```

### Status Bar / Phone Frame

디자인은 320×680 phone shell로 표현되었지만, 실제 구현은 iPhone 375×812 / Android equiv 기준. status bar height 44px, bottom tab bar 64px (safe area 14px 포함).

## Assets

- **Fonts**: Manrope, Mulish (Google Fonts에서 로드, 또는 codebase에 self-host).
- **Icons**: 모두 inline SVG로 작성됨. line style, stroke 1.8~2.2px, viewBox 24×24. 22개 아이콘:
  - home, compare, star, settings, search, back, more, house, fork, bus, passport, graduation, briefcase, globe, chev-right, chev-down, info, refresh, mail, shield, book, user, plus, filter, up
  - Lucide / Heroicons / Phosphor 같은 라이브러리로 1:1 대체 가능. **권장**: lucide-react (스트로크 스타일·viewBox 24×24 일치).
- **Emojis**: detail 화면 식재료 행에서 사용 (🍱 ☕ 🍜 🥚 🍚 🥩 🥛 🍞 🍎). OS 네이티브 이모지 사용. 추후 이미지 자산으로 대체 가능.
- **Flags / Country codes**: 국기 PNG 의존 없이 `CA` `US` `DE` 같은 mini 라벨 박스로 처리 (의도적). 추후 실제 국기 추가 시 이 박스를 그대로 swap.

## Files

`design_handoff_cost_compare/` 안의 파일들:

- **README.md** — 이 문서.
- **hifi-standalone.html** — 단일 HTML로 번들된 버전. 더블클릭으로 바로 열립니다 (모든 외부 의존성 inline). 빠르게 디자인을 확인할 때 이걸 열어보세요.
- **hifi.html** — 원본 entry HTML. CSS·디자인 토큰·폰트 로드·React 부트스트랩이 모두 들어 있습니다.
- **hifi/** — 화면별 React JSX 컴포넌트 소스:
  - `_shared.jsx` — Phone shell, Status bar, Bottom tabs, **Icon set**, ComparePair (재사용 컴포넌트). 구현 시 가장 먼저 참고하세요.
  - `onboarding.jsx` — Onboarding 화면.
  - `home.jsx` — Home 화면 + FavCard, RegionPill 서브컴포넌트.
  - `compare.jsx` — Compare 화면 (메인 화면).
  - `detail.jsx` — 식비 Detail 화면 + GroceryRow.
  - `settings.jsx` — Settings 화면.
  - `app.jsx` — 탭 네비게이션 (디자인 미리보기용 chrome — 실제 앱에서는 stack navigator로 대체).

### 참고 사항

- `app.jsx`의 탭 네비게이션은 디자인 5개 화면을 한 페이지에 보여주기 위한 **데모용 chrome**입니다. 실제 앱에서는 React Navigation / Flutter Navigator 같은 stack/bottom-tab navigator로 대체.
- 모든 컴포넌트는 `Phone` shell 안에서 렌더링됩니다 — shell은 디자인 mock용이고, 실제 앱에선 SafeAreaView + ScrollView 등으로 대체.
- 색상·간격·타이포 값은 `hifi.html`의 `<style>` 블록과 각 jsx의 inline style에 명시되어 있으니, 필요한 값은 거기서 정확히 복사하세요.

## 구현 우선순위 제안

1. **Design tokens** 먼저 — 위 토큰을 theme 파일로 옮기기.
2. **Shared components** 두 번째 — Icon set, Phone shell(있으면), Bottom tab bar, ComparePair, GroceryRow.
3. **Compare 화면** — 앱의 메인이자 가장 복잡한 레이아웃. 먼저 만들면 다른 화면이 쉬워짐.
4. 나머지 화면 → Detail → Home → Settings → Onboarding 순.

질문이나 모호한 부분 있으면 디자인 파일 자체(특히 `hifi-standalone.html`)를 열어 픽셀을 확인하시거나 디자이너에게 문의하세요.
