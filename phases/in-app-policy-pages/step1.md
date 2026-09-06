# Step 1: category-meta

## 배경

이 phase(`in-app-policy-pages`)는 데이터 출처·개인정보 처리방침을 외부 브라우저 링크에서 **앱 내부 화면**으로 옮긴다. 새로 만들 화면은 `app/sources/index.tsx` (도시 목록) 와 `app/sources/[cityId].tsx` (도시별 출처를 카테고리로 그룹핑) 다.

출처 화면은 카테고리마다 **한국어 라벨**(`월세`)과 **아이콘**(`house`)이 둘 다 필요하다. 그런데 지금 이 두 값은 서로 다른 세 파일에 흩어져 있다:

| 값 | 현재 위치 | 형태 |
| --- | --- | --- |
| 라벨 | `app/detail/[cityId]/[category].tsx` 58줄 부근 | `const CATEGORY_LABEL: Record<SourceCategory, string>` |
| 라벨 | `app/compare/[cityId].tsx` 70~155줄 | `CategoryConfig` 6개(`RENT_CONFIG` … `VISA_CONFIG`)의 `label` 필드 |
| 아이콘 | `src/components/ComparePair.tsx` 65줄 부근 | `const CATEGORY_ICON: Record<SourceCategory, IconName>` |

**두 라벨 정의의 값은 현재 완전히 동일하다** (조사 완료):

| category | 라벨 | 아이콘 |
| --- | --- | --- |
| `rent` | `월세` | `house` |
| `food` | `식비` | `fork` |
| `transport` | `교통` | `bus` |
| `tuition` | `학비` | `graduation` |
| `tax` | `세금` | `briefcase` |
| `visa` | `비자/정착` | `passport` |

이 step 은 이 값들을 `src/lib/categoryMeta.ts` 한 곳으로 모으고 기존 세 파일이 그것을 참조하도록 바꾼다. **화면 출력은 한 글자도 바뀌지 않아야 한다** — 순수한 단일 출처화다.

`SourceCategory` 타입은 `src/types/city.ts` 에 이미 있다: `'rent' | 'food' | 'transport' | 'tuition' | 'tax' | 'visa'`. `IconName` 은 `src/components/Icon.tsx` 의 `ICON_NAMES` 에서 파생된다.

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래 목록을 반드시 직접 Read 할 것:

- `docs/ARCHITECTURE.md` — §디렉터리 구조, §명명·import 규약
- `docs/ADR.md` (인덱스) — `docs/adr/071-in-app-policy-pages.md` (step 0 이 만든 이 phase 의 결정), `docs/adr/067-persona-removal.md` (통합 6카테고리 뷰)
- `docs/UI_GUIDE.md` — 카테고리 라벨이 등장하는 절 (§Compare, §Detail)
- `docs/TESTING.md` — §9.17 (`ComparePair`), §9.24 (`compare/[cityId].tsx`), §9.25 (`detail/…/[category].tsx`) 인벤토리와 §7 fixture 규약
- `src/types/city.ts` — `SourceCategory`
- `src/components/Icon.tsx` — `ICON_NAMES`, `IconName`
- `src/lib/index.ts` — 배럴 export 규약 (새 모듈을 여기에 노출하는 방식)
- `app/detail/[cityId]/[category].tsx` — `CATEGORY_LABEL` 정의부와 사용처
- `app/compare/[cityId].tsx` — `CategoryConfig` 타입과 6개 config, `CATEGORY_CONFIGS` 배열(165줄 부근), `label` 사용처
- `src/components/ComparePair.tsx` — `CATEGORY_ICON` 정의부와 사용처
- `src/components/__tests__/ComparePair.test.tsx`, `app/compare/__tests__/[cityId].test.tsx`, `app/detail/__tests__/[category].test.tsx` — 기존 단언(라벨 문자열이 하드코딩돼 있을 수 있음)

## 작업

### 1. `src/lib/categoryMeta.ts` 신규

```ts
import type { IconName } from '@/components/Icon';
import type { SourceCategory } from '@/types/city';

/** 카테고리 한국어 라벨 — 화면 표기 단일 출처. */
export const CATEGORY_LABEL: Record<SourceCategory, string>;

/** 카테고리 아이콘 — Icon 컴포넌트 이름 단일 출처. */
export const CATEGORY_ICON: Record<SourceCategory, IconName>;

/**
 * 화면 표시 순서 — Compare 카드 순서와 동일.
 * rent → food → transport → tuition → tax → visa
 */
export const CATEGORY_ORDER: readonly SourceCategory[];
```

규칙:

- 값은 위 배경의 표와 **정확히 일치**해야 한다. 라벨을 다듬거나 아이콘을 바꾸지 마라 — 이 step 은 값 변경이 아니라 위치 이동이다.
- `CATEGORY_ORDER` 는 이 step 에서 새로 도입하는 값이다. `app/compare/[cityId].tsx` 의 `CATEGORY_CONFIGS` 배열 순서(165~170줄)와 같아야 한다. step 4 의 출처 화면이 카테고리 그룹을 이 순서로 정렬하는 데 쓴다.
- `src/lib/index.ts` 배럴에 세 개를 export 한다.

**import 방향 주의**: `src/lib/` 가 `src/components/Icon.tsx` 의 타입을 import 하는 것은 `IconName` 이 **타입 전용**이므로 허용된다 (`import type`). 런타임 값을 lib → components 로 import 하지 마라. ESLint import 순서 규칙(RN/Expo → 외부 → `src/` alias → 상대 경로)을 지킬 것.

