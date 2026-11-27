# Step 2: compare-base

## 배경

비교 화면 `app/compare/[cityId].tsx` 는 왼쪽이 항상 서울이다 (`getCity('seoul')`, 라벨 `"서울"` 하드코딩). 이 step 은 왼쪽(기준 도시)을 query param `base` 로 받을 수 있게 한다. step 1 에서 만든 비교 탭 선택 화면이 `/compare/<대상>?base=<기준>` 으로 진입시킨다.

용어:

- **기준 도시 (base)**: 왼쪽. `base` param, 생략 시 `'seoul'`.
- **대상 도시 (city)**: 오른쪽. 기존 `cityId` 경로 param.
- **서울 모드**: `base` 가 없거나 `'seoul'`. **현재 동작과 완전히 같아야 한다.**
- **도시끼리 모드**: `base` 가 서울이 아닌 유효한 도시.

전체 설계: `docs/plans/city-vs-city-compare.md` (반드시 읽을 것 — "화면별 동작 3" 절이 이 step 의 기준).

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL: Hot 규칙(`isHot` 단일 함수), 에러 삼킴 금지, 광고 규칙, 3중 인코딩(화살표+숫자+색), strict TS
- `docs/plans/city-vs-city-compare.md`
- `docs/adr/` 의 이 phase ADR (step 1 산출물 — `ls docs/adr | tail -3` 으로 확인), ADR-060 / 061 / 062 / 067 / 075
- `app/compare/[cityId].tsx` — 전체를 꼼꼼히. 특히 `COMPARE_CATEGORIES` 의 `getValue`, `categoryData` 빌드부, hero 계산부
- `app/compare/__tests__/[cityId].test.tsx` — 기존 케이스와 fixture·mock 방식
- `src/lib/format.ts` — `computeMultiplier`, `formatMultiplier`, `isHot`, `computeBarPcts` 의 0·음수 처리
- `src/store/tuitionChoice.ts`, `src/store/taxChoice.ts`, `src/store/categoryInclusion.ts`, `src/store/rentChoice.ts`
- `src/components/ComparePair.tsx`, `src/components/cards/HeroCard.tsx`, `src/components/TopBar.tsx` (+ 각 테스트)
- `docs/TESTING.md` — Compare 화면 인벤토리 절, fixture 절

## 작업

### 1. `base` 읽기와 오류 처리

- `useLocalSearchParams<{ cityId: string; base?: string }>()`. `base` 없으면 `'seoul'`.
- 기존 ErrorView 패턴으로:
  - `base` 가 도시 목록에 없음 → `"도시 데이터를 찾을 수 없습니다"`
  - `base === cityId` → `"같은 도시끼리는 비교할 수 없어요"`
- `cityId === 'seoul'` 이고 `base` 가 다른 도시 → `router.replace('/compare/<base>')` (서울 모드로 정규화). 이유: 서울은 학비·세금·비자가 0원이라 오른쪽에 두면 `0 ÷ 값` 배수로 `formatMultiplier`·`isHot` 이 throw 한다. 서울은 항상 왼쪽이다.

### 2. 계산 — 가장 틀리기 쉬운 곳

- 내부의 `seoul` 을 기준 도시로 일반화한다 (변수·타입 이름 정리는 필요한 만큼만).
- **학비·세금 선택값을 도시별로 따로 넘긴다.** 지금은 `cfg.getValue(seoul, fx, rentChoice, tuitionChoice, taxChoice)` 에 **대상 도시의** `tuitionChoice`/`taxChoice` 를 그대로 넘긴다 (서울은 데이터가 없어 null 로 떨어져 문제가 없었다). 도시끼리 모드에서는 왼쪽에 `choices[base]`, 오른쪽에 `choices[cityId]` 를 넘겨야 한다. 한쪽 도시의 선택값이 반대쪽 계산에 섞이면 이 phase 는 실패다.
- 월세는 현행 유지: 대상 도시 기준으로 주거 형태 key 를 1회 결정해 양쪽에 같은 key 적용.
- 배수는 항상 `computeMultiplier(기준값, 대상값)`, Hot 은 `isHot` 그대로.
- **결측 표기** — 서울 모드는 현행 유지(서울의 null 은 정책상 0원, `'신규'` 표기 포함 기존 그대로). 도시끼리 모드에서:
  - 양쪽 모두 값 없음 → 현행대로 카드 숨김.
  - 한쪽만 값 없음 → 없는 쪽 값은 `—`, 배수 미표시, 포함 토글이 켜져 있어도 그 카테고리는 hero 합계에서 **양쪽 모두** 제외. 0원으로 표시하지 마라 — 이유: 서울이 아닌 도시의 결측을 0원으로 보이면 "무료"로 오독된다 (CLAUDE.md 에러 삼킴 금지).
  - 이 표시에 필요하면 `ComparePair` 의 `mult` 계열 prop 을 **선택적으로 넓히는 최소 변경**을 허용한다 (예: `mult` 에 `null` 허용 → 배수 영역 미렌더). 기존 호출 형태·스냅샷·서울 모드 렌더는 바뀌면 안 된다. 컴포넌트를 고쳤다면 그 컴포넌트 테스트에 케이스를 추가한다.
  - 현재 실데이터에서는 한쪽만 결측인 경우가 발생하지 않는다 (서울 외 20개 도시 모두 학비·비자 보유, 세금은 전 도시 비어 양쪽 결측). fixture 로 검증한다.
