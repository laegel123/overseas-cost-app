# UI 디자인 가이드

해외 생활비 비교 앱의 시각·인터랙션 단일 출처. 픽셀 수준 명세는 `docs/design/README.md` 와 `docs/design/hifi/*.jsx` 를 1차 참조하고, 본 문서는 그 명세를 코드로 옮길 때의 규칙·우선순위·금지 사항을 정리한다.

## 디자인 원칙

1. **도구다, 마케팅 사이트가 아니다.** 매일 쓰는 가계부처럼 정보 위계가 명확하고, 장식이 적어야 한다. 데이터를 가리는 모든 요소는 제거.
2. **한국 사용자가 1차.** 한국어 단위(만/천), 한국식 가격 감각(예: 셰어 vs 원룸), 한국어 폰트 가독성을 영어보다 우선한다.
3. **숫자 → 인사이트.** 모든 카드의 결론은 한 줄(배수 + 차액). 사용자가 30초 안에 "이 도시는 1.9배 비싸다" 를 체감해야 한다.
4. **색상에만 의존하지 않는다.** 배수는 항상 화살표(↑/↓) + 숫자 + 색 3중. 색맹·색약 사용자도 동일한 정보를 얻는다.
5. **출처를 숨기지 않는다.** 모든 비교 화면 푸터에 출처 + 갱신일을 노출. "출처 보기" 링크는 항상 도달 가능.

## AI 슬롭 안티패턴 — 하지 마라

| 금지 사항                                        | 이유                                                            |
| ------------------------------------------------ | --------------------------------------------------------------- |
| backdrop-filter: blur() / glass morphism         | AI 템플릿의 가장 흔한 징후. RN 에서도 BlurView 남발 금지.       |
| gradient text (배경 그라데이션 텍스트)           | AI SaaS 랜딩 1번 특징. 본문에 절대 사용 금지.                   |
| "Powered by AI" 배지·문구                        | 기능이 아니라 장식. 사용자에게 가치 없음.                       |
| box-shadow 글로우 애니메이션                     | 네온 글로우 = AI 슬롭. shadow 는 토큰화된 정적 값만.            |
| 보라/인디고 브랜드 색상                          | "AI = 보라색" 클리셰. 우리 팔레트는 orange + navy.              |
| 모든 카드에 동일한 rounded-3xl                   | 라운드는 위계별 다르다 (chip 999, button 14, card 18, hero 22). |
| 배경 gradient orb (blur-3xl 원형)                | 모든 AI 랜딩에 있는 장식. 본 앱에는 등장 안 함.                 |
| 무의미한 마이크로 인터랙션 (spinning, breathing) | 인터랙션은 사용자 액션의 피드백일 때만. 자기 목적 금지.         |

## 색상 토큰

`docs/design/README.md` §Design Tokens 와 1:1 일치. 변경 시 ADR 필요.

```
--orange:        #FC6011   /* primary CTA, hot threshold */
--orange-soft:   #FFE9DC   /* hot icon container bg */
--orange-tint:   #FFF4ED   /* primary persona card bg */
--navy:          #11263C   /* primary text, hero card */
--navy-2:        #1d3a55   /* gradient end (settings persona card) */
--gray:          #52616B   /* secondary text */
--gray-2:        #8A98A0   /* tertiary text, captions, inactive icons */
--light:         #F0F5F9   /* light surface (search bar, icon container) */
--light-2:       #F7FAFC   /* alt light surface */
--white:         #FFFFFF
--line:          #E4ECF2   /* card borders, dividers */
```

### 시맨틱 매핑

| 의미                   | 토큰   |
| ---------------------- | ------ |
| 비쌈(hot) / 강조 / CTA | orange |
| 본문 텍스트            | navy   |
| 보조 텍스트            | gray   |
| 캡션·비활성            | gray-2 |
| 카드 표면              | white  |
| 입력·검색 표면         | light  |
| 분리선·외곽선          | line   |

**금지**: 순수 검정(`#000`)·순수 흰색만으로 본문 구성 금지. 토큰 외 임의 hex 금지.

## 그림자 토큰

```
--shadow-card:        0 8px 24px  rgba(17,38,60,0.06)
--shadow-deep:        0 20px 50px rgba(17,38,60,0.10)
--shadow-orange-cta:  0 6px 16px  rgba(252,96,17,0.25)
--shadow-orange-hero: 0 12px 32px rgba(252,96,17,0.25)
--shadow-navy-card:   0 12px 32px rgba(17,38,60,0.18)
```

RN 에서는 `Platform.select` 로 iOS shadow / Android elevation 모두 처리하되 토큰 값은 동일.

## 타이포그래피

폰트: **Manrope**(헤더·숫자), **Mulish**(본문), **Pretendard**(한국어 fallback).

