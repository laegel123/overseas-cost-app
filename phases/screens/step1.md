# Step 1: detail

Detail 화면 — 한 카테고리 내 항목 단위 비교. v1.0 1차 타겟은 **food** (외식·식재료 두 섹션). 다른 카테고리 (rent / transport / tuition / tax / visa) 는 동일 골격 + 카테고리별 row 구성.

`app/detail/[cityId]/[category].tsx` placeholder 를 실제 구현으로 교체.

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL (hot 규칙, 데이터 fetch 정책)
- `docs/PRD.md` — Detail 화면 요구사항
- `docs/design/README.md` §4 (Detail) + §UI_GUIDE 카테고리별 상세 화면 사양 (rent/transport/tuition/tax/visa 행 구성)
- `docs/UI_GUIDE.md` §Detail / §GroceryRow
- `docs/ARCHITECTURE.md`
- `docs/TESTING.md` §10 (screens 인벤토리)
- `docs/ADR.md` ADR-042 (사·양파 1kg 통일), ADR-014, ADR-046
- 데이터·스토어:
  - `src/lib/data.ts` — `getCity`
  - `src/lib/currency.ts` — `convertToKRW`
  - `src/lib/format.ts` — `formatKRW`, `formatMultiplier`, `isHot`, `formatShortDate`
- 컴포넌트 산출물:
  - `Screen`, `TopBar`, `Icon`, `HeroCard` (navy variant), `GroceryRow`
  - typography (`H3`, `Body`, `Small`, `Tiny`, `MonoLabel`)
- 직전 step (compare) 산출물 — TopBar / Source footer 패턴 일관 적용
- `data/seed/*.json` — food 카테고리 row 데이터 구조 확인

## 작업

### 1. `app/detail/[cityId]/[category].tsx`

- `useLocalSearchParams<{ cityId: string; category: string }>()`
- `category` 검증: `Category` literal 6 값 (rent/food/transport/tuition/tax/visa) 외엔 `ErrorView` (`알 수 없는 카테고리`)
- 라이프사이클: compare 와 동일하게 `getCity(cityId)` + `getCity('seoul')`
- Layout (Screen 사용):
  - **TopBar**: back / `${categoryLabel} · ${city.ko}` + `1 ${city.currency} = ${rate}원 · ${formatShortDate(lastSync)}` / more (v1.0 stub — onPress no-op)
  - **HeroCard navy**: 카테고리 합계 (예: 식비 175만 vs 340만, ↑1.9×). progress bar + 푸터 (`자취 70% + 외식 30% 가정` 등)
  - **섹션 목록**: 카테고리별 다른 구성
    - `food` — 외식 섹션 (GroceryRow N) + 식재료 섹션 (GroceryRow M). 섹션 라벨 (MonoLabel uppercase) + 우측 항목 수 `${n} 항목` (Tiny). 단일 card 그룹 으로 묶기 (border-radius 16, padding 0, overflow hidden) — UI_GUIDE §섹션 카드 wrapping 정책
    - `rent` — RentRow stub (셰어/원룸/1베드/2베드). v1.0 에선 GroceryRow 재사용 또는 단순 row. **결정: GroceryRow 의 `emoji` 자리에 카테고리 아이콘 박스로 swap 한 inline 변형이 깔끔**. 별도 컴포넌트 추가는 본 step 범위 밖 — 단순 `<View>` row 인라인 구성도 허용 (반복 사용처가 1 곳뿐).
    - `transport` / `tuition` / `tax` — UI_GUIDE.md §카테고리별 상세 화면 사양 따라 row 1~3개. v1.0 에선 데이터가 없을 수 있어 빈 섹션 처리 (`데이터 준비 중` Tiny gray-2)
    - `visa` — 단일 정보 카드. mult `신규` (서울에 없는 항목). 텍스트 위주.
  - **Source footer**: 카테고리별 출처 (예: `Statistics Canada` / `Numbeo 금지`) — DATA_SOURCES.md 참조
- 에러 핸들링: `CityNotFoundError`, `UnknownCurrencyError`, `CityParseError` 모두 ErrorView
- v1.0 미구현:
  - `more` 메뉴 (공유 등) — ADR-037
  - `출처 보기` 외부 링크 — `Linking.openURL` (간단 처리)

### 2. 카테고리 라벨 매핑

```ts
const CATEGORY_LABEL: Record<Category, string> = {
  rent: '월세', food: '식비', transport: '교통', tuition: '학비', tax: '세금', visa: '비자',
};
```

`@/i18n` 또는 `src/lib/category.ts` 신설 결정 (단일 출처).

### 3. 테스트 (`app/detail/__tests__/[category].test.tsx`)

- `food` 카테고리 외식·식재료 mount + 행 갯수
- `rent` / `transport` / `tuition` / `tax` / `visa` 각 1 mount (ErrorView 미발생)
- 알 수 없는 카테고리 → ErrorView
- HeroCard navy variant 적용
- snapshot 2 케이스 (food / visa)

### 4. `docs/TESTING.md` §10 인벤토리 추가

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
```

- 신규 테스트 모두 통과 + 기존 테스트 유지
- snapshot 새로 생성

## 검증 절차

1. AC 통과
2. 체크:
   - `getCity` 경유 데이터 (fetch 직접 호출 X)
   - `isHot(mult)` 단일 함수 사용
   - 매직 색상 X
   - 카테고리 6 값 외 → ErrorView (silent X)
3. `phases/screens/index.json` step 1 update

## 금지사항

- 카테고리 라벨을 컴포넌트 안에 하드코딩 금지 (단일 출처 정책). 이유: i18n / 추후 변경 시 drift 위험.
- food 외 카테고리 데이터 누락 시 throw 금지 (`데이터 준비 중` 빈 섹션). 이유: v1.0 출시 정책 (PRD).
- step 0 의 `(tabs)/_layout.tsx` 변경을 본 step 에서 추가 수정 금지. 이유: 작업 분리.
- 새 컴포넌트 (RentRow 등) 추가 금지. 이유: 반복 사용처 1곳이라 인라인 구성이 적절 (조기 추상화 회피).