### 2. `app/detail/[cityId]/[category].tsx` — 지역 상수 제거

파일 내 `const CATEGORY_LABEL: Record<SourceCategory, string> = {...}` 정의를 삭제하고 `@/lib` (또는 `@/lib/categoryMeta`) 에서 import 한다. 사용처(`const categoryLabel = CATEGORY_LABEL[cat];` 489줄 부근)는 그대로 둔다.

### 3. `app/compare/[cityId].tsx` — CategoryConfig 의 label 단일 출처화

6개 config 의 `label: '월세'` 같은 리터럴이 `categoryMeta` 를 향하게 한다. 두 가지 방법 중 하나를 택하되 **값의 단일 출처가 `categoryMeta.ts` 가 되어야 한다**:

- (권장) `CategoryConfig` 타입에서 `label` 필드를 제거하고, 사용처에서 `CATEGORY_LABEL[config.category]` 로 조회. 리터럴 6개가 완전히 사라진다.
- (대안) `label: CATEGORY_LABEL.rent` 처럼 참조로 교체. 변경 범위는 작지만 매핑이 두 곳에 남는다.

어느 쪽을 택하든 **화면에 렌더되는 문자열은 불변**이어야 한다.

### 4. `src/components/ComparePair.tsx` — 아이콘 맵 제거

파일 내 `const CATEGORY_ICON: Record<SourceCategory, IconName> = {...}` 정의를 삭제하고 `@/lib` 에서 import 한다. 사용처는 그대로.

### 5. 테스트

- `src/lib/__tests__/categoryMeta.test.ts` 신규:
  - `CATEGORY_LABEL` / `CATEGORY_ICON` 이 6개 카테고리를 **빠짐없이** 갖는다 (`SourceCategory` 전수)
  - 각 값이 위 표와 일치 (라벨 6건, 아이콘 6건)
  - `CATEGORY_ICON` 의 모든 값이 `ICON_NAMES` 에 존재하는 유효한 아이콘 이름이다
  - `CATEGORY_ORDER` 가 6개 카테고리를 중복 없이 전부 담는다
- 기존 테스트는 **수정 없이 통과해야 한다**. 만약 기존 테스트가 깨지면 그것은 값이 바뀌었다는 뜻이므로 되돌려라.
- 스냅샷 7개가 그대로 통과해야 한다. 스냅샷이 바뀌면 렌더 결과가 달라진 것이므로 `-u` 로 갱신하지 말고 원인을 고쳐라.
- `docs/TESTING.md` §9 인벤토리에 `src/lib/categoryMeta.ts` 절을 신규 추가한다 (번호는 기존 최대값 다음 — 현재 §9.35 까지 있으므로 §9.36). §9.17·§9.24·§9.25 의 관련 서술도 "라벨/아이콘 정의 위치가 `categoryMeta.ts` 로 이동" 을 반영해 갱신한다. **인벤토리 누락 = step 미완** (CLAUDE.md).

**커버리지 요구 (중요):** `jest.config.js` 의 `coverageThreshold` 는 `src/lib/**` 에 대해 **statements 100 / branches 95 / lines 100 / functions 100** 을 강제한다. 이 step 이 `src/lib/` 에 추가하는 코드는 모든 분기가 테스트로 덮여야 한다. 확인:

```bash
npm run test:coverage
```

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test
```

추가 검증:

```bash
# 라벨/아이콘 리터럴이 categoryMeta.ts 밖에 남아 있지 않은지
grep -rn "'월세'\|'비자/정착'" app src --include="*.tsx" --include="*.ts" | grep -v __tests__ | grep -v categoryMeta.ts
# → 출력이 없어야 한다 (테스트 파일의 기대값 문자열은 예외)

# 스냅샷 무변경
git diff --name-only | grep '__snapshots__' && exit 1 || true
```

## 검증 절차

1. 위 AC 커맨드를 실행한다. 스냅샷 7개 포함 전체 통과여야 한다.
2. 아키텍처 체크리스트:
   - `src/lib/` 는 도메인 로직 위치다 — 디렉터리 규약을 지켰는가? (ARCHITECTURE.md §디렉터리 구조)
   - `IconName` 을 `import type` 으로만 가져왔는가? (lib → components 런타임 의존 금지)
   - import 순서 ESLint 규칙을 지켰는가?
   - 화면 출력이 한 글자도 바뀌지 않았는가?
3. 결과에 따라 `phases/in-app-policy-pages/index.json` 의 step 1 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 라벨 문구나 아이콘 선택을 "개선" 하지 마라. 이유: 이 step 은 값 이동이며, 문구 변경은 스냅샷·E2E·디자인 문서와 동시에 다뤄야 할 별개 결정이다.
- 스냅샷을 `-u` 로 갱신하지 마라. 이유: 스냅샷이 바뀐다는 것은 렌더 결과가 달라졌다는 뜻이고, 이 step 에서는 그런 일이 없어야 한다.
- `CategoryConfig` 의 `getValue` 로직이나 Compare 계산을 건드리지 마라. 이유: 이 step 의 범위는 라벨·아이콘 정의 위치뿐이다 (CLAUDE.md §3 정밀 수정).
- 새 화면(`app/sources/*`)을 만들지 마라. 이유: step 3·4 의 범위다.
- `src/lib/dataSources.ts` 를 건드리지 마라. 이유: step 7 의 범위다 (`settings.tsx` 가 아직 쓰고 있어 지금 지우면 빌드가 깨진다).
- 기존 테스트를 깨뜨리지 마라.