| 스타일     | 사양                                          | 컴포넌트      |
| ---------- | --------------------------------------------- | ------------- |
| display    | Manrope 800 / 30 / 1.1 / -0.02em              | `<Display>`   |
| h1         | Manrope 800 / 24 / -0.02em                    | `<H1>`        |
| h2         | Manrope 700 / 18 / -0.01em                    | `<H2>`        |
| h3         | Manrope 700 / 14                              | `<H3>`        |
| body       | Mulish 400 / 14 / 1.4                         | `<Body>`      |
| small      | Mulish 400 / 12 / gray                        | `<Small>`     |
| tiny       | Mulish 400 / 11 / gray-2                      | `<Tiny>`      |
| mono-label | Manrope 600 / 10 / uppercase / 0.1em / gray-2 | `<MonoLabel>` |

**금지**: Text 컴포넌트에 inline `fontFamily` 직접 지정 금지. 항상 위 8개 컴포넌트 중 하나 사용.

한국어 fallback 자동 적용: 폰트 패밀리 정의에 `Manrope, Pretendard, "Apple SD Gothic Neo", system-ui` 식 fallback chain 포함.

## 간격·라운드

```
section gap (vertical):    14~18px
phone padding (horizontal): 16~22px
card internal padding:     12~18px

border-radius
  chip / pill:    999
  button:         14
  card / icon-md: 16~18
  hero card:      20~22
  small icon:     10~12
```

## 컴포넌트 사양

### Hero card (오렌지 / 네이비 두 variant)

- Compare 메인 hero = orange (`#FC6011` fill, white text, orange-hero shadow)
- Detail 카테고리 hero = navy (`#11263C` fill, white text, navy-card shadow). 가운데 배수만 orange 강조.
- 3-column row (좌:서울 / 가운데:배수 / 우:도시) 모두 `whiteSpace: nowrap` (RN 은 `numberOfLines={1}`) 로 squeeze 방지.
- Progress bar: orange variant 6px, navy variant 4px.

### ComparePair (Compare 듀얼 바)

- 카드 padding 12, radius 16, white bg, 1px line border.
- 헤더: 좌측 32×32 아이콘 박스(hot 시 `#FFE9DC` + orange icon, 정상은 `#F0F5F9` + navy icon) + 라벨 14 Manrope 700 / 우측 배수 14 Manrope 800.
- 막대: SEO=gray, CITY=orange, 8px height, 4px radius, track `#F0F5F9`. 좌측 라벨 28px width / 우측 값 56px width 11px right.
- **Hot rule**: `mult >= 2.0 || hot === true` → 아이콘 박스 + 배수 텍스트 orange.
- 신규(서울에 없는 항목, 비자 등): mult `'신규'` 표기, 배수 색은 navy.

### GroceryRow (Detail 식재료 행)

- 36×36 이모지 박스(hot 시 `#FFE9DC`, 정상 `#F0F5F9`), 13px Manrope 700 품목명, `1.2만 → 2.2만` 11px tiny.
- 우측 배수 13px Manrope 800.

## 카테고리별 상세 화면 사양

식비(food) 외 5개 카테고리. 모두 동일 골격: navy hero(카테고리 합계) → 섹션 라벨 → 항목 행 → 출처. 섹션·행 구성만 카테고리별로 다름.

### 🏠 rent (월세) 상세

- **navy hero**: 라벨 "월 임차료 (메디안)", 좌·우값은 페르소나 매핑 (student=share, worker=oneBed). 가운데 배수.
- **섹션 1**: "주거 형태" — 4행 (RentRow): 셰어 / 원룸·스튜디오 / 1베드룸 / 2베드룸. 각 행: 36×36 아이콘 박스(`house`) + "셰어" 13px M700 + "70만 → 180만" 11px tiny + 우측 배수.
- **섹션 2**: "정착 비용" (옵션) — 보증금·디포짓 1행. 데이터 있을 때만.
- **출처**: footer 동일 패턴.

### 🚇 transport (교통) 상세

- **navy hero**: 라벨 "월 교통비 (정기권)". 페르소나 무관.
- **섹션 1**: "정기권·1회권" — 2행: 월정기권 / 1회권.
- **섹션 2**: "택시" — 1행: 기본요금. (도시별 기본요금만, 거리 요금 미포함)
- **취업자 페르소나만**: 섹션 3 "차량 운영" — 보험·연료 추정 (있을 때).
- **출처**: footer.

### 🎓 tuition (학비) 상세 — 유학생 전용

- **navy hero**: 라벨 "연간 학비 (국제학생)". 가운데 배수는 "vs 서울 0원" 의미 없음 → "신규" 표기.
- **섹션 1**: "주요 대학" — 도시별 대학 3~5개 행 (TuitionRow): 36×36 `graduation` 아이콘 + 학교명 13px M700 + "학사 / Arts" 11px tiny + 우측 연간 학비 13px M800.
- **섹션 2**: "학위 단계" (해당 대학) — 학사 / 석사 / 어학연수 3행 (선택).
- **출처**: 각 대학 공식 페이지 링크 노출.

