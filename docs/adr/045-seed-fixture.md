[← ADR 인덱스](../ADR.md)

# ADR-045: v1.0 시드 = schema-pass fixture (한시적)

**상태:** 채택 (2026-04-29)

**맥락:**

- v1.0 데이터 레이어는 `docs/ARCHITECTURE.md` §캐시·오프라인 전략 에 따라 네트워크 실패 시 번들 시드로 fallback 해야 한다.
- ADR-032 가 정한 데이터 정책: 모든 도시 값은 정부 통계 API · 공식 정부 페이지 등 **공공 출처에서 자동으로만** 갱신, 수동 큐레이션 금지.
- 자동화 phase (`docs/AUTOMATION.md`) 가 GitHub Actions cron + `scripts/refresh/<source>.mjs` 로 `data/all.json` 을 산출하지만, 이 phase 는 본 data-layer phase 보다 **늦게** 구현된다.
- 그 사이 시드 파일이 비어 있으면: (a) 첫 실행 + 네트워크 없음 = 빈 화면, (b) ARCHITECTURE 의 시드 fallback 명세 위반.
- data-layer phase step 2 가 WebFetch 로 직접 채집을 시도했으나, 핵심 출처 모두 자동 추출 불가 (KOSIS·한국소비자원 = `KR_DATA_API_KEY` 필수, CMHC RMR = Excel only, StatsCan CPI = CSV only, 서울교통공사 cert error / 403). schema 30 필드 중 5 필드만 추출 가능 → CLAUDE.md CRITICAL 의 추정 금지 규정에 막혀 step blocked.

**결정:**

1. v1.0 의 `data/seed/all.json` 은 step 1 에서 만든 schema-pass fixture (`src/__fixtures__/cities/{seoul,vancouver}-valid.ts`) 의 값을 **그대로** 사용한다.
2. fixture 값들은 schema 를 통과하고 차원적으로 현실적이지만 (서울 원룸 90만, 밴쿠버 oneBed 2300 CAD 등), **실제 출처 페이지로 검증되지 않은 placeholder** 다.
3. 출시 전 자동화 phase 가 1회 이상 실행되어 `data/all.json` 을 생성해야 한다. EAS 빌드 직전 게이트 (별도 phase) 가 이를 강제한다 — fixture 시드 상태로 production 빌드 금지.
4. 자동화 phase 가 산출한 실 `all.json` 이 GitHub raw 로 배포되면, 사용자 앱은 24h 내 자동 fetch 로 fixture 시드 위에 실 데이터를 덮어쓴다. 시드는 _완전 오프라인 신규 사용자_ 에게만 노출된다.

**대안 검토:**

- (A) `KR_DATA_API_KEY` (data.go.kr 공공데이터포털 키) 발급 + step 2 가 직접 채집: 본 phase 가 외부 secret 에 종속 + 자동화 phase 의 책임과 중복. 거부.
- (B) ADR-032 의 "수동 큐레이션 금지" 를 시드 한정 예외 명시 + 사용자가 PDF·Excel 리포트 손수 옮김: 분기 갱신마다 사람 시간 ~3시간, 드리프트 위험. 거부.
- (D) 시드 자체 제거, 네트워크 실패 시 ErrorView: ARCHITECTURE.md §캐시·오프라인 전략 위반 + 첫 콜드 스타트 빈 화면. 거부.

**결과 / 영향:**

- 본 phase (data-layer) 의 step 3·4 가 진행 가능 — currency.ts·data.ts 통합 smoke 가 schema-pass payload 로 동작.
- 자동화 phase 의 책임이 더 명확해진다: "출시 전 한 번은 반드시 실행되어야 한다."
- 출시 빌드 게이트 ADR (별도) 에서 _fixture seed 검출 → EAS build 거부_ 정책 명시 필요.
- `data/seed/all.json` 의 `lastUpdated` 와 `accessedAt` 는 fixture 작성일 (`2026-04-01`) 그대로 — 자동화가 덮어쓸 때 갱신.
- 사용자에게 **노출되는 데이터에는 영향이 없어야 한다** (출시 전 실 데이터로 교체).
- `src/lib/data.ts` (step 4) 가 시드 fallback 시 dev 콘솔에 명시적 warn 출력 — fixture 사용 가시성 확보.

**관련:** ADR-032 (데이터 자동화 정책), `docs/AUTOMATION.md`.
