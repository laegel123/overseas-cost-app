/**
 * Test-only types — `_common.mjs` 의 JSDoc typedef 와 동일 shape.
 *
 * **존재 이유 (PR #20 review round 20)**: TypeScript 테스트가 fetcher 의 RefreshResult 를
 * 검증할 때 `(c: any)` / `(e: any)` 로 우회하던 것을 strict 타입으로 전환. CLAUDE.md "any 금지"
 * 규칙 준수.
 *
 * `_common.mjs` 의 JSDoc typedef 가 단일 출처지만 .mjs 의 typedef 를 .ts 에서 직접 named
 * import 하기 어려워 본 파일이 동일 shape 의 mirror 정의. _common.mjs 변경 시 본 파일도 함께
 * 갱신 (양쪽 typedef 가 동기 상태인지 lint 가 자동 검증하지는 않음).
 */

export type RefreshChange = {
  cityId: string;
  field: string;
  oldValue: number | null;
  newValue: number | null;
  pctChange: number;
};

export type RefreshError = {
  cityId: string;
  reason: string;
};

export type RefreshResult = {
  source: string;
  cities: string[];
  fields: string[];
  changes: RefreshChange[];
  errors: RefreshError[];
};

/** `_outlier.mjs::iterNumericFields` generator 가 yield 하는 entry. */
export type NumericField = {
  path: string;
  oldVal: number | null;
  newVal: number | null;
};