### 💼 tax (세금/실수령) 상세 — 취업자 전용

- **navy hero**: 라벨 "연봉 8만 기준 실수령". 좌·우는 KRW 환산 실수령액. 배수는 양국 takeHome 비교.
- **섹션 1**: "연봉대별 실수령" — 6만 / 8만 / 10만 (현지통화 + KRW) 3행 (TaxRow).
- **섹션 2**: "세금 구성" — 소득세·사회보험·지방세 3행 비율 (옵션).
- **고지**: "단신 기준 추정 · 실제는 공제·가족 등으로 변동" 11px tiny gray-2.
- **출처**: 각국 정부 calculator·brackets 출처.

### 📋 visa (비자/정착) 상세 — 1회성

- **navy hero**: 라벨 "정착 1회성 비용". 가운데 배수 "신규" (서울 미존재).
- **섹션 1**: "비자 종류별 신청비" — 학생·워홀·취업·영주 (해당) 행 (VisaRow).
- **섹션 2**: "정착 부대비용" — 건강검진·항공권·기타 추정 행.
- **고지**: "비자 정책은 변경 빈도 높음 · 정부 페이지 확인 필수" 11px tiny gray-2 + "정부 페이지 보기 →" 링크.

### 카테고리 공통 구성요소

#### `RentRow` / `TuitionRow` / `TaxRow` / `VisaRow` (도메인 행)

- 모두 `MenuRow` 와 같은 골격에서 우측 표기만 다름:
  - RentRow: `"70만 → 180만 ↑2.6×"`
  - TuitionRow: `"-- → 4,500만/년"` (서울 N/A)
  - TaxRow: `"실수령 0.78 → 0.74"`
  - VisaRow: `"-- → 15만 (1회)"`
- `padding 10×0`, `border-bottom 1px #E4ECF2` (마지막 제외).

## 시트 콘텐츠 사양

ARCHITECTURE.md 의 라우팅 디테일 + UI_GUIDE.md §시트·모달 의 골격을 정확한 텍스트로.

### Sheet A — "한 달 예상 총비용" 가정값 (Compare hero ❓ 탭)

```
┌────────────────────────────────┐
│ 한 달 예상 총비용 가정          │
│                                  │
│ 🎓 유학생 모드 (현재):           │
│   • 셰어 1실 월세                │
│   • 자취 70% + 외식 30% 식비     │
│   • 월정기권 교통비              │
│                                  │
│   학비는 합계에 미포함           │
│   (아래 별도 라인 참고)          │
│                                  │
│ 제외 항목:                       │
│   통신비 · 의류 · 여가           │
│   1회성(비자·정착·디포짓)        │
│   의료비(v1.0)                   │
│                                  │
│ 환율 기준일: 2026-04-27          │
│ 데이터 갱신: 2026-04-01          │
│                                  │
│            [닫기]                │
└────────────────────────────────┘
```

- bottom sheet, top corners radius 22, white bg, navy text
- 페르소나에 따라 첫 섹션만 변경 (취업자: "1인 원룸 / 자취50+외식50 / 월정기권")
- swipe-down 또는 외부 영역 탭 → dismiss
- "닫기" 버튼 (orange, full-width) — 명시적 닫기

### Sheet B — 페르소나 변경 (설정 "변경" 탭)

```
┌────────────────────────────────┐
│ 페르소나 변경                    │
│                                  │
│ ⦿ 🎓 유학생  (현재)              │
│ ○ 💼 취업자                      │
│ ○ 🤔 아직 모름                   │
│                                  │
│ 변경하면 비교 화면 카드 구성이   │
│ 바뀝니다. 즐겨찾기는 유지됩니다. │
│                                  │
│        [취소]    [변경]          │
└────────────────────────────────┘
```

- bottom sheet, 라디오 그룹
- 선택 후 "변경" 탭 → store 갱신 + dismiss + 토스트 "페르소나가 (취업자)로 변경되었어요"
- "취소" → dismiss (아무 변경 없음)
- 선택만 즉시 적용하지 않음 (실수 방지)

### Sheet C — 출처 보기 (Compare/Detail "출처 보기 →" 탭)

```
┌────────────────────────────────┐
│ ←   데이터 출처 (12개)           │
│                                  │
│ 🏠 월세                          │
│   • Statistics Canada CMHC       │
│     접속일: 2026-04-01           │
│     [페이지 열기 →]               │
│                                  │
│ 🍴 식비                          │
│   • Statistics Canada CPI        │
│     접속일: 2026-04-01           │
│     [페이지 열기 →]               │
│                                  │
│ 🎓 학비                          │
│   • UBC International Tuition    │
│     접속일: 2026-04-01           │
│     [페이지 열기 →]               │
│                                  │
│ ... (도시별 sources 배열)        │
│                                  │
│ 📊 자동화 정책 안내               │
│ 모든 데이터는 공공 출처에서       │
│ 자동으로 갱신됩니다.              │
└────────────────────────────────┘
```

