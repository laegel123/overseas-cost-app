[← ADR 인덱스](../ADR.md)

# ADR-065: 출처 유형 총수 단일 출처화 + 인앱 개인정보 링크 정본 URL 정합

> **상태**: Active

**컨텍스트:**

`app/(tabs)/settings.tsx` 에 v1.x DX 정리 대상 두 가지가 있었다 (코드 내 TODO 로 추적).

1. "데이터 출처 보기" rightText 의 `DATA_SOURCES_COUNT = 12` 가 하드코딩이라 `docs/DATA_SOURCES.md` 의 "출처 유형 총수" 와 **수동 동기화**였다. 출처 추가/제거 시 한쪽만 갱신하는 silent drift 누락 위험.
2. 인앱 "개인정보 처리방침" 메뉴가 `github.com/.../blob/main/docs/PRIVACY.md` (GitHub raw markdown) 를 열었는데, Play Store 등록 및 RELEASE.md §7 이 선언한 정본 본문은 `https://laegel123.github.io/overseas-cost-app/privacy-policy.html` (GitHub Pages HTML) 라 불일치.

**결정:**

1. **출처 유형 총수 단일 출처 = `docs/DATA_SOURCES.md` 머신 마커.** `<!-- DATA_SOURCES_COUNT: N -->` 주석을 단일 출처로 두고, 상수를 `src/lib/dataSources.ts` 로 이전(+ `@/lib` 배럴 export). `src/lib/__tests__/dataSources.test.ts` 가 마커 ↔ 상수 일치를 CI 에서 강제 (불일치 시 빌드 red).
2. **인앱 개인정보 링크 = 출시 정본 GitHub Pages URL.** `PRIVACY_POLICY_URL` 을 `privacy-policy.html` 로 변경 → 앱/스토어 정책 정본 일치. JS-only 변경이라 expo-updates(ADR-064) OTA 로도 배포 가능(본 변경은 레포 반영까지, build/submit/update 트리거 안 함).

**대안 검토:**

- (빌드타임 codegen 자동 카운트): TODO 주석의 문구였으나, "12" 는 기계적으로 셀 수 없는 큐레이션 의미값(출처 유형/카테고리)이라 codegen 이점이 없고 생성 파일·prebuild 훅 도입은 출시 중 불필요한 리스크. 테스트 강제 동기화가 동일 목적(누락 방지)을 더 단순히 달성.
- (인앱 링크를 PRIVACY.md 유지): 스토어 정본과 다른 본문 두 곳 유지 → 정책 변경 시 drift. 정본 HTML 하나로 통일.

**결과 / 영향:**

- 신규 `src/lib/dataSources.ts`, `src/lib/__tests__/dataSources.test.ts`; `docs/DATA_SOURCES.md` 마커 + 경고 블록 갱신; `docs/TESTING.md` §9.33 추가 + §9.29 갱신; `app/(tabs)/settings.tsx` 상수 import + privacy URL 변경.
- `docs/PRIVACY.md` 는 참고 자료로 유지(삭제 안 함). 인앱 링크만 정본 HTML 로 이동.
- 표시값(12개)·런타임 동작 동일 — 시각/기능 회귀 없음.

**관련:** ADR-064 (expo-updates OTA), RELEASE.md §7, `docs/DATA_SOURCES.md`, `src/lib/dataSources.ts`, `app/(tabs)/settings.tsx`.
