/**
 * 포매팅 유틸리티 — 금액·배수·날짜 표시용.
 * 도메인 특화 (만/천 단위, hot 판정 등) — i18n 라이브러리 대신 경량 구현.
 */

import { HOT_MULTIPLIER_THRESHOLD } from '@/theme/tokens';

import { InvalidMultiplierError } from './errors';

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
 * 배수 + hot 상태에 따른 텍스트 색상 — `ComparePair` / `FavCard` / `RecentRow`
 * 공통 정책. 디자인 spec (design/README.md §2·§3):
 * - hot → orange (강조)
 * - '신규' → navy (mid, 비교 불가지만 텍스트는 정보 가치)
 * - 표시값 ≤ 1.0 (cool 또는 동일) → gray-2 (de-emphasis)
 * - 그 외 (mid, mult > 1) → navy
 *
 * `GroceryRow` 는 디자인 의도상 cool/mid 구분 없이 단순 `'gray'` 를 사용 — 본
 * 헬퍼 미사용 (design/README.md §4 명시).
 */
export function getMultColor(
  mult: number | '신규',
  hot: boolean,
): 'orange' | 'navy' | 'gray-2' {
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