- full-screen modal (presentation: 'modal')
- 카테고리별 그룹핑 + 출처 카드 리스트
- "페이지 열기 →" 탭 → `Linking.openURL(url)` (외부 브라우저)
- 좌상단 ← 또는 swipe-down → dismiss

## 인터랙션 정확 명세

### Card press 애니메이션

```
press in:
  duration:  100ms
  easing:    ease-out
  transform: scale(0.98)
  opacity:   0.9 (선택)

press out:
  duration:  150ms
  easing:    ease-in-out
  transform: scale(1.0)
  opacity:   1.0
```

- React Native: `Pressable` 의 `style={({pressed}) => ...}` + `Animated.timing` 또는 `react-native-reanimated`
- 햅틱: 기본 호출 안 함 (저전력 디바이스 배려). 즐겨찾기 토글만 light haptic (선택, v1.1).

### 스크롤·제스처

- 화면 간: 기본 RN stack 전환 (push from right). iOS swipe-back 활성.
- 가로 스크롤 (홈 즐겨찾기): 자연스러운 deceleration, snap 없음.
- pull-to-refresh: **v1.0 미지원** (정책: 설정에서 명시적 새로고침만)
- 시트: swipe-down (≥30% 거리 또는 ≥1000px/s 속도) 또는 외부 영역 탭으로 dismiss.

### 키보드 (검색바)

- focus: 검색바 활성 시 keyboard 자동 등장
- return key: "검색" (`returnKeyType="search"`)
- return 탭: keyboard dismiss + 결과 유지 (별도 액션 없음)
- 외부 영역 탭: keyboard dismiss + 결과 유지
- ScrollView 와 키보드 충돌: `KeyboardAvoidingView` 또는 `keyboardShouldPersistTaps="handled"`

### 검색 매칭 알고리즘

상세는 ARCHITECTURE.md §검색 알고리즘. UI 측면:

- debounce: **300ms** (입력 종료 후 300ms 뒤 매칭)
- 빈 입력: 전체 도시 표시
- 매칭 0건: "검색 결과 없음 · '도쿄', '밴쿠버' 등으로 검색해 보세요" 안내
- 결과 정렬: prefix 매칭 우선, 그 다음 substring 매칭

## 빈 상태 CTA 텍스트 정확

| 화면·상태                                                    | 안내 + CTA                                                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 홈 — 즐겨찾기 0개                                            | "관심 있는 도시를 골라보세요" + 권역 그리드 노출                                             |
| 홈 — 최근 본 0개                                             | (섹션 미표시, 빈 상태 표기 안 함)                                                            |
| 홈 — 검색 결과 0건                                           | "'\_\_'에 해당하는 도시가 없어요\n다른 이름으로 검색해 보세요"                               |
| Compare — 데이터 로드 실패                                   | "데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." + [다시 시도]                      |
| Detail — 카테고리 데이터 부재                                | "이 카테고리는 아직 준비 중이에요" + [돌아가기]                                              |
| Detail — 잘못된 카테고리                                     | "찾을 수 없는 카테고리예요" + [돌아가기]                                                     |
| Detail — 페르소나 mismatch (예: worker 가 tuition 직접 진입) | "이 카테고리는 유학생 모드에서만 볼 수 있어요" + [페르소나 변경] (Sheet B 열림) + [돌아가기] |
| Detail — 페르소나 mismatch (student 가 tax 직접 진입)        | "이 카테고리는 취업자 모드에서만 볼 수 있어요" + 동일 CTA                                    |
| 설정 — 데이터 새로고침 실패                                  | 토스트 "데이터를 갱신할 수 없어요" + dev 콘솔 에러                                           |
| 설정 — 데이터 새로고침 성공                                  | 토스트 "최신 데이터로 업데이트했어요"                                                        |

## UI 텍스트 한국어 표준 (디자인 검증된 정확 텍스트)

`src/i18n/strings.ko.ts` 에 박제하여 컴포넌트는 키 참조. 디자인 mock 의 실제 텍스트와 자동 검증 (TESTING.md §9.27.2).

### 온보딩 (`onboarding.jsx`)

```ts
greeting1: '안녕하세요',
greeting2: '어디로 떠나시나요?',
intro: '서울 기준으로 해외 도시의 생활비를\n본인 페르소나에 맞게 비교해 드려요.',
personaQuestion: '어떤 분이신가요?',
personaStudentTitle: '유학생',
personaStudentSub: '학비 · 셰어 · 식비 중심',
personaWorkerTitle: '취업자',
personaWorkerSub: '실수령 · 1인 원룸 · 의료',
personaUnknownTitle: '아직 모르겠어요',
personaUnknownSub: '둘 다 보여드릴게요',
onboardingFooter: '설정에서 언제든 변경할 수 있어요',
```

