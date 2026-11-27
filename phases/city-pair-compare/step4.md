# Step 4: e2e-docs

## 배경

이 phase 는 하단 탭 "비교"를 **도시 두 곳을 골라 직접 맞붙이는 선택 화면**으로 바꿨다.

- step 0: `useComparePairStore` (마지막에 고른 두 도시)
- step 1: `app/(tabs)/compare.tsx` 선택 화면, `_layout` 의 비교 탭 redirect 제거, ADR
- step 2: `app/compare/[cityId].tsx` 가 `?base=<기준 도시>` 지원
- step 3: `app/detail/[cityId]/[category].tsx` 가 `?base=` 지원, 학비·세금 도시별 선택 줄

이 step 은 **Maestro E2E flow 와 남은 문서**를 정리한다. 앱 코드는 고치지 않는다.

전체 설계: `docs/plans/city-vs-city-compare.md` (반드시 읽을 것).

## 읽어야 할 파일

- `CLAUDE.md`
- `docs/plans/city-vs-city-compare.md`
- 이 phase ADR (`ls docs/adr | tail -3`)
- `.maestro/README.md`, `.maestro/GOTCHAS.md`, `.maestro/PLAN.md` — 앵커 규약(testID 우선), 알려진 함정, flow 목록
- `.maestro/common/onboard.yaml`, `.maestro/common/open-vancouver-compare.yaml`
- `.maestro/flows/04-favorites-recent/tabs-empty-alert.yaml`, `tabs-populated-redirect.yaml` — 비교 탭 redirect 를 검증하던 flow (수정 대상)
- `.maestro/flows/03-compare/*.yaml`, `.maestro/flows/05-detail/tuition-sheet.yaml` — 형식의 기준
- `app/(tabs)/compare.tsx`, `app/compare/[cityId].tsx`, `app/detail/[cityId]/[category].tsx` (step 1~3 산출물) — **실제 testID 를 코드에서 확인**하고 쓴다. step summary 의 testID 목록도 참고
- `src/components/BottomTabBar.tsx` — 탭에는 testID 가 없고 `accessibilityLabel` = 라벨만 있다
- `docs/TESTING.md` — 수동 e2e 체크리스트 절(§18)과 Maestro 관련 서술
- `docs/ARCHITECTURE.md`, `docs/UI_GUIDE.md` — step 1~3 이 갱신한 부분 확인

## 작업

### 1. 기존 flow 수정

- `tabs-populated-redirect.yaml`: "비교 탭 → recent[0] 의 Compare 로 redirect" 검증을 "비교 탭 → 선택 화면(`compare-tab-screen`) 표시" 로 바꾼다. 파일 이름이 내용과 어긋나면 이름도 바꾸고 `.maestro/PLAN.md` 의 참조를 함께 고친다.
- `tabs-empty-alert.yaml`: 비교 탭의 "최근 본 도시나 즐겨찾기가 없어요" Alert 검증 부분을 제거하거나 선택 화면 표시 검증으로 바꾼다. 즐겨찾기 탭 등 다른 탭 검증은 유지.
- 주의: 선택 화면에는 "비교"·"비교하기" 텍스트가 있다. 탭을 `tapOn: '비교'` 로 누르는 기존 방식이 선택 화면 위에서 다른 요소와 중복 매칭되지 않는지 확인하고, 모호하면 `.maestro/GOTCHAS.md` 의 기존 해법을 따른다. 탭 바에 testID 를 새로 달아야만 해결된다면 고치지 말고 `blocked` 가 아니라 summary 에 한계로 보고하고, 화면 전환 순서를 조정해 우회한다 (예: 홈에서만 비교 탭을 누른다).

### 2. 신규 flow

`.maestro/flows/03-compare/city-pair.yaml` — 도시끼리 비교 기본 경로:

1. 온보딩 → 홈 → 비교 탭 → `compare-tab-screen`
2. 처음엔 `compare-tab-submit` 이 비활성 (두 칸이 빈 상태)
3. 왼쪽 칸(`compare-tab-slot-base`) → 밴쿠버 선택, 오른쪽 칸(`compare-tab-slot-city`) → 토론토 선택
4. `compare-tab-submit` → `compare-screen`, 제목 `밴쿠버 vs 토론토`
5. 월세·식비·교통 카드가 보이고, 학비 카드(`compare-pair-tuition`)가 보인다
6. 뒤로 → 선택 화면에 두 도시가 그대로 남아 있다

`.maestro/flows/05-detail/city-pair-tuition.yaml` — 도시별 학교 선택:

1. 위 경로로 `밴쿠버 vs 토론토` 비교 화면 진입 → `compare-pair-tuition` 탭
2. 선택 줄 2개(`detail-picker-city-vancouver`, `detail-picker-city-toronto`) 표시
3. `detail-picker-city-vancouver` 탭 → 시트에 밴쿠버 학교(UBC / SFU / BCIT) preset 표시 → SFU 선택
4. 시트가 닫히고 밴쿠버 줄에 SFU 반영, 토론토 줄은 그대로

`.maestro/flows/03-compare/city-pair-seoul-normalize.yaml` — 서울은 항상 왼쪽:

1. 왼쪽 칸 = 도쿄, 오른쪽 칸 = 서울 → `compare-tab-submit`
2. 제목이 `서울 vs 도쿄` (서울 모드로 열림)

