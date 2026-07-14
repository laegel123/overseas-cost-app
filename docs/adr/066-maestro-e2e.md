[← ADR 인덱스](../ADR.md)

# ADR-066: Maestro 기반 E2E(시뮬레이터 UI) 테스트 도입

> **상태**: Active

**컨텍스트:**

현재 테스트는 Jest + RNTL 로 unit → component → integration 까지 커버한다(TESTING.md §1 다층 검증). 그러나 실제 시뮬레이터에서 화면 전환·네비게이션·바텀시트·영속 스토어·expo-router 라우팅을 end-to-end 로 구동하는 층은 "수동 e2e 체크리스트"(§18) 로만 존재해 **회귀 방지 자동화 공백**이 있다. expo-router 라우팅 단축(ADR-041), 페르소나 분기, 단일 선택 시트(ADR-060/061), inclusion 토글(ADR-062) 은 컴포넌트 단위 테스트가 잡지 못하는 화면 통합 동작이라 실기 구동 검증이 필요하다.

**결정:**

1. **Maestro 를 E2E 러너로 도입.** dev client(`expo run:ios`) 빌드를 시뮬레이터에 설치하고 번들 ID(`com.laegel.overseascostapp`) 로 launch, 선언형 플로우 YAML 로 구동.
   - 근거: managed workflow 와 정합(네이티브 코드 미수정 — `ios/` 는 CNG 산출물이라 gitignore), YAML 선언형이라 유지보수 낮음, testID(iOS accessibilityIdentifier) 앵커가 기존 컴포넌트 testID 규약과 그대로 맞물림.
2. **플로우는 `.maestro/` 에 배치.** `config.yaml` + `flows/<batch>/` (유스케이스 배치 01~07) + `common/` (runFlow 재사용 서브플로우). `package.json` 에 `e2e` / `e2e:smoke` 스크립트.
3. **앵커·리터럴 단일 출처 = 실제 구현 코드**(테스트 대상 자신). PRD/UI_GUIDE 스펙과 구현이 갈리는 항목은 **구현 기준으로 검증**하고, 격차는 `.maestro/PLAN.md` "문서-구현 격차" 로 추적한다.
4. **E2E 는 로컬/수동 실행.** CI 통합은 v1.x deferred(별도 ADR) — dev build 시간·러너 비용 때문. §19 CI 로드맵과 정합.

**대안 검토:**

- (Detox): gray-box 로 더 정밀하나 네이티브 설정·빌드 결합이 커 managed workflow 와 마찰. Maestro 가 도입 비용이 낮다.
- (Expo Go + Maestro): 네이티브 빌드 0 이지만 런처 화면·딥링크 로딩으로 flaky. dev build 의 번들 ID launch 가 안정적(ADR 세션의 앱 구동 방식 결정과 일치).
- (수동 e2e 만 유지): 골든 패스 회귀를 매번 사람이 검증 → 비용 큼. 자동화가 값싸게 방어.
- (스크린샷 시각 회귀 Percy/Chromatic): 색/레이아웃까지 잡지만 인프라·비용 큼 → v1.0 은 Maestro `takeScreenshot` 수동 리뷰로 대체(TESTING.md §6.5 정책과 정합, v2 재검토).

**결과 / 영향:**

- **신규 npm 의존성 없음** — Maestro 는 시스템 도구(`~/.maestro`), npm devDependency 아님. `package.json` 에 e2e 스크립트 2개만 추가.
- `.maestro/` 신설: 24 flows(배치 01~07) + 2 재사용 서브플로우 + smoke. `ios/`(dev build) 는 gitignore 유지.
- TESTING.md **§18-A** 에 E2E 플로우 인벤토리 추가(신규 모듈 인벤토리 규약 §21 적용 — 누락 = step 미완). 운영 런북은 `.maestro/PLAN.md`.
- 한계: 색/애니메이션/햅틱/폰트/그림자는 자동 검증 밖 → screenshot + §18 수동 항목으로 보완. 실시간 환율 의존 값은 단정 금지(방향·패턴·구조만 검증). `tax` 카테고리는 데이터 부재로 no-data 경로만 검증 가능.
- **부수 발견 — 문서-구현 격차:** E2E 저작 중 PRD/UI_GUIDE 명세 일부가 현재 빌드에 미구현/상이함을 확인(토스트, 가정 ❓ 시트, 출처 모달, 페르소나 mismatch 가드 뷰, 의료 카테고리, 오프라인/신선도 배지). `.maestro/PLAN.md §3` 에 목록화.
  - **후속 정합(완료): "스펙을 구현에 맞춰 하향".** `UI_GUIDE.md` 에 §v1.0 구현 현황 편차표 + 각 관련 섹션 `⚠ v1.0 현황` 주석 추가(미구현 문단은 로드맵 보존 위해 삭제 않고 마킹). `PRD.md` 는 수정 금지(단일 출처)라 미변경 — PRD 기반 편차(의료·세금 해피패스·배수 "배")도 UI_GUIDE 편차표에 함께 기록. 스펙을 구현 수준까지 다시 올리는 방향은 별도 제품 결정.

**관련:** ADR-041(라우팅 단축), ADR-060/061/062(단일 선택·inclusion), TESTING.md §18-A·§18·§19, `.maestro/PLAN.md`, `.maestro/README.md`, `package.json`.