### 홈 (`home.jsx`)

```ts
homeGreeting: '안녕하세요 👋',
homeTitle: '어디 가시나요?',
searchPlaceholder: '도시 검색 · 한글/영어',
favoritesSection: '즐겨찾기',
favoritesViewAll: '전체 보기',  // v1.0: 시각만
recentSection: '최근 본 도시',
regionSection: '권역별 탐색',
regionsKr: { na: '북미', eu: '유럽', asia: '아시아', oceania: '오세아니아', me: '중동' },
emptyFavorites: '관심 있는 도시를 골라보세요',
emptySearch: (q: string) => `'${q}'에 해당하는 도시가 없어요\n다른 이름으로 검색해 보세요`,
```

### Compare/Detail (`compare.jsx`, `detail.jsx`)

```ts
compareHeroLabel: '한 달 예상 총비용',
compareHeroFooter: '평균 가정 기준 · ❓ 자세히',
compareSourcesFooter: (n: number, date: string) => `출처 ${n}개 · 갱신 ${date}`,
compareSourcesLink: '출처 보기 →',
detailFoodHero: '월 예상 식비 (혼합)',
detailFoodAssumption: '자취 70% + 외식 30% 가정',
sectionDining: '외식',
sectionGroceries: '식재료',
itemCount: (n: number) => `${n} 항목`,
```

### 설정 (`settings.jsx`)

```ts
settingsTitle: '설정',
personaModeStudent: '유학생 모드',
personaModeWorker: '취업자 모드',
personaModeUnknown: '미선택',
personaSubStudent: '서울에서 출발 · 학비 중심',
personaSubWorker: '서울에서 출발 · 실수령 중심',
personaSubUnknown: '둘 다 보여드려요',
personaChange: '변경',
statFavorites: '즐겨찾기',
statRecent: '최근 본',
statCityDb: '도시 DB',
menuRefresh: '데이터 새로고침',
menuSources: '데이터 출처 보기',
menuFeedback: '피드백 보내기',
menuPrivacy: '개인정보 처리방침',
menuAppInfo: '앱 정보',
settingsFooter: 'Made with ♥ in Seoul · 2026',
```

### 디자인 vs 데이터 정의 차이 처리

디자인 mock 의 일부 항목 표기가 데이터 정의와 다른 경우:

| 항목 | 디자인 mock                | 데이터 정의    | 통일 정책                                                                                                                                                              |
| ---- | -------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 사과 | `사과 1개` (1.5천 → 1.8천) | `apple1kg` 1kg | **데이터는 1kg, 표시는 도시 관습** (한국 슈퍼는 1개 단위 흔함). UI 표시는 strings.ko 의 `groceryLabels.apple` 로 분리. v1.0 은 1kg 단위로 통일 (디자인 mock 수정 권장) |
| 양파 | (디자인 mock 누락)         | `onion1kg`     | UI 표시 시 1kg, 디자인 mock 양파 추가 권장                                                                                                                             |

데이터·UI 일관성을 위해 모든 식재료는 1kg/1L/1봉 단위 (`docs/DATA.md` §11.3 표준).

## 에러 메시지 한국어 표준 카탈로그

ADR-014·ADR-036 에 따라 사용자에게 보일 모든 에러 메시지를 카탈로그화. `src/i18n/errors.ko.ts` 단일 출처.

| 에러 코드                | 한국어 메시지                                              | 노출 위치                 |
| ------------------------ | ---------------------------------------------------------- | ------------------------- |
| `INVALID_NUMBER`         | (사용자 노출 안 함, dev only)                              | 콘솔                      |
| `INVALID_MULTIPLIER`     | "?"                                                        | UI 표기                   |
| `INVALID_AMOUNT`         | "?"                                                        | UI 표기                   |
| `UNKNOWN_CURRENCY`       | "환율 정보 없음"                                           | inline 배지               |
| `FX_FETCH_FAILED`        | "환율 정보를 가져오지 못했어요"                            | 토스트 / 배지             |
| `FX_PARSE_FAILED`        | 동일                                                       | 동일                      |
| `FX_TIMEOUT`             | "환율 서버 응답이 늦어요"                                  | 배지                      |
| `CITY_PARSE_FAILED`      | "도시 데이터를 읽을 수 없어요"                             | ErrorView                 |
| `CITY_SCHEMA_INVALID`    | 동일                                                       | ErrorView                 |
| `CITY_NOT_FOUND`         | "이 도시 데이터를 찾을 수 없어요"                          | ErrorView + [돌아가기]    |
| `CITY_FETCH_FAILED`      | "데이터를 불러오지 못했어요"                               | inline 배지 + [다시 시도] |
| `CITY_TIMEOUT`           | "응답이 늦어요. 다시 시도해 주세요"                        | 동일                      |
| `ALL_CITIES_UNAVAILABLE` | "데이터를 불러올 수 없어요\n네트워크 연결을 확인해 주세요" | 전체 ErrorView            |
| `FAVORITES_LIMIT`        | "즐겨찾기는 최대 50개까지 추가할 수 있어요"                | 토스트                    |
| `INVARIANT`              | "예기치 못한 문제가 생겼어요\n앱을 다시 실행해 주세요"     | ErrorBoundary fatal       |

