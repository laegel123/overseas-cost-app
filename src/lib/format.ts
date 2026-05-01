/**
 * 포매팅 유틸리티 — 금액·배수·날짜 표시용.
 * 도메인 특화 (만/천 단위, hot 판정 등) — i18n 라이브러리 대신 경량 구현.
 */

import { HOT_MULTIPLIER_THRESHOLD } from '@/theme/tokens';

import { InvalidMultiplierError, InvalidNumberError } from './errors';

/**
 * 숫자 입력 검증 (NaN, Infinity → throw).
 */
function validateNumber(n: number): void {
  if (typeof n !== 'number' || Number.isNaN(n) || !Number.isFinite(n)) {
    throw new InvalidNumberError(`invalid number — ${String(n)}`);
  }
}

/**
 * KRW 금액을 한국어 단위로 포매팅.
 * - 만원 미만: 콤마 구분 + 원 (예: "1,234원")
 * - 만원 이상: 소수 1자리 + 만원 (예: "175만원", "1.2만원")
 * - 억원 이상: 소수 1자리 + 억원 (예: "1.2억원")
 *
 * @throws InvalidNumberError if n is NaN or Infinity
 */
export function formatKRW(n: number): string {
  validateNumber(n);

  const value = Math.round(n);
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 100_000_000) {
    const billions = absValue / 100_000_000;
    const rounded = Math.round(billions * 10) / 10;
    const formatted = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
    return `${sign}${formatted}억원`;
  }

  if (absValue >= 10_000) {
    const tenThousands = absValue / 10_000;
    const rounded = Math.round(tenThousands * 10) / 10;
    const formatted = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
    return `${sign}${formatted}만원`;
  }

  return `${sign}${absValue.toLocaleString('ko-KR')}원`;
}

/**
 * 날짜를 "MM-DD" 형식으로 포매팅 (Compare 헤더용).
 *
 * UTC 기준 (PR #17 review 이슈 6) — `lastSync` 같은 ISO 시각이 기기 타임존
 * 에 따라 표시되는 날짜가 달라지지 않도록 통일. 데이터 소스의 `lastSync` 는
 * UTC ISO 문자열이라 사용자 표시도 동일 기준.
 *
 * @param d - Date 객체 또는 ISO 문자열
 * @throws InvalidNumberError if d is invalid
 */
