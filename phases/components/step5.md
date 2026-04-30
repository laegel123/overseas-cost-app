# Step 5: compare-pair

ComparePair — 비교 화면의 카테고리별 듀얼 바 카드. 가장 복잡한 컴포넌트:
- `isHot(mult)` 함수 사용 (CLAUDE.md CRITICAL)
- 6 category 아이콘 매핑
- 신규 케이스
- 막대 폭 정규화 (HeroCard 와 다른 변형)
- `hot` prop override

## 읽어야 할 파일

- `CLAUDE.md` — **CRITICAL: hot 규칙 — 배수 ≥ 2.0× 면 hot=true. 단일 함수 `isHot(mult)` 로 일관 판정.**
- `docs/design/README.md` §3 (Compare — 카드 영역)
- `docs/UI_GUIDE.md` §ComparePair
- `docs/TESTING.md` §9.17 (가장 큰 매트릭스 — hot 경계값 + override + icon 매핑 + 막대)
- `src/lib/format.ts` (이미 `isHot` export)
- `src/types/city.ts` (`Category` literal: rent / food / transport / tuition / tax / visa)
- step 0~4 산출물: Text variants, Icon, HeroCard (시각 패턴 참고)

## 작업

### 1. `src/components/ComparePair.tsx`

```ts
import type { Category } from '@/types/city';
import { isHot } from '@/lib';

export type ComparePairProps = {
  category: Category;
  label: string;             // 예: "월세"
  sLabel: string;            // 예: "서울"
  sValue: string;            // 예: "120만"
  cLabel: string;            // 예: "밴쿠버"
  cValue: string;            // 예: "240만"
  mult: number | '신규';     // 1.0 = 동일, > 1 = 도시가 비쌈
  swPct: number;             // 서울 막대 폭 0~1
  cwPct: number;             // 도시 막대 폭 0~1
  hot?: boolean;             // override (미지정 = isHot(mult) 자동 판정)
  onPress?: () => void;
  testID?: string;
};
```

### 2. Hot 판정 (CLAUDE.md CRITICAL)

```ts
const effectiveHot = hot !== undefined
  ? hot
  : (typeof mult === 'number' && isHot(mult));
```

- `mult='신규'` → effectiveHot=false (default), navy 색.
- `mult=2.0` → isHot=true, hot 색상.
- `mult=1.99` → isHot=false.
- `hot=true` 강제 (mult=1.5 라도) → 강제 hot.
- `hot=false` 강제 (mult=3.0 라도) → 강제 not-hot.

### 3. Category icon 매핑 (TESTING.md §9.17)

```ts
const CATEGORY_ICON: Record<Category, IconName> = {
  rent: 'house',
  food: 'fork',
  transport: 'bus',
  tuition: 'graduation',
  tax: 'briefcase',
  visa: 'passport',
};
```

icon 박스 색상:

- `effectiveHot=true`: `bg-orange-soft` + Icon `color={colors.orange}`
- `effectiveHot=false`: `bg-light` + Icon navy

### 4. 시각

- mult 텍스트:
  - `effectiveHot=true` → `text-orange`
  - `'신규'` → `text-navy`
  - `mult=1.0` 일 때 (= 서울과 동일) → `text-gray-2` 또는 navy 약화
  - 그 외 (cool, mult < 1) → `text-gray-2`
- 막대: HeroCard 와 같은 정규화 (`swPct`, `cwPct`). 두께는 ComparePair 카드용 4px.
- sValue / cValue 56px 너비 영역 안에 fit (`numberOfLines={1}` + adjusts).
- 라벨 긴 경우 `numberOfLines={1}` ellipsis.
- 카드: `bg-white`, `border-line`, `rounded-card-lg` (18px), padding 14px.
- 탭 → `onPress(category)`.

### 5. 신규 케이스

`mult='신규'` 일 때:

- mult 표기 → "신규" (한국어 그대로)
- 막대: cyan / light bg 또는 SEO 막대 0% (정책 결정 — design/README 따라). v1.0 은 SEO 막대 1px 또는 미표시 + CITY 막대만 표시.

### 6. 테스트 — `src/components/__tests__/ComparePair.test.tsx`

TESTING.md §9.17 의 매트릭스 그대로 옮김 (~30 case):

- Hot 경계값: 1.99 / 2.0 / 2.01 / 10.0 / 0.5 (5 case)
- Hot prop override: hot=true/false 강제 (2 case)
- Hot 미지정 (자동 판정) (1 case)
- 신규: '신규' 표기 + 색상 + 막대 (2 case)
- 막대 폭: (0.4, 1.0), (0.0, 1.0), (1.0, 0.5) (3 case)
- 6 category 아이콘 매핑 (6 case)
- 라벨 / 값 긴 경우 ellipsis (2 case)
- 탭 → onPress(category) (1 case)
- snapshot per variant (hot/normal/신규) — 단순 스냅샷 (TESTING.md §6 안티패턴 회피, 핵심 텍스트 검증으로 대체 권장)

### 7. TESTING.md §9.17 인벤토리 갱신

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test
```

- 모든 테스트 통과
- `src/components/**` 100/100/100/100 유지
- 변경 파일: 1 신규 컴포넌트 + 1 테스트, `src/components/index.ts`, `docs/TESTING.md`

## 검증 절차

1. AC 명령 실행
2. 체크리스트:
   - **Hot 판정은 `isHot(mult)` 단일 함수만 사용?** (CLAUDE.md CRITICAL)
   - 6 category 모두 매핑?
   - hot prop override 가 자동 판정 우선?
   - '신규' 케이스 색상 + 막대 정책 명시?
   - 색상 + 아이콘 + 텍스트 3중 인코딩 (CLAUDE.md)?
   - tokens 만 사용?
3. `phases/components/index.json` step 5 → completed

## 금지사항

- **`isHot(mult)` 외 다른 hot 판정 로직 작성 금지.** 이유: CLAUDE.md CRITICAL — 단일 함수 일관 판정.
- **mult 색상에 `text-red-*` (외부 팔레트) 사용 금지.** 이유: tokens 외 hex 금지. 우리 팔레트 안 (orange / navy / gray-2).
- **6 category 외 새 카테고리 추가 금지.** 이유: PRD / DATA.md 의 카테고리 카탈로그 fix.
- **막대를 LinearGradient 로 그리지 마라.** 이유: 단순 색상 막대 — 시각 단순성 + 번들 영향 회피.
- **swPct / cwPct 음수 silent 무시 금지.** 이유: HeroCard 와 동일 — clamp + dev warn.
- 기존 테스트 깨뜨리지 마라.
