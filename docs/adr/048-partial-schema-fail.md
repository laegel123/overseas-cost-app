[← ADR 인덱스](../ADR.md)

# ADR-048: 부분 schema 실패 정책 — 한 도시 invalid → 그 도시 제외 + warn

**상태:** 채택 (2026-04-29)

**맥락:**

- `src/lib/data.ts` 가 fetch 한 `all.json` 에 21개 도시 + 메타가 들어있다. 운영자 큐레이션 실수 또는 분기 갱신 중 한 도시의 한 필드가 schema 위반 가능.
- 옵션 (a) 전체 batch 를 reject (`validateAllJson` strict) — 21개 중 1개 깨졌다고 사용자에게 ErrorView 보여주는 건 과도.
- 옵션 (b) 깨진 도시만 제외하고 나머지 20개 보여주기 — 부분 가용성, 사용자 경험상 합리.

**결정:**

1. `src/lib/data.ts` 는 자체 lenient parser (`parseLenient`) 를 사용. `validateAllJson` (strict) 은 단위 테스트·시드 round-trip 용 단일 출처 검증으로만 사용.
2. lenient parser:
   - top-level shape (schemaVersion, generatedAt, fxBaseDate, cities) 위반 → CitySchemaError throw (전체 batch 거부)
   - 개별 도시 위반 → 그 도시만 제외 + dev 콘솔 `console.warn(\`[data] city '<id>' excluded: <code> <message>\`)`
   - 0개 도시만 통과 → CitySchemaError throw (의미 있는 데이터 없음)
3. 사용자가 깨진 도시 ID 로 진입 시도 시 `getCity(id)` 가 undefined 반환 → 화면 단에서 ErrorView 또는 "이 도시 데이터를 불러올 수 없습니다" 처리 (별도 phase 책임).
4. dev 콘솔 warn 은 silent fail 회피의 가시성 보장 (CLAUDE.md CRITICAL). 프로덕션 빌드 (Release) 에서는 babel transform-remove-console 으로 자연스럽게 무음 — 운영 phase 의 sentry-like 보고는 v2 이후.

**대안 검토:**

- (A) strict — 한 도시 깨지면 전체 ErrorView: 전체 21개를 1개의 잘못된 데이터로 잃는다. 부정확한 사용자 경험.
- (B) 깨진 도시를 schema-default 값으로 채워서 보여주기: 사용자에게 거짓 정보 표시. 거부 (출처 정합성 위반).

**결과 / 영향:**

- 한 도시 데이터 결함이 다른 19개에 전염되지 않음.
- dev 빌드에서는 깨진 도시가 빈번히 가시화 → 분기 갱신 시 즉각 발견.
- `getCity(id)` 의 undefined 반환 의미가 (a) 도시 자체 미존재, (b) schema 위반으로 제외 둘 다 포함 — 사용자에게 표시할 메시지는 화면 phase 에서 결정.

**관련:** CLAUDE.md CRITICAL ("에러 삼키지 않는다"), DATA.md §2 (CityCostData 스키마), `src/lib/citySchema.ts` (strict validateAllJson).
