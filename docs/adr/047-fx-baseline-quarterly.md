[← ADR 인덱스](../ADR.md)

# ADR-047: `FX_BASELINE_<YYYY>Q<n>` 분기 갱신 정책

**상태:** 채택 (2026-04-29)

**맥락:**

- ADR-046 이 정한 3차 fallback 은 코드 내 const (`src/lib/currency.ts` 의 `FX_BASELINE_<YYYY>Q<n>`).
- 1차 (open.er-api) 가 일별 갱신이라 매우 신선하지만, 3차는 정의상 "최후의 안전망" — 분기 평균값으로 충분.
- 그러나 1년 이상 갱신 안 된 baseline 은 환율 변동 누적 시 비교 결과 왜곡 (예: KRW/USD 가 30% 변동한 채 1년 stale 이면 비교 앱 신뢰성 손상).
- 운영자 수동 갱신 + 자동화 워크플로우 (`refresh-fx.yml`, AUTOMATION.md §4.6) 둘 다 옵션. 자동화는 후속 phase 책임.

**결정:**

1. `FX_BASELINE_<YYYY>Q<n>` 의 const 이름 자체에 분기 정보를 박는다 (예: `FX_BASELINE_2026Q2`). 새 분기 진입 시 const 이름 + 값 동시 갱신.
2. 출처는 한국은행 ECOS 시스템 (https://ecos.bok.or.kr/) 의 통화별 분기 평균 환율. const 위 주석에 출처 URL 명시.
3. 분기 시작 후 첫 PR 시 갱신 — 분기 1일~7일 사이. 늦어도 분기 1개월 이내.
4. 자동화 phase 가 도입되는 시점에 `scripts/refresh/fx_backup.mjs` 가 본 const 를 자동 갱신하도록 통합 (AUTOMATION.md §4.6 참조). 그때까지는 운영자 수동.
5. 갱신 시 currency.test.ts 의 hardcoded 기대값 (예: `FX_BASELINE_2026Q2.USD === 1380`) 도 동시 수정 필요.

**대안 검토:**

- (A) baseline 을 정적 JSON 파일 (`data/static/fx_fallback.json`) 에서 로드: 런타임 의존성 추가 + RN 번들에 정적 자산 포함 필요. const 가 더 단순.
- (B) baseline 없이 stale 캐시만 fallback: cold-start + 캐시 없는 코너 케이스에서 환율 N/A — ADR-046 거부 사유 동일.

**결과 / 영향:**

- 분기마다 `currency.ts` 한 줄 + 테스트 한 줄 갱신. 5분 작업.
- const 이름이 분기를 명시하므로 `git blame` 로 마지막 갱신 분기 즉시 확인 가능.
- 자동화 phase 도입 시 본 ADR 갱신 (수동 → 자동 전환).
- 출시 직전 (M6) 빌드 게이트가 baseline 의 stale 정도를 검증할 수 있음 (별도 phase).

**관련:** ADR-046 (fallback v1.0 정책), ADR-026 (3단계 fallback), AUTOMATION.md §4.6.
