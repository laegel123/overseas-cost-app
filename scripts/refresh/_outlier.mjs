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
 *
 * 사용 시점: `scripts/detect_outliers.mjs` 가 워킹트리 ↔ HEAD 비교 시 본 함수를 호출 →
 * `HAS_OUTLIERS` (≥30%) / `HAS_UPDATES` (5~30%) 두 GitHub Actions 출력으로 export →
 * 워크플로우가 outlier PR / auto-update PR / 직접 commit 중 하나로 분기
 * (AUTOMATION.md §1 의 분류 정책 명세 그대로).
 *
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

  // oldVal === 0 → createCitySeed 의 placeholder 0 이 실제 값으로 첫 갱신되는 케이스. 신규로 분류.
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
 * 도시 JSON 의 비교 가능한 numeric 필드 평탄화 — rent / food / food.groceries / transport /
 * tuition[].annual / visa.* 까지. detect_outliers.mjs 가 직전 commit 비교 시 사용.
 *
 * @param {Object} oldData
 * @param {Object} newData
 * @returns {Iterable<{path: string, oldVal: number|null, newVal: number|null}>}
 */
export function* iterNumericFields(oldData, newData) {
  const sections = [
    { key: 'rent', fields: ['share', 'studio', 'oneBed', 'twoBed', 'deposit'] },
    { key: 'food', fields: ['restaurantMeal', 'cafe'] },
    { key: 'transport', fields: ['monthlyPass', 'singleRide', 'taxiBase'] },
  ];

  for (const { key, fields } of sections) {
    const oldSection = oldData[key] ?? {};
    const newSection = newData[key] ?? {};
    for (const f of fields) {
      const o = oldSection[f];
      const n = newSection[f];
      if (o === undefined && n === undefined) continue;
      yield {
        path: `${key}.${f}`,
        oldVal: typeof o === 'number' ? o : null,
        newVal: typeof n === 'number' ? n : null,
      };
    }
  }

  const oldGroceries = oldData.food?.groceries ?? {};
  const newGroceries = newData.food?.groceries ?? {};
  const groceryKeys = new Set([...Object.keys(oldGroceries), ...Object.keys(newGroceries)]);
  for (const f of groceryKeys) {
    const o = oldGroceries[f];
    const n = newGroceries[f];
    yield {
      path: `food.groceries.${f}`,
      oldVal: typeof o === 'number' ? o : null,
      newVal: typeof n === 'number' ? n : null,
    };
  }

  const oldTuition = Array.isArray(oldData.tuition) ? oldData.tuition : [];
  const newTuition = Array.isArray(newData.tuition) ? newData.tuition : [];
  const tuitionLen = Math.max(oldTuition.length, newTuition.length);
  for (let i = 0; i < tuitionLen; i++) {
    const o = oldTuition[i]?.annual;
    const n = newTuition[i]?.annual;
    yield {
      path: `tuition[${i}].annual`,
      oldVal: typeof o === 'number' ? o : null,
      newVal: typeof n === 'number' ? n : null,
    };
  }

  const oldVisa = oldData.visa ?? {};
  const newVisa = newData.visa ?? {};
  for (const f of ['studentApplicationFee', 'workApplicationFee', 'settlementApprox']) {
    const o = oldVisa[f];
    const n = newVisa[f];
    if (o === undefined && n === undefined) continue;
    yield {
      path: `visa.${f}`,
      oldVal: typeof o === 'number' ? o : null,
      newVal: typeof n === 'number' ? n : null,
    };
  }
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
