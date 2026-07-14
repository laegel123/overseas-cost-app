[← ADR 인덱스](../ADR.md)

# ADR-046: 환율 fallback v1.0 = 1차(open.er-api) + 3차(하드코딩 baseline) — 2차 ECB 보류

**상태:** 채택 (2026-04-29)

**맥락:**

- ADR-026 이 정한 환율 fallback chain 은 3단계: (1) open.er-api.com (자동) → (2) ECB (자동, EUR base 환산) → (3) 한국은행 분기 하드코딩 값 (수동).
- data-layer phase step 3 (currency-converter) 에서 1차·3차 는 즉시 구현 가능. ECB 는 별도 작업이 필요하다:
  - ECB endpoint 는 XML 기반 (`<gesmes:Envelope>` 트리). RN 환경에 XML 파서 (`fast-xml-parser` 등) 신규 의존성 추가 필요.
  - ECB 는 EUR base 라 KRW 산출 시 두 단계 환산 (X→EUR→KRW) — 변환·테스트 코드 분리 필요.
- 1차 + 3차 만으로 가용성은 사실상 100% 확보:
  - 1차 open.er-api 는 무료·무인증, 운영 5년+ 안정 (실패율 측정 부재 — 운영 중 모니터링).
  - 3차 baseline 은 분기마다 한국은행 평균 환율로 갱신되는 코드 내 const. 1차 실패 + 캐시 stale 인 경우의 마지막 안전망.
- 사용자 영향: 1차 실패 + 캐시도 없는 cold-start 코너 케이스에서 stale 분기 평균 환율 사용. 비교용 정보로는 충분 (실시간 거래용 X).

**결정:**

1. v1.0 의 `src/lib/currency.ts` 는 fallback 2단계만 구현: `open.er-api` (1차) → 캐시 stale 또는 baseline (3차).
2. ECB (2차) 는 v1.x deferred. 도입 시 별도 ADR — 도입 조건은 1차 실패율 ≥ 5% 또는 운영자 수동 결정.
3. 우선순위: `bypassCache=false` + 캐시 신선 → 캐시 hit. 그 외 → 1차 fetch. 실패 시 (네트워크/HTTP/parse/timeout 모두) → 캐시 (있으면 stale 도) 반환. 캐시도 없으면 → `FX_BASELINE_<YYYY>Q<n>` 사본 반환.
4. fetch 가 성공한 경우에만 `meta:fxLastSync` 갱신 → 호출자가 staleness 감지 가능.
5. `fetchExchangeRates` 는 호출자에게 throw 하지 않는다 (항상 ExchangeRates 반환). 에러 카탈로그 (FxFetchError·FxParseError·FxTimeoutError) 는 내부 fetchPrimary 단계에서 정확한 분기 처리에만 사용.

**대안 검토:**

- (A) 즉시 ECB 도입: XML 파서 의존성 추가 + 환산 로직 + 테스트 매트릭스 ~4시간. 일정 영향. 도입 시점 가치 < 비용. 거부.
- (B) 1차만 + 실패 시 throws: ARCHITECTURE.md §캐시 전략 의 "stale 캐시 + 경고 배지" 패턴 위반 + cold-start 시 환율 N/A 화면. 거부.
- (C) baseline 무시, 캐시 없으면 환율 N/A: cold-start 사용자가 "?" 만 보게 됨 — 비교 앱 핵심 기능 마비. 거부.

**결과 / 영향:**

- step 3 currency.ts 가 현재 phase 안에서 완결. step 4 data.ts 와 독립.
- ECB 도입 시 `fetchExchangeRates` 내부에 1차 catch 후 ECB 시도 + 실패 시 stale/baseline 으로 fallthrough — 본 ADR 의 외부 계약 (throw 안 함, 항상 반환) 은 유지.
- 1차 출처 운영자 변경·shape 변경 시 즉시 baseline fallback 으로 동작 — 사용자 화면 깨지지 않음.
- 운영자 모니터링: 분기마다 1회 응답 shape 검증 (DATA.md §5.4) + 베타·출시 후 1차 실패율 추적.

**알려진 트레이드오프 — `inflight` 와 `bypassCache` 상호작용:**

`fetchExchangeRates({ bypassCache: true })` 가 진행 중인 다른 호출 (`bypassCache: false`, 캐시 hit 반환 예정) 을 만나면 in-flight dedup 으로 인해 **bypassCache 의도가 무시**된다 (이미 진행 중인 Promise 를 그대로 반환). 사용자가 설정 화면에서 "데이터 새로고침" 을 빠르게 두 번 누르거나, 부트로더 fetch 와 새로고침이 겹치는 race condition 에서 발생.

수용한 이유: dedup 는 정상 흐름에서 중복 fetch 를 막는 핵심 기제. bypassCache 우선 처리하려면 dedup 키를 `bypassCache` 별도 분기 또는 inflight 취소 메커니즘 필요 — 복잡도 대비 가치 낮음 (사용자 두 번째 클릭은 첫 번째 결과로 충족됨). 동일 동작이 `src/lib/data.ts` 의 `loadAllCities` 에도 적용. v2 이후 사용자 보고 시 재검토.

**관련:** ADR-026 (3단계 fallback), ADR-047 (baseline 분기 갱신), `src/lib/currency.ts`.
