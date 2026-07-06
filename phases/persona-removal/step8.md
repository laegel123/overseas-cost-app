# Step 8: maestro-e2e

Maestro E2E 를 새 온보딩 계약에 맞춘다. 핵심은 공통 서브플로우 `common/onboard.yaml` 의 계약 변경(persona 탭→home → **도시 탭→compare→back→home**)이다. 이게 ~28개 플로우의 공통 전제조건이다. E2E 는 시뮬레이터 수동 실행이라 CI 차단은 없지만, 계약을 안 맞추면 로컬 스위트 전반이 깨진다.

## 읽어야 할 파일

- `docs/plans/persona-removal-city-onboarding.md` "Maestro E2E" 섹션
- `docs/ADR.md` ADR-066(Maestro)
- `.maestro/common/onboard.yaml` (현재 persona 계약)
- `.maestro/flows/01-onboarding/*` (persona-student/worker/unknown/change.yaml, onboarding-once.yaml)
- `.maestro/flows/03-compare/persona-card-diff.yaml`
- `.maestro/flows/06-settings/overview.yaml`, `.maestro/flows/06-settings/data-refresh.yaml`
- `.maestro/smoke.yaml`, `.maestro/README.md`, `.maestro/PLAN.md`, `.maestro/GOTCHAS.md`
- `app/onboarding.tsx`(step 5)·`app/(tabs)/settings.tsx`(step 6) — 새 testID(도시 행, `data-refresh-card`/`data-refresh-btn`, `compare-screen`) 확인.

## 작업

### 1. `common/onboard.yaml` 재작성 (최우선)

- 현재: `launchApp(clearState)` → `assertVisible onboarding-screen` → `tapOn persona-card-${PERSONA}` → `assertVisible home-screen`.
- 신규: `launchApp(clearState)` → `assertVisible onboarding-screen` → `tapOn`(도시 행; 고정 `CITY=tokyo` 또는 첫 도시 앵커) → `assertVisible compare-screen` → 뒤로가기(`compare-back` 등) → `assertVisible home-screen`.
- `PERSONA` env 제거(필요 시 `CITY` env 도입). 이렇게 downstream ~28 플로우의 "home-screen 전제"를 보존한다.

### 2. `flows/01-onboarding` (5개)

- `persona-student.yaml`/`persona-worker.yaml`/`persona-unknown.yaml`/`persona-change.yaml` → **삭제**.
- `onboarding-once.yaml` → 도시 선택 1회 게이트로 재작성.
- 신규 "도시 선택 → compare 진입 + 즐겨찾기 반영" 플로우 추가 권장.

### 3. `flows/03-compare/persona-card-diff.yaml`

- **삭제**. 필요 시 "통합 6 카테고리 표시" 검증 플로우로 대체.

### 4. `flows/06-settings`

- `overview.yaml`: `PERSONA` env 제거 + `persona-card`/`menu-refresh` → `data-refresh-card`/`data-refresh-btn`. onboard 계약 변경 반영.
- `data-refresh.yaml`: `menu-refresh` 3회 탭 → `data-refresh-btn`.

### 5. `smoke.yaml`

- persona 앵커 → 도시 선택 앵커.

### 6. 문서

- `.maestro/README.md`, `PLAN.md`, `GOTCHAS.md` 의 persona 앵커 / `PERSONA` env 설명 갱신.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test   # yaml 은 앱 코드에 영향 없음 → 그린 유지
grep -rn 'persona-card\|menu-refresh\|PERSONA' .maestro   # 남은 건 문서 이력 설명뿐(플로우 앵커 0)
```
(선택) 시뮬레이터 로컬: `maestro test .maestro/smoke.yaml` 로 앵커 통과 확인.

## 검증 절차

1. AC 통과.
2. 체크:
   - `onboard.yaml` 이 `compare-screen` → back → `home-screen` 계약인가?
   - 삭제 대상 yaml(`persona-*.yaml`, `persona-card-diff.yaml`)이 제거됐는가?
   - 06-settings 앵커가 `data-refresh-*` 로 재조준됐는가?
3. `phases/persona-removal/index.json` step 8 → `completed`.

## 금지사항

- `app/`·`src/` 소스 코드를 이 step 에서 수정하지 마라. 이유: E2E 갱신 전용(화면 계약은 step 5/6 에서 이미 확정).
- `onboard.yaml` 이 `home-screen` 이 아닌 곳에서 끝나게 하지 마라. 이유: ~28 downstream 플로우가 home-screen 전제.
- 기존 통과 jest 테스트를 깨뜨리지 마라.