- hero 가운데 배수: 현행 규칙 유지 (기준 합계 0 이면 배수 미표시, 차액만).
- **포함 토글 저장 키**: 서울 모드 = `cityId` (현행). 도시끼리 모드 = `` `${base}|${cityId}` ``. `resolveInclusion` / `setInclusion` 호출부에 넘기는 키만 바꾼다 — `categoryInclusion` store 자체는 수정하지 마라 (문자열 키 map 이라 그대로 된다). 기본값(rent/food/transport ON, tuition/tax/visa OFF)은 그대로.

### 3. 표시

- 제목 `` `${기준 한글명} vs ${대상 한글명}` ``. `HeroCard` 의 `leftLabel`, `ComparePair` 의 `sLabel` 은 기준 도시 한글명.
- 도시끼리 모드에서만:
  - TopBar 의 즐겨찾기 별(`rightIcon` 계열 props)을 넘기지 않는다. 이유: 어느 도시의 별인지 모호하다.
  - `pushRecent` 를 호출하지 않는다. 이유: 홈의 최근 목록은 서울 모드로 열린다.
  - 부제: 두 도시 통화의 환율을 모두 표시. 통화가 같으면 한 번만, KRW 는 생략, 한 줄. 정확한 문자열은 재량.
  - 카드 탭 → `` `/detail/${cityId}/${category}?base=${base}` ``.
  - 하단 출처 개수 = 두 도시 `sources.length` 의 합.
  - 세금 카드 `(근사)` 표기 = 어느 한쪽이라도 `taxChoice.kind === 'custom'` 이면.
- 서울 모드의 제목·부제·별·`pushRecent`·카드 이동 주소(`/detail/<cityId>/<category>`, query 없음)·출처 개수·testID 는 **현재 문자열 그대로**.
- 광고 footer 는 현행 유지.

### 4. 테스트 — `app/compare/__tests__/[cityId].test.tsx`

기존 케이스는 **수정하지 않고** 통과해야 한다. 추가:

- `base` 생략과 `base=seoul` 이 같은 렌더를 낸다.
- 도시끼리: 제목·왼쪽 라벨 / 양쪽 실제 값과 배수 방향(기준 대비 대상) / Hot 판정.
- **선택값 분리**: 두 도시에 서로 다른 `tuitionChoice` 를 넣었을 때 각자의 학교 값이 각 열에 나온다. 한쪽 choice 만 바꿔도 반대쪽 값이 불변.
- 포함 토글: 도시끼리 모드에서 토글하면 `"<base>|<cityId>"` 키로 저장되고 `cityId` 단독 키는 불변.
- 한쪽 결측 fixture: `—` 표시, 배수 미표시, hero 합계 제외.
- 별 미렌더, `pushRecent` 미호출, 카드 탭 주소에 `?base=` 포함.
- 오류: 없는 `base`, `base === cityId`. 정규화: `cityId=seoul&base=tokyo` → `router.replace('/compare/tokyo')`.

두 번째 도시 fixture 가 필요하면 `docs/TESTING.md` fixture 절의 빌더 패턴을 따른다.

### 5. 문서

- `docs/TESTING.md` Compare 화면 인벤토리에 위 케이스 추가 (**누락 = step 미완**).
- `docs/ARCHITECTURE.md` 라우팅 절에 `base` param 한 줄.

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npx jest app/compare src/components
npm test
git diff --stat -- "app/compare/__tests__/[cityId].test.tsx" | cat     # 추가만 있어야 함 (아래로 확인)
git diff -- "app/compare/__tests__/[cityId].test.tsx" | grep -c "^-[^-]"   # 0 (기존 테스트 줄 삭제·수정 없음)
grep -n "'서울'\|\"서울\"" "app/compare/[cityId].tsx"                    # 라벨 하드코딩이 남아 있지 않음 (에러 메시지·주석 제외)
git diff --stat -- src/lib/ src/store/ "app/detail/" "app/(tabs)/" data/ .maestro/   # 비어 있음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트: 서울 모드 무변경(기존 테스트·스냅샷 무수정 통과), `isHot` 단일 함수 사용, 결측을 0원으로 표시하지 않음, 광고 위치 불변, strict TS.
3. `phases/city-pair-compare/index.json` 의 step 2 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "base 처리 방식, 포함 토글 키 형식, 결측 표기를 위해 넓힌 컴포넌트 prop(있다면 정확한 이름·타입), 도시끼리 부제 문자열 형식, 테스트용 두 번째 도시 fixture 위치"`
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "…"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "…"` 후 즉시 중단

## 금지사항

- `src/lib/format.ts` 를 수정하지 마라. 이유: 홈·비교·상세 전부가 쓰는 공용 계산이라 서울 모드 회귀 위험이 크다. 0 분모 조합은 정규화(서울은 항상 왼쪽)와 결측 규칙으로 피한다.
- `src/store/` 를 수정하지 마라. 이유: 포함 토글은 호출부 키만 바꾸면 된다.
- `app/detail/` 을 수정하지 마라. 이유: step 3 범위. (이 step 종료 시점에 `?base=` 가 붙은 상세 주소는 아직 서울 기준으로 렌더된다 — 정상이다.)
- 기존 compare 테스트 케이스와 스냅샷을 고치지 마라. 이유: "서울 모드 무변경"의 증거다. 고쳐야만 통과한다면 구현이 틀린 것이다.
- 비교 화면을 복제한 도시끼리 전용 화면을 만들지 마라. 이유: 설계에서 기각된 안이다.
- 좌우 바꾸기 버튼을 추가하지 마라 (비목표).
- 기존 testID 를 바꾸지 마라.
