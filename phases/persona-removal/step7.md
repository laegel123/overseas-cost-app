# Step 7: persona-cleanup

페르소나 관련 파일을 삭제하고 타입·배럴·tailwind 토큰을 정리한다. 이 시점엔 모든 소비자(onboarding/settings/compare/hydration/_layout)가 이미 persona 를 참조하지 않는다(step 1~6). **grep 0 이 게이트.**

## 읽어야 할 파일

- `docs/plans/persona-removal-city-onboarding.md` §F
- `src/components/PersonaCard.tsx`, `src/store/persona.ts`, `src/lib/persona.ts` (삭제 대상)
- `src/store/index.ts`(배럴 persona export), `src/types/city.ts`(6줄 `Persona`), `src/types/index.ts`(re-export)
- `tailwind.config.js` — 62줄 `'persona-icon': '12px'`(→ `rounded-persona-icon`), 67줄 `'1.5': '1.5px'`(→ `border-1.5`)
- `src/theme/tokens.ts` — `navyPersonaCard`(기존 데드, 삭제 금지 대상)

## 작업

### 1. 파일 삭제 (소스 3 + 테스트 3)

- `src/components/PersonaCard.tsx` + `src/components/__tests__/PersonaCard.test.tsx`
- `src/store/persona.ts` + `src/store/__tests__/persona.test.ts`
- `src/lib/persona.ts` + `src/lib/__tests__/persona.test.ts`

### 2. 배럴/타입 정리

- `src/store/index.ts`: `export { usePersonaStore } from './persona'` + `export type { PersonaActions, PersonaState } from './persona'` 제거. docstring store 목록 문구 `persona` → `onboarding`.
- `src/types/city.ts`: 6줄 `export type Persona = 'student' | 'worker' | 'unknown'` 제거.
- `src/types/index.ts`: `Persona` re-export 제거.

### 3. tailwind 토큰 정리 (내 변경이 유발한 데드)

- `rounded-persona-icon`(62줄)·`border-1.5`(67줄)는 PersonaCard 삭제로 새로 데드가 된다. **삭제 전 grep 으로 PersonaCard 단독 사용을 재확인**: `grep -rn "rounded-persona-icon\|border-1.5\|persona-icon" src app` → PersonaCard(이미 삭제됨) 외 사용처가 하나라도 있으면 **남긴다**(정밀 수정 원칙).
- **주의**: `navyPersonaCard`(`src/theme/tokens.ts`)는 **기존 데드**(사용처 0, 내 변경과 무관) → 전역 가이드라인상 요청 없이 삭제 금지. **보고만** 한다.

### 4. 인벤토리

`docs/TESTING.md` §7 에서 persona store / lib / PersonaCard 항목 삭제.

### 5. grep 게이트

```
grep -rn 'usePersonaStore\|PersonaCard\|getCategoriesForPersona\|type Persona\|@/lib/persona\|@/store/persona' src app
```
→ 0건.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
grep -rn 'usePersonaStore\|PersonaCard\|getCategoriesForPersona\|type Persona' src app   # 0건
```

## 검증 절차

1. AC 통과 + grep 0건.
2. 체크:
   - 삭제 대상 6파일(3소스+3테스트)이 모두 제거됐는가?
   - 배럴/`types` 에 `Persona` 잔존 없음.
   - tailwind 토큰은 grep 으로 PersonaCard 단독 확인 후에만 제거했는가?
   - `navyPersonaCard` 는 남겨두고 보고했는가?
3. `phases/persona-removal/index.json` step 7 → `completed`.

## 금지사항

- `persona:v1` AsyncStorage 키를 강제로 지우는 코드를 추가하지 마라. 이유: 잔존 키는 무해, 범위 최소화(계획 §A 의 선택 항목).
- `navyPersonaCard`(theme/tokens.ts)를 삭제하지 마라. 이유: 기존 데드 코드 — 전역 가이드라인상 요청 없이 삭제 금지, 보고만.
- tailwind 토큰을 grep 확인 없이 지우지 마라. 이유: 공유 사용이 하나라도 있으면 회귀.
- 기존 테스트를 깨뜨리지 마라.