규칙:

- 모든 메시지 **존댓말** + **친근한 톤** ("했어요·해 주세요").
- 60자 이내 (한 줄 또는 두 줄).
- 기술 용어 금지 (HTTP/JSON/timeout 같은 단어 X).
- 사용자가 다음에 할 액션 명시 ("다시 시도해 주세요").
- 다국어 대비: `src/i18n/errors.<locale>.ts` 구조로 분리 (v1.0 은 ko 만).

## 공유 기능 (v1.x)

v1.0 미지원 결정 (ADR-037). 향후 도입 시 디자인 준비:

- **위치**: Compare 화면 헤더 우측 (⭐ 옆 또는 more)
- **동작**: 표준 OS share intent (`Share.share()`)
- **공유 콘텐츠**: 텍스트 ("서울 vs 밴쿠버: 한 달 175만 vs 340만 (1.9배). 자세히: <앱 링크>")
- **이미지 공유 (v2)**: Compare 화면 캡쳐 이미지

## 다크 모드 향후 대응 (v1.x prep)

v1.0 라이트 강제 (ADR-016) 이지만 향후 다크 도입 마찰을 줄이기 위해:

- 색 토큰을 시맨틱 alias 로 한 번 더 추상화 가능 (`bg.primary` → 라이트=`white`, 다크=`navy`)
- 현재는 토큰 직접 사용 (`white`, `navy`)
- 다크 도입 시 alias 레이어 추가 + ADR

## i18n 향후 대응 (v3+ prep)

v1.0 한국어 강제 (ADR-016). 향후 마찰 줄이기 위해:

- 사용자 노출 한국어 문구는 가능한 한 `src/i18n/strings.ko.ts` 한 파일에 모음
- 컴포넌트 안 인라인 한국어 허용 (마이크로카피 분산은 비용 큼)
- 다국어 도입 시: `i18n-js` 또는 `react-intl` 등 도입 + ADR
- 에러 메시지는 §에러 메시지 한국어 표준 에 따라 이미 분리 (가장 분리 수익 높은 영역)

### FavCard (홈 가로 즐겨찾기)