export function formatShortDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) {
    throw new InvalidNumberError(`invalid date — ${String(d)}`);
  }

  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${month}-${day}`;
}

/**
 * 배수 입력값 검증 (0, 음수, NaN, Infinity → throw).
 */
function validateMultiplier(mult: number): void {
  if (Number.isNaN(mult) || !Number.isFinite(mult)) {
    throw new InvalidMultiplierError(`invalid multiplier — ${String(mult)}`);
  }
  if (mult <= 0) {
    throw new InvalidMultiplierError(`multiplier must be positive — ${mult}`);
  }
}

/**
 * Hot 판정 — CLAUDE.md CRITICAL 단일 함수.
 * 사용자가 보는 표시값 (`formatMultiplier` 와 동일한 소수 첫자리 반올림) 기준
 * 으로 판정. 즉 `Math.round(mult * 10) / 10 >= HOT_MULTIPLIER_THRESHOLD (2.0)`.
 *
 * raw 값 기준이면 mult=1.95 일 때 "↑2.0×" 텍스트가 hot 색이 아닌 navy 로 표시
 * 되어 "2.0배인데 왜 hot 이 아니지?" 시각 혼란 발생 — 표시값과 hot 판정의
 * 일관성을 보장한다 (PR #16 review 이슈 1).
 *
 * @param mult - 배수 (number) 또는 '신규'
 * @returns true if rounded(mult, 1) >= 2.0, false otherwise
 * @throws InvalidMultiplierError if mult is 0, negative, NaN, or Infinity
 */
export function isHot(mult: number | '신규'): boolean {
  if (mult === '신규') {
    return false;
  }
  if (typeof mult !== 'number') {
    throw new InvalidMultiplierError(`isHot: invalid multiplier — ${String(mult)}`);
  }
  validateMultiplier(mult);
  const rounded = Math.round(mult * 10) / 10;
  return rounded >= HOT_MULTIPLIER_THRESHOLD;
}

/**
 * 배수를 "↑1.9×" / "↓0.8×" / "1.0×" / "신규" 형식으로 포매팅.
 * - 반올림 값 > 1.0 → "↑X.X×"
 * - 원본 값 < 1.0 → "↓X.X×" (반올림 후 1.0 이어도 ↓ 유지)
 * - 그 외 → "X.X×" (화살표 없음)
 * - '신규' → "신규"
 *
 * @param mult - 배수 (number) 또는 '신규'
 * @returns 포매팅된 문자열
 * @throws InvalidMultiplierError if mult is 0, negative, NaN, or Infinity
 */
export function formatMultiplier(mult: number | '신규'): string {
  if (mult === '신규') {
    return '신규';
  }
  if (typeof mult !== 'number') {
    throw new InvalidMultiplierError(`formatMultiplier: invalid multiplier — ${String(mult)}`);
  }
  validateMultiplier(mult);

  const rounded = Math.round(mult * 10) / 10;
  const formatted = rounded.toFixed(1);

  if (rounded > 1.0) {
    return `↑${formatted}×`;
  }
  if (mult < 1.0) {
    return `↓${formatted}×`;
  }
  return `${formatted}×`;
}

/**
 * 두 값의 배수를 계산. 음수 입력은 절대값 기준으로 안 한다 (음수가 들어올 일이
 * 없는 가격 도메인 — 들어오면 호출 사이트 버그). silent fallback 금지.
 *
 * - `seoulVal === 0 && cityVal > 0` → `'신규'` (서울에 항목 없음, 비자처럼 신규
 *   카테고리). PR #17 review 이슈 2 — 이전엔 Infinity 반환했으나 후속
 *   `formatMultiplier(Infinity)` / `isHot(Infinity)` 가 throw 해서 화면 crash.
 * - `seoulVal === 0 && cityVal === 0` → `1` (둘 다 0 = 동일).
 * - 그 외 → `cityVal / seoulVal`.
 *
 * 음수·NaN·Infinity 는 호출 사이트 책임 — 본 함수는 검증 안 함 (Compare/Detail
 * 화면이 raw 가격 합계를 넣음, 이미 valid number).
 */
export function computeMultiplier(
  seoulVal: number,
  cityVal: number,
): number | '신규' {
  if (seoulVal === 0 && cityVal > 0) return '신규';
  if (seoulVal === 0) return 1;
  return cityVal / seoulVal;
}

/**
 * 두 값의 막대 폭 비율을 [0, 1] 로 계산. 합 0 이면 0.5 / 0.5 반환 (UI 가
 * "둘 다 0" 을 시각적으로 표현).
 */
export function computeBarPcts(
  seoulVal: number,
  cityVal: number,
): { swPct: number; cwPct: number } {
  const total = seoulVal + cityVal;
  if (total === 0) return { swPct: 0.5, cwPct: 0.5 };
  return { swPct: seoulVal / total, cwPct: cityVal / total };
}

/**
 * 배수 + hot 상태에 따른 텍스트 색상 — `ComparePair` / `FavCard` / `RecentRow`
 * 공통 정책. 디자인 spec (design/README.md §2·§3):
 * - hot → orange (강조)
 * - '신규' → navy (mid, 비교 불가지만 텍스트는 정보 가치)
 * - 표시값 ≤ 1.0 (cool 또는 동일) → gray-2 (de-emphasis)
 * - 그 외 (mid, mult > 1) → navy
 *
 * `GroceryRow` 는 디자인 의도상 cool/mid 구분 없이 단순 `'gray'` 를 사용 — 본
 * 헬퍼 미사용 (design/README.md §4 명시).
 *
 * `isHot` / `formatMultiplier` 와 동일하게 잘못된 입력 (NaN / 0 / 음수 / Infinity)
 * 을 silent fallback 없이 차단 — exported 퍼블릭 API 안전성 (PR #16 review 이슈 3).
 *
 * 주의: `hot=true` override 도 mult 검증을 우회하지 않는다. `getMultColor(NaN, true)`
 * 는 'orange' 가 아니라 InvalidMultiplierError 를 throw 한다 — 잘못된 mult 값이
 * 호출 사이트에 도달했다는 근본 문제를 silent 색상 반환으로 가리지 않기 위함
 * (CLAUDE.md "에러는 삼키지 않는다" 정책).
 */
export function getMultColor(
  mult: number | '신규',
  hot: boolean,
): 'orange' | 'navy' | 'gray-2' {
  if (mult !== '신규') {
    if (typeof mult !== 'number') {
      throw new InvalidMultiplierError(`getMultColor: invalid multiplier — ${String(mult)}`);
    }
    validateMultiplier(mult);
  }
  if (hot) {
    return 'orange';
  }
  if (mult === '신규') {
    return 'navy';
  }
  const rounded = Math.round(mult * 10) / 10;
  if (rounded <= 1.0) {
    return 'gray-2';
  }
  return 'navy';
}
