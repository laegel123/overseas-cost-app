# Step 6: rows

3 row variant — FavCard (즐겨찾기 카드), RecentRow (최근 본 도시 한 줄), GroceryRow (상세 화면 식재료 행). 모두 list 안에서 반복 렌더되는 atom.

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL
- `docs/design/README.md` §2 (Home — 즐겨찾기, 최근), §4 (Detail — 식재료 섹션)
- `docs/UI_GUIDE.md`
- `docs/TESTING.md` §9.18 (FavCard), §9.19 (RecentRow), §9.20 (GroceryRow)
- `src/lib/format.ts` (`isHot`, `formatMultiplier`)
- step 0~5 산출물: Text variants, Icon, ComparePair (hot 색상 패턴)

## 작업

### 1. `src/components/FavCard.tsx`

```ts
export type FavCardProps = {
  cityId: string;
  cityName: string;        // "밴쿠버"
  cityNameEn: string;      // "Vancouver"
  countryCode: string;     // "CA"
  mult: number;            // 도시 vs 서울 배수
  accent?: boolean;        // true = navy bg, white text (메인 즐겨찾기)
  onPress?: (cityId: string) => void;
  testID?: string;
};
```

- accent=true: `bg-navy`, white text.
- accent=false: `bg-white`, `border-line`, navy text.
- mult 텍스트: `formatMultiplier(mult)` ("↑2.3×" / "↓0.8×" / "1.0×").
  - `isHot(mult)` true → `text-orange` (accent=true 면 orange 유지 — 강조)
  - mult < 1 (cool) → gray-2
  - mult === 1.0 → gray-2 (= 서울과 동일)
- cityName: H2 / H3 (size 결정 — design/README.md), 한국어.
- cityNameEn (sub): 11px Tiny, opacity 0.7 (accent=true) 또는 gray-2 (accent=false).
- 국가 코드 박스: 32×24 rounded `rounded-icon-sm` (10px), border / bg `bg-white` 또는 `bg-light`.
  - 코드는 2글자 영문 (`'CA'`, `'US'`), Mulish 600 micro (10px).
  - 매우 긴 도시명 → `numberOfLines={2}` 또는 `numberOfLines={1}` ellipsis (design/README §2 참조).
- ⭐ 아이콘 (즐겨찾기 표식): 우상단 또는 카드 모서리. Icon `star` 16~22px, color orange 또는 white.
- 탭 → onPress(cityId).

### 2. `src/components/RecentRow.tsx`

```ts
export type RecentRowProps = {
  cityId: string;
  cityName: string;
  mult: number;
  isLast?: boolean;
  onPress?: (cityId: string) => void;
  testID?: string;
};
```

- 한 줄 행, padding 14px 좌우 / 12px 상하.
- mult 텍스트: hot orange / cool gray-2 / 1.0 회색.
- chevron `chev-right` 우측, gray-2.
- isLast=true → bottom border 없음, 그 외 `border-line`.
- 탭 → onPress(cityId).

### 3. `src/components/GroceryRow.tsx`

```ts
export type GroceryRowProps = {
  emoji: string;             // "🥚"
  itemName: string;          // "달걀 한 판"
  seoulPrice: string;        // "1.2만"
  cityPrice: string;         // "2.2만"
  mult: number;              // hot 판정용
  isLast?: boolean;
  testID?: string;
};
```

- emoji 박스: 36×36 rounded `rounded-icon-md` (16px). 박스 bg:
  - `isHot(mult)` true → `bg-orange-soft`
  - 그 외 → `bg-light`
- itemName: Body navy, `numberOfLines={1}` ellipsis.
- 가격 범위: `${seoulPrice} → ${cityPrice}` 한 줄. 화살표 `→` 직접 텍스트 (Icon 사용 안 함 — design/README §4).
- mult 색상: hot orange / 그 외 gray.
- isLast=true → bottom border 없음.

### 4. `src/components/index.ts` re-export

```ts
export { FavCard } from './FavCard';
export type { FavCardProps } from './FavCard';
export { RecentRow } from './RecentRow';
export type { RecentRowProps } from './RecentRow';
export { GroceryRow } from './GroceryRow';
export type { GroceryRowProps } from './GroceryRow';
```

### 5. 테스트

#### `FavCard.test.tsx` (~12 case, TESTING.md §9.18)

- accent true / false 색상
- mult hot / cool / 1.0 색상
- sub (영문) 11px opacity
- 국가코드 박스 32×24 (props 검증)
- 매우 긴 도시명 ellipsis 또는 wrap
- 탭 → onPress(cityId)
- ⭐ 아이콘 표시

#### `RecentRow.test.tsx` (~8 case, TESTING.md §9.19)

- mult 색상 분기 (hot/cool/1.0)
- chevron 표시
- isLast → bottom border 없음
- 탭 → onPress(cityId)

#### `GroceryRow.test.tsx` (~10 case, TESTING.md §9.20)

- 정상 / hot bg 분기
- 이모지 렌더 (`🥚`, `🍱` 등)
- 가격 범위 형식 (`"1.2만 → 2.2만"`)
- mult 색상
- bottom border (마지막 행 제외)
- 매우 긴 품목명 ellipsis

대략 30 case 합계.

### 6. TESTING.md §9.18~9.20 인벤토리 갱신

### 7. 본 step 으로 components phase 완료

phase 전체 통합 검증:

- 12 컴포넌트 (Text 8 + Icon + Screen + TopBar + BottomTabBar + MenuRow + RegionPill + HeroCard + ComparePair + FavCard + RecentRow + GroceryRow) 모두 export.
- `src/components/**` 커버리지 100/100/100/100 유지.
- TESTING.md §9.9~9.20 모두 cover.

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test -- --coverage
```

- 모든 테스트 통과
- `src/components/**` 100/100/100/100 유지
- 변경 파일: 3 신규 컴포넌트 + 3 테스트, `src/components/index.ts`, `docs/TESTING.md`
- `phases/components/index.json` step 6 + phase completed
- `phases/index.json` 의 components → completed

## 검증 절차

1. AC 명령 실행
2. 체크리스트:
   - 3 row variant 모두 hot 색상 분기?
   - emoji 가 Icon 으로 wrap 되지 않고 직접 텍스트로 렌더?
   - GroceryRow 의 `→` 가 직접 텍스트?
   - FavCard accent 분기에서 mult 색상 유지?
   - 국가 코드 박스 32×24 정확?
   - tokens 만 사용?
3. step 6 → completed + phase 전체 completed 처리

## 금지사항

- **emoji 를 Icon 으로 wrap 금지.** 이유: design/README.md §Assets — emoji 는 OS 네이티브 텍스트 렌더.
- **국가 코드 박스를 국기 이미지로 swap 금지.** 이유: design/README.md §Assets — v1.0 은 의도적 코드 박스. v1.1 swap.
- **가격 범위 화살표를 Icon (`up` / 등) 으로 사용 금지.** 이유: 직접 텍스트 `→` 가 design/README.md 패턴.
- **isLast 대신 list 컨테이너에서 last-child 처리 금지.** 이유: RN flex list 에 CSS pseudo 없음 — prop 으로 명시.
- **mult 텍스트에 `formatMultiplier` 외 직접 포매팅 금지.** 이유: format.ts 단일 출처.
- 기존 테스트 깨뜨리지 마라.
