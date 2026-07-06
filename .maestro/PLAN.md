# E2E 검증 계획 (Maestro) — 배치별 런북

이 문서는 **다른 세션에서 하나씩 검증**하기 위한 운영 가이드다. 플로우 저작은 완료됐고,
여기서는 "어떤 순서로 · 무엇을 전제로 · 무엇을 관찰하고 · 무엇을 조심할지"를 배치 단위로 정리한다.

- 정식 인벤토리(체크리스트): `docs/TESTING.md §18-A`
- 러너/빌드 전제: `.maestro/README.md`
- 도입 근거: `docs/ADR.md ADR-066`

---

## 0. 검증 전 1회 준비

```bash
# dev build 설치 (최초 1회, ios/ 생성 — 수 분)
npx expo run:ios --device "iPhone 17 Pro"
# Metro 유지 (debug 빌드는 JS 를 Metro 에서 로드) — 별도 터미널
npm run dev
```

> 이미 이 세션에서 dev build 설치 + Metro 기동은 완료된 상태다. 새 세션이라면 위 2단계를 먼저.

## 실행 방법 (배치 단위)

```bash
npm run e2e:smoke                         # 스모크만 (파이프라인 확인)
maestro test .maestro/flows/01-onboarding # 배치 하나
maestro test .maestro/flows/03-compare/unified-categories.yaml  # 단일 flow
maestro test --include-tags compare       # 태그로 선택
npm run e2e                               # 전체 (smoke + flows/**)
```

권장: **스모크 → 01 → 02 → … → 07 순서**로 하나씩. 앞 배치(온보딩·홈)가 통과해야 뒤 배치의
전제(홈 진입·검색)가 성립한다.

---

## 1. 배치별 검증 포인트 · 리스크

### 00 smoke — ✅ 이미 통과
파이프라인(Maestro↔dev build↔Metro) sanity. 실패 시 이후 전부 무의미하니 항상 먼저.

### 01-onboarding
- **관찰(ADR-067):** 온보딩은 **도시 선택**이다. `city-select` — 도시 탭 → 서울 vs 그 도시 Compare 직행 + 즐겨찾기 반영. `onboarding-once` — 1회 통과 후 재실행 시 온보딩 skip(`onboarding:v1` 영속).
- **리스크:** 도시 선택 온보딩은 **즐겨찾기를 반드시 1건 남긴다** → '빈 상태' 전제 플로우(empty-states / tabs-empty-alert / favorite-toggle 말미)와 근본적으로 양립 불가. onboard.yaml 공통 전제는 밴쿠버(시드 보장)로 고정 — 별도 로컬 검증 세션에서 빈-상태 플로우 재작성 필요(아래 §3).

### 02-home
- **관찰:** 한글/영문 검색, 빈 결과, 검색어 clear, 권역 필터, 빈 상태 문구.
- **리스크:** 검색·필터는 밴쿠버(시드 보장)로만 단정. 다른 도시는 네트워크 의존이라 assert 대상에서 제외함.

### 03-compare
- **관찰(ADR-067):** hero, **통합 6 카테고리**(페르소나 분기 없음 — `unified-categories`: 학비·비자 항상 노출, tax 는 데이터 부재로 숨김), 배수 3중 인코딩, 뒤로가기.
- **리스크:** `multiplier-encoding` 은 정규식 `↑\d.*×` — 밴쿠버 총비용>서울이라 방향(↑)은 고정이나, **환율 로드 완료 후**라야 hero 에 배수가 렌더된다(로딩 넘어갈 시간 필요, Maestro 기본 대기로 흡수).

### 04-favorites-recent
- **관찰:** ⭐ 토글 → 홈 카드, 최근 누적, 탭 redirect(빈=Alert / 채워짐=Compare).
- **리스크:** `tabs-empty-alert` 의 확인 버튼은 시뮬레이터 로케일에 따라 `확인`/`OK` — 정규식 `확인|OK` 로 대응. 탭 탭은 라벨 텍스트('비교'/'즐겨찾기')로 탭.

### 05-detail
- **관찰:** 식비 상세, 월세 인라인 선택(hero 반영), 학비 시트(preset+직접입력), 세금 no-data, 출처.
- **리스크(중요):**
  - `tax-nodata` 는 **deep link**(`overseascost://detail/vancouver/tax`)에 의존한다. tax 카드가 어디에도 안 떠(데이터 전무) UI 로는 도달 불가하기 때문. dev client 에서 openLink 라우팅이 앱 내부로 이어지지 않으면(런처 가로채기) 이 flow 는 **'데이터 추가 전 검증 보류'**로 처리하고 TESTING §18-A 에 사유 기록.
  - 섹션 testID 에 한글 라벨 사용(`detail-section-외식` 등). 대부분의 iOS accessibilityIdentifier 는 유니코드를 허용하나, 혹시 매칭 실패 시 텍스트 assert(예: '외식')로 대체 가능.
  - 학교 preset testID 는 `detail-tuition-sheet-preset-UBC/SFU/BCIT`(data/all.json 밴쿠버 기준). 데이터 갱신으로 학교명이 바뀌면 이 리터럴도 갱신 필요.

