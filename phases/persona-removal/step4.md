# Step 4: compare-inclusion

카테고리 inclusion 의 persona 인자를 제거하고 고정 기본값으로 바꾼다. **동시에** Compare 화면의 페르소나 분기를 제거한다. 두 파일은 **한 커밋** — `resolveInclusion` 시그니처가 바뀌면 유일한 호출처인 Compare 도 같이 바뀌어야 typecheck 가 그린이다.

## 읽어야 할 파일

- `docs/plans/persona-removal-city-onboarding.md` §C, §D
- `docs/ADR.md` — ADR-067(step 0), ADR-062
- `src/store/categoryInclusion.ts` — `getDefaultInclusion(category, persona)`(66~87줄), `resolveInclusion(cityId, category, persona, inclusions)`(97~107줄), 36줄 `Persona` import.
- `app/compare/[cityId].tsx` — 44줄 `usePersonaStore` import, 165~175줄 `getCategoriesForPersona`, 193줄 persona selector, 281줄 categories memo, 352~357줄 `resolveInclusion` 호출.
- `src/store/__tests__/categoryInclusion.test.ts`, `app/compare/__tests__/[cityId].test.tsx`

## 작업

### 1. `src/store/categoryInclusion.ts`

- 36줄에서 `Persona` import 제거(`SourceCategory` 는 유지).
- `getDefaultInclusion(category: SourceCategory): boolean` — rent/food/transport → `true`, tuition/tax/visa → `false`. `never` exhaustiveness 가드 유지.
- `resolveInclusion(cityId: string, category: SourceCategory, inclusions: Record<string, CategoryInclusionMap>): boolean` — persona 인자 제거, `getDefaultInclusion(category)` 호출.
- docstring 의 "persona-aware default" → "고정 기본값(통합 뷰, ADR-067)". export 명은 동일 → 배럴(`store/index.ts`)은 무변경.

### 2. `app/compare/[cityId].tsx`

- 44줄 `usePersonaStore` import + `Persona` 타입 import 제거.
- `getCategoriesForPersona`(165~175줄) 삭제 → 모듈 상수:
  ```ts
  const COMPARE_CATEGORIES: CategoryConfig[] =
    [RENT_CONFIG, FOOD_CONFIG, TRANSPORT_CONFIG, TUITION_CONFIG, TAX_CONFIG, VISA_CONFIG];
  ```
- 193줄 persona selector 삭제.
- 281줄 `useMemo(getCategoriesForPersona…)` → `const categories = COMPARE_CATEGORIES;` (정적이라 memo 불필요, rules-of-hooks 위반 아님).
- 352~357줄 `resolveInclusion(cityId ?? '', cfg.category, persona, inclusions)` → persona 인자 제거.

### 3. 테스트

- `categoryInclusion.test.ts`: persona 인자 제거 시그니처로 매트릭스 재작성. `getDefaultInclusion(category)` → rent/food/transport `true`, tuition/tax/visa `false`.
- `compare/__tests__/[cityId].test.tsx`: 페르소나 분기 3케이스 → "항상 6 카테고리" 1케이스. persona 셋업(`setState({persona})`/`setPersona`, ~30곳) 제거. **tuition/tax 카드 가시성 assertion 은 "항상 표시" 로 유지**(카드는 보이고 hero 합산엔 미포함). inclusion 기대값을 tuition/tax **default OFF** 로 수정.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
```

## 검증 절차

1. AC 통과.
2. 체크:
   - `resolveInclusion` / `getDefaultInclusion` 시그니처에서 persona 가 사라졌는가?
   - Compare 가 항상 6 카테고리(rent·food·transport·tuition·tax·visa)를 렌더하는가?
   - tuition/tax 가 default OFF 인가(카드는 표시, hero 합산엔 미포함)?
   - categoryInclusion 과 compare 변경이 **한 커밋**에 들어갔는가?
3. `phases/persona-removal/index.json` step 4 → `completed`.

## 금지사항

- categoryInclusion 과 compare 를 별도 커밋으로 나누지 마라. 이유: 시그니처 상호 의존 → 중간 상태 typecheck 깨짐.
- Compare 에 persona 를 다시 끌어들이지 마라(`Persona` 타입/`usePersonaStore` 참조 0).
- hero 합산 기본 포함 규칙을 바꾸지 마라(rent/food/transport ON, tuition/tax/visa OFF — ADR-067).
- 배럴 `usePersonaStore` export 를 제거하지 마라(settings 가 아직 사용 — step 7).
- 기존 테스트(compare/categoryInclusion 외)를 깨뜨리지 마라.
