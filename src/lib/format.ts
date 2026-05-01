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
 * 배수 >= HOT_MULTIPLIER_THRESHOLD (2.0) 면 true.
 *
 * @param mult - 배수 (number) 또는 '신규'
 * @returns true if hot (mult >= 2.0), false otherwise
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
  return mult >= HOT_MULTIPLIER_THRESHOLD;
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