### 06-settings
- **관찰:** 화면 구성, 데이터 새로고침, 외부 링크 이탈/복귀.
- **리스크:** `data-refresh` 는 네트워크 의존 — 성공값 대신 '갱신 실패' 미노출로 검증. `external-links` 는 **실제 브라우저 페이지·메일 컴포저는 자동 검증 밖**(수동 관찰). 핸들러 동작 + 앱 복귀만 자동.

### 07-visual-a11y
- **관찰:** 7개 화면 스크린샷(온보딩/홈/Compare/상세×2/시트/설정). Hot tint·색·레이아웃·그림자 등 **색/픽셀은 사람이 눈으로 리뷰**.
- **산출물:** 실행 디렉터리에 `01-onboarding.png` … `07-settings.png`. 리뷰 후 UI_GUIDE 대비 시각 회귀 판단.

---

## 2. 수동 관찰 항목 (Maestro 자동 밖)

아래는 flow 로 커버 불가 → 검증 세션에서 시뮬레이터/실기로 눈 확인:

- 배수/hot 카드의 **orange/navy 색** 구분 (인코딩의 '색' 축; 화살표+숫자 축은 자동 검증됨)
- 카드 press micro-interaction(scale), 가로 스크롤 감속, 시트 swipe-to-dismiss 자연스러움
- 스플래시(네이티브, 콜드 스타트 시 짧게 — 타이밍상 자동 캡처 어려움)
- 외부 링크 목적지(개인정보 HTML / GitHub 출처 / mailto 컴포저) 실제 오픈
- 오프라인/비행기 모드 fallback(시드 데이터 동작) — Maestro 네트워크 토글 미지원 → `docs/TESTING.md §18.2` 수동 항목과 연계

---

## 3. 문서-구현 격차 (E2E 저작 중 발견)

flow 는 **실제 구현 기준**으로 작성했다. 아래는 PRD/UI_GUIDE 스펙에는 있으나 현재 빌드에
**미구현이거나 다른** 항목 — 스펙 갱신 또는 구현으로 후속 정합 필요(별도 작업, 본 E2E 범위 밖):

> **ADR-067(페르소나 제거):** 페르소나 개념 자체가 삭제됐다. 온보딩=도시 선택, Compare=통합
> 6 카테고리, 설정=데이터 최신화 카드. 아래 페르소나 관련 행은 "폐기"로 갱신. 다만 도시 선택
> 온보딩은 즐겨찾기를 1건 남겨 **빈-상태 전제 플로우(empty-states / tabs-empty-alert /
> favorite-toggle 말미)와 양립 불가** → 별도 로컬 검증 세션에서 재작성 필요(신규 격차).

| 스펙(PRD/UI_GUIDE) | 현재 구현 | E2E 처리 |
| --- | --- | --- |
| 토스트(즐겨찾기/새로고침) | 토스트 컴포넌트 없음. 탭 redirect 안내만 네이티브 Alert | 상태 변화로 검증, 토스트 assert 안 함 |
| 페르소나 개념 전반(ADR-067로 폐기) | 온보딩=도시 선택 · Compare=통합 6 카테고리 · 설정=데이터 최신화 카드 | 도시 선택/통합 카테고리로 검증 |
| hero ❓ '가정' 시트(Sheet A) | Compare hero 에 ❓ 없음(footer '평균 가정 기준'만) | 미검증(구현 없음) |
| '출처 보기' 모달(Sheet C) | Compare 는 비활성('준비 중'), 상세는 인라인 텍스트 | 상세 인라인 출처만 검증 |
| 의료 카테고리 | 코드에 의료 카테고리 없음 | 미검증 |
| 세금/실수령 해피패스 | tax 데이터 전무(21개 도시 모두) → 카드 숨김 | no-data 경로만(deep link) |
| 오프라인/신선도 배지 | 화면에 배지 미구현 | 미검증 |
| 빈 상태/검색 문구 리터럴 | 문서와 다른 실제 문구 사용 | 구현 문구로 assert |
| 빈-상태 전제 플로우(신규) | 도시 선택 온보딩이 즐겨찾기 1건 강제 → 빈 상태 도달 불가 | 로컬 검증 세션에서 재작성 |

> 이 표는 "테스트가 약하다"가 아니라 **"구현이 스펙보다 단순하다"**는 사실의 기록이다.
> 정합 방향(스펙을 구현에 맞춰 내릴지, 구현을 스펙까지 올릴지)은 제품 결정 사항.
