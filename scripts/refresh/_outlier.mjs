/**
 * 변동 검증 — 데이터 갱신 시 변동폭에 따라 action 분류.
 * AUTOMATION.md §6 정확 경계:
 *   <5%  → 'commit'
 *   5~30% → 'pr-update'
 *   ≥30% → 'pr-outlier'
 *   null 처리: new / removed
 */

/**
 * @typedef {'new' | 'commit' | 'pr-update' | 'pr-outlier' | 'pr-removed'} ChangeType
 */

/**
 * oldVal → newVal 변동폭에 따라 분류.
 * @param {number | null} oldVal
 * @param {number | null} newVal
 * @returns {ChangeType}
 */
export function classifyChange(oldVal, newVal) {
  validateInput(oldVal, 'oldVal');
  validateInput(newVal, 'newVal');

  if (oldVal === null && newVal === null) {
    return 'commit';
  }

  if (oldVal === null && newVal !== null) {
    return 'new';
  }

  if (oldVal !== null && newVal === null) {
    return 'pr-removed';
  }

  if (oldVal === 0 && newVal === 0) {
    return 'commit';
  }

  if (oldVal === 0) {
    return 'new';
  }

  const pctChange = Math.abs((newVal - oldVal) / oldVal) * 100;

  if (pctChange < 5) {
    return 'commit';
  }
  if (pctChange < 30) {
    return 'pr-update';
  }
  return 'pr-outlier';
}

/**
 * 변동률 계산 (퍼센트).
 * @param {number | null} oldVal
 * @param {number | null} newVal
 * @returns {number}
 */
export function computePctChange(oldVal, newVal) {
  if (oldVal === null || oldVal === 0) {
    return newVal === null || newVal === 0 ? 0 : 100;
  }
  if (newVal === null) {
    return -100;
  }
  return ((newVal - oldVal) / oldVal) * 100;
}

/**
 * @param {unknown} val
 * @param {string} name
 */
function validateInput(val, name) {
  if (val === null) {
    return;
  }

  if (typeof val !== 'number') {
    throw new Error(`${name} must be a number or null, got ${typeof val}`);
  }

  if (Number.isNaN(val)) {
    throw new Error(`${name} must not be NaN`);
  }

  if (!Number.isFinite(val)) {
    throw new Error(`${name} must be finite, got ${val}`);
  }

  if (val < 0) {
    throw new Error(`${name} must be non-negative, got ${val}`);
  }
}