- min-width 168, padding 16, radius 20.
- 첫 번째 카드는 `accent: navy` (#11263C bg, white text). 나머지는 white + 1px line.
- 상단: 국가코드 박스(32×24, 11px Manrope 800) + ⭐
- ⭐ 색: **accent 카드는 orange (#FC6011)**, 일반 카드는 gray-2 (#8A98A0) — `home.jsx:13` 검증
- 도시명 16 Manrope 800, 영문 sub 11px opacity 0.7
- 배수 24 Manrope 800 orange + `vs 서울` 11px opacity 0.6
- 헤더 위 별도 섹션: ⭐ 아이콘(14px orange) + "즐겨찾기" h2 16px + 우측 "전체 보기" tiny (v1.0: 시각만, 클릭 시 동작 없음 — v2 검토)

### Detail 카드 그룹화 (`detail.jsx:62, 73`)

- 외식·식재료 섹션 각각 **단일 card 그룹** 으로 묶음 (`borderRadius: 16`, padding `2px 14px`)
- GroceryRow 들이 하나의 카드 안에서 bottom border 로 구분 (마지막 행 제외)
- 섹션 라벨 (`외식` / `식재료`) 은 카드 외부 위에 별도 (mono-label 10px uppercase gray-2)
- 우측 항목 수 ("2 항목" / "8 항목") 도 카드 외부

### 설정 메뉴 정확 매핑 (`settings.jsx:46-50`)

| 행                | 아이콘  | 아이콘 색     | 배경                  | 우측 텍스트             | 비고      |
| ----------------- | ------- | ------------- | --------------------- | ----------------------- | --------- |
| 데이터 새로고침   | refresh | #FC6011       | #FFE9DC (orange-soft) | "2026-04-01" (lastSync) | hot 강조  |
| 데이터 출처 보기  | book    | #11263C       | #F0F5F9               | "12개" (출처 수)        |           |
| 피드백 보내기     | mail    | #11263C       | #F0F5F9               | (없음)                  | mailto    |
| 개인정보 처리방침 | shield  | #11263C       | #F0F5F9               | (없음)                  | 외부 링크 |
| 앱 정보           | info    | #8A98A0 (dim) | #F0F5F9               | "v1.0.0"                | dim 라벨  |

### RegionPill (홈 권역 필터)

- chip padding 8×14, 12px, label + count(opacity 0.6).
- active = navy fill / white text. inactive = white + line border.
- radius 999.

### MenuRow (설정 메뉴 행)

- padding 14, gap 12, 1px bottom border (마지막 행 제외).
- 36×36 아이콘 박스 + 13 Manrope 700 라벨 + 11px tiny 우측 보조 + chevron.
- "데이터 새로고침" 첫 행은 hot=orange. "앱 정보" 마지막은 dim gray-2.

## 인터랙션·동작 규칙

- **Card tap**: ~100ms scale-down (`transform: [{ scale: 0.98 }]` 또는 `translateY(1)`). 단순 토글·버튼은 제외.
- **Chevron 행**: chevron 이 있으면 무조건 탭 가능 → push.
- **숫자 표기**: 한국어 단위 (만 / 천). 만원 단위에서만 소수 1자리 (예: `1.2만`). 천원 단위는 정수.
- **배수 표기**: `↑1.9×` (소수 1자리, × 기호). 1.0× 미만은 `↓0.9×`. 신규 항목은 `'신규'` 문자열.
- **환율**: Compare 화면 상단에 `1 CAD = 980원 · 04-27` 형태로 항상 노출. 24h 이내 갱신.
- **데이터 갱신일**: 비교 화면·설정 화면에 `갱신 2026-04-01` 형태. 설정에서 수동 새로고침 후 토스트로 결과 알림.
- **Hot threshold**: 배수 ≥ 2.0× → hot 처리. 단일 함수 `isHot(mult)` 만 사용 (컴포넌트가 직접 비교 금지).

## 화면 상시 표시 요소 (Cross-cutting indicators)

### 페르소나 태그 (PersonaTag)

비교·상세 화면에서 사용자가 현재 페르소나를 항상 인식하도록 헤더에 작은 태그 노출.

```
┌──────────────────────────────────┐
│ ←   서울 vs 밴쿠버 🇨🇦       [⭐] │
│     🎓 유학생 · 1 CAD = 980원·04-27│  ← 페르소나 + 환율 + 기준일
└──────────────────────────────────┘
```

- 위치: TopBar subtitle 첫 요소
- 형식: `<icon> <페르소나명> · <환율> · <기준일>`
- 페르소나 아이콘: 🎓 유학생 / 💼 취업자 / 🤔 모름
- 색: gray-2 (11px tiny)
- 탭: 페르소나 변경 시트 (Sheet B) 즉시 열림 — 빠른 전환 경로

### 네트워크 상태 인디케이터 (OfflineBadge)

오프라인이거나 데이터 갱신 실패 시 화면 상단(safe area 바로 아래)에 inline 배지 표시.

```
┌──────────────────────────────────┐
│ 🟡 오프라인 모드 · 시드 데이터 사용 │  ← inline 배지 (light bg)
├──────────────────────────────────┤
│ ←   서울 vs 밴쿠버 🇨🇦       [⭐] │
└──────────────────────────────────┘
```

상태 매트릭스:

| 상태              | 배지                | 색                           | 텍스트                                      |
| ----------------- | ------------------- | ---------------------------- | ------------------------------------------- |
| 정상              | 미표시              | —                            | —                                           |
| 데이터 갱신 실패  | inline              | orange-tint bg + orange text | "데이터 갱신 실패 · 다시 시도" + [재시도 →] |
| 오프라인          | inline              | light bg + gray              | "🟡 오프라인 모드 · 시드 데이터 사용"       |
| 환율 stale (>24h) | inline (Compare 만) | light bg + gray-2            | "환율 데이터 오래됨 · 마지막 갱신 04-26"    |

- React Native: `@react-native-community/netinfo` 로 오프라인 감지
- inline 배지는 모든 화면 (Onboarding 제외) 공통

### 데이터 신선도 배지 (FreshnessBadge)

Compare/Detail 푸터에 데이터 신선도 시각 강조.

```
┌──────────────────────────────────┐
│ ──────────────────────────────── │
│ 📊 Q2 2026 데이터 · 출처 12개      │  ← 신선도 + 출처
│ 출처 보기 →                       │
└──────────────────────────────────┘
```

- 분기 표기: `Q1·Q2·Q3·Q4 YYYY` (한국식)
- 1주 이내: 일반 gray
- 1~4주 이내: gray-2
- 4주+: orange (갱신 권유 시그널)

## 빈/에러/로딩 상태 (전반)

- **빈 상태 (Empty)**: 즐겨찾기·최근 본 도시가 0개일 때. 아이콘 96×96 light bg + 한 줄 안내 + 1차 CTA(예: "관심 도시 골라보기").
- **에러 (ErrorView)**: 네트워크 실패 시 시드 데이터로 fallback + 상단 inline 배지(`데이터 갱신 실패 · 다시 시도`). 화면 전체 차단 금지.
- **로딩 (Skeleton)**: 첫 로드 시 카드 모양만 light bg 로 placeholder. 시머·스피너 금지(우리 팔레트 외 색).

### 화면별 상태 매트릭스

| 화면   | 정상                   | 빈                                            | 로딩                  | 에러                                         |
| ------ | ---------------------- | --------------------------------------------- | --------------------- | -------------------------------------------- |
| 온보딩 | 3 카드                 | —                                             | 폰트 로딩 splash      | rare (스토어 hydration 실패 → 초기화 재시도) |
| 홈     | 즐겨찾기 + 최근        | "관심 도시 골라보기" CTA + 권역 그리드        | 카드 skeleton         | inline 배지 (시드 fallback)                  |
| 비교   | hero + 카드들 + 출처   | (해당 없음)                                   | hero+카드 skeleton    | 카드 영역에 ErrorView + 다시 시도            |
| 상세   | hero + 섹션 + 출처     | 해당 카테고리 데이터 결측 시 "데이터 준비 중" | 섹션 skeleton         | ErrorView                                    |
| 설정   | 페르소나 + 통계 + 메뉴 | 통계는 항상 0 가능                            | hydration 동안 splash | rare                                         |

## 시트·모달

- **❓ 가정값 시트** (Compare hero 우측 ❓ 탭): bottom sheet, 라운드 22 top corners, navy text on white. 평균 가정 본문 + 닫기 버튼.
- **페르소나 변경 시트** (설정 "변경" 탭): 3개 옵션 라디오, 선택 즉시 적용 + 자동 닫기 + 토스트.
- **출처 보기**: full-screen modal (Stack.Screen `presentation: 'modal'`). 출처 카드 리스트(이름·URL·접근일).
- 모든 시트는 swipe-to-dismiss + 명시적 닫기 버튼 둘 다 제공.

## 토스트

- 위치: 화면 상단 (status bar 아래) 또는 하단 (탭 바 위) — 일관 정책: **하단** (사용자 손가락 가까움).
- 타입: `success` (orange), `error` (navy + 빨강 텍스트 미사용 — 우리 팔레트 안에서 dim navy), `info` (light bg).
- 기간: 2.5s 자동 dismiss. 탭으로 즉시 dismiss 가능.
- 사용처: 데이터 새로고침 결과, 즐겨찾기 add/remove, 페르소나 변경 결과, 신고 전송 (v1.1).
- 금지: 성공/완료에 stack 쌓이는 토스트 (도배 방지: 같은 메시지 2회 연속 → 1개만 표시).

## 스플래시 / 앱 아이콘

- 스플래시: `assets/splash.png` — 흰 배경 + 글로브 아이콘(56×56) + "해외 생활비 비교" 워드마크. orange/navy 토큰으로만 구성, gradient 금지.
- 앱 아이콘: orange 정사각 1024×1024, 가운데 흰 글로브 또는 KR↔Globe 모티프. iOS round corner 처리는 시스템에 위임.
- 다크 모드 변형: v1.0 미지원 (시스템에서 라이트 강제 — `app.json` userInterfaceStyle: "light").

## 접근성

- **다이나믹 타입**: 시스템 글자 크기 반영 (`allowFontScaling` 기본 true 유지). 다만 hero 카드의 squeeze 방지 위해 `maxFontSizeMultiplier={1.4}` 등 상한 둘 수 있음.
- **VoiceOver / TalkBack**: 모든 카드는 `accessibilityLabel` 으로 도시·항목·배수·차액을 한 문장으로. 예: "밴쿠버 월세, 서울 70만원 대비 180만원으로 약 2.6배."
- **터치 타겟**: 최소 44×44 (iOS HIG). 작아 보이는 chevron 행도 패딩으로 보장.
- **색 대비**: 본문(navy on white) WCAG AA 통과. 배수 색 단독으로 정보 전달 금지(앞서 명시).

## 모션

- 허용: fade-in (200ms), slide-up (250ms ease-out), card press scale (100ms).
- 금지: 이외 모든 자동 재생 애니메이션. 특히 무한 반복 모션, 글로우, 호흡, 회전.

## 아이콘

- 22개 SVG (목록은 `docs/design/README.md` §Assets 참조). 단일 `<Icon name="..." />` 컴포넌트로 통일.
- stroke 1.8~2.2px, viewBox 24×24, 라이브러리(lucide / heroicons) 도입 금지(디자인 1:1 매칭이 우선).

## 변경 시

토큰·타이포·인터랙션 룰 변경은 디자인 의도가 바뀌는 일이다. 다음 절차로:

1. `docs/design/README.md` 와 정합성 확인 (그쪽이 1차 출처)
2. 변경이 의도적이면 `docs/ADR.md` 에 새 ADR 추가 + 본 문서 갱신
3. 영향받는 컴포넌트 테스트 동시 갱신 (snapshot)