공통 경로(탭에서 두 도시 고르기)가 2회 이상 반복되면 `.maestro/common/` 에 sub-flow 로 뽑는다 (`open-vancouver-compare.yaml` 형식).

### 3. 실행

시뮬레이터에 dev build 가 설치돼 실행 가능하면 수정·신규 flow 를 실제로 돌린다:

```bash
maestro test .maestro/flows/04-favorites-recent .maestro/flows/03-compare .maestro/flows/05-detail
```

- 통과 못 한 flow 는 원인을 구분한다: flow 문제면 flow 를 고친다. **앱 결함이면 앱 코드를 고치지 말고** summary 에 "flow 이름 / 실패 지점 / 추정 원인"을 적는다.
- 시뮬레이터·빌드를 쓸 수 없는 환경이면 **실행하지 못했다고 summary 에 명시**한다. 실행하지 않은 flow 를 통과했다고 쓰지 마라. 이 경우에도 step 은 `completed` 로 둘 수 있다 (flow 작성·문서가 이 step 의 산출물이고, 실기 검증은 사용자가 `/verify-e2e` 로 이어서 한다).
- 알려진 환경 함정: Xcode 27 에서 `npx expo run:ios` 가 실패할 수 있다 (xcodebuild 직접 빌드로 우회). 빌드를 새로 만드는 데 시간을 쓰지 말고, 설치된 빌드가 없으면 미실행으로 보고하라.

### 4. 문서 마무리

- `.maestro/PLAN.md`: flow 목록에 신규 3개 추가, 수정한 2개의 설명 갱신.
- `docs/TESTING.md`: 수동 e2e 체크리스트에 도시끼리 비교 항목 추가 (두 도시 선택 → 비교 → 상세 → 도시별 학교 변경, 서울 오른쪽 → 서울 모드, 서울 모드 화면 회귀 없음). Maestro flow 인벤토리가 있으면 거기도 추가.
- `docs/ARCHITECTURE.md` / `docs/UI_GUIDE.md`: step 1~3 이 남긴 서술이 서로 모순되지 않는지 통독하고, 비교 탭·`base` param·도시별 선택 줄 서술이 빠진 곳만 보충한다.
- `CLAUDE.md`:
  - 첫 문단의 "서울 vs 해외 도시의 생활비를 항목별로 1:1 비교" 뒤에 도시끼리 비교도 가능하다는 한 구절 추가.
  - "아키텍처 규칙"에 한 줄 추가: 비교·상세 화면의 기준 도시는 `?base=` query param (생략 = 서울), 서울은 항상 왼쪽, 비교 탭 선택 화면에는 광고 금지 (ADR 번호 표기).
  - 광고 규칙 문장("광고는 홈·비교·상세 ready 상태의 Screen footer 에만")의 "비교"가 `app/compare/[cityId].tsx` 를 뜻함이 드러나게 최소한으로 보완한다.
- `docs/plans/city-vs-city-compare.md` 상단 상태 줄을 "구현 완료 (phase `city-pair-compare`)" 로 바꾼다.

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test
ls .maestro/flows/03-compare/city-pair.yaml .maestro/flows/05-detail/city-pair-tuition.yaml .maestro/flows/03-compare/city-pair-seoul-normalize.yaml
grep -rn "redirect" .maestro/flows/04-favorites-recent/ | grep -i "비교"     # 결과 없음 (비교 탭 redirect 서술 제거)
grep -rn "compare-tab-screen" .maestro/flows | head -3                      # ≥ 1
grep -n "base=" CLAUDE.md                                                    # ≥ 1
git diff --stat -- app/ src/ data/ scripts/                                  # 비어 있음 (이 step 은 앱 코드 무수정)
# 시뮬레이터 사용 가능 시:
maestro test .maestro/flows/04-favorites-recent .maestro/flows/03-compare .maestro/flows/05-detail
```

## 검증 절차

1. 위 AC 커맨드를 실행한다 (마지막 줄은 환경이 될 때만).
2. 체크리스트: flow 의 testID 가 코드의 실제 testID 와 일치, 문서 간 모순 없음, CLAUDE.md 규칙이 구현과 일치.
3. `phases/city-pair-compare/index.json` 의 step 4 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "수정·신규 flow 목록, Maestro 실행 여부와 결과(통과 N / 실패 N / 미실행 사유), 발견한 앱 결함(있다면), 갱신한 문서 목록"`
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "…"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "…"` 후 즉시 중단

## 금지사항

- `app/`, `src/`, `data/`, `scripts/` 를 수정하지 마라. 이유: 이 step 은 E2E 와 문서만 다룬다. 앱 결함은 보고만 한다 — 여기서 고치면 step 2·3 의 검증(기존 테스트 무수정 통과)을 우회하게 된다.
- flow 를 통과시키려고 검증을 약하게 만들지 마라 (assert 삭제, `optional: true` 남발). 이유: 통과가 아니라 결함 은폐다.
- 실행하지 않은 E2E 를 통과로 보고하지 마라.
- `.maestro/flows/07-visual-a11y/screenshots.yaml` 을 건드리지 마라. 이유: 사용자의 미커밋 작업이 들어 있다.
- `docs/PRD.md` 를 수정하지 마라.
- 기존 테스트를 깨뜨리지 마라.
