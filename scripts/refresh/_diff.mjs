/**
 * 변경 추적 — 두 CityCostData 객체 간 차이점 추출.
 * 메타 필드 (lastUpdated, sources) 제외. 중첩 필드 dot-path. 배열 원소별.
 */

import { computePctChange } from './_outlier.mjs';

/**
 * @typedef {Object} ChangeRecord
 * @property {string} field
 * @property {number | null} oldValue
 * @property {number | null} newValue
 * @property {number} pctChange
 */

// 식별·메타 필드 — diff 대상에서 명시적 제외. (numeric diff 만 추적)
const META_FIELDS = new Set(['lastUpdated', 'sources', 'id', 'name', 'country', 'currency', 'region']);

/**
 * 두 도시 데이터 간 변경된 숫자 필드 목록 반환.
 * @param {import('../../src/types/city').CityCostData} oldData
 * @param {import('../../src/types/city').CityCostData} newData
 * @returns {ChangeRecord[]}
 */
export function diffCities(oldData, newData) {
  /** @type {ChangeRecord[]} */
  const changes = [];

  diffObject(oldData, newData, '', changes);

  return changes;
}

/**
 * 재귀적으로 객체 diff.
 * @param {unknown} oldVal
 * @param {unknown} newVal
 * @param {string} path
 * @param {ChangeRecord[]} changes
 */
function diffObject(oldVal, newVal, path, changes) {
  if (isMetaField(path)) {
    return;
  }

  if (isNumericOrNull(oldVal) && isNumericOrNull(newVal)) {
    const oldNum = oldVal ?? null;
    const newNum = newVal ?? null;

    if (oldNum !== newNum) {
      changes.push({
        field: path,
        oldValue: oldNum,
        newValue: newNum,
        pctChange: computePctChange(oldNum, newNum),
      });
    }
    return;
  }

  if (Array.isArray(oldVal) || Array.isArray(newVal)) {
    diffArrays(oldVal, newVal, path, changes);
    return;
  }

  if (isPlainObject(oldVal) || isPlainObject(newVal)) {
    const oldObj = isPlainObject(oldVal) ? oldVal : {};
    const newObj = isPlainObject(newVal) ? newVal : {};
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of allKeys) {
      const childPath = path ? `${path}.${key}` : key;
      diffObject(oldObj[key], newObj[key], childPath, changes);
    }
    return;
  }

  if (typeof oldVal === 'string' && typeof newVal === 'string') {
    return;
  }

  if (oldVal !== newVal) {
    if (isNumericOrNull(oldVal) || isNumericOrNull(newVal)) {
      changes.push({
        field: path,
        oldValue: toNumOrNull(oldVal),
        newValue: toNumOrNull(newVal),
        pctChange: computePctChange(toNumOrNull(oldVal), toNumOrNull(newVal)),
      });
    }
  }
}

/**
 * 배열 diff (각 원소별).
 * @param {unknown} oldArr
 * @param {unknown} newArr
 * @param {string} path
 * @param {ChangeRecord[]} changes
 */
function diffArrays(oldArr, newArr, path, changes) {
  const old = Array.isArray(oldArr) ? oldArr : [];
  const newA = Array.isArray(newArr) ? newArr : [];
  const maxLen = Math.max(old.length, newA.length);

  for (let i = 0; i < maxLen; i++) {
    const itemPath = `${path}[${i}]`;
    diffObject(old[i], newA[i], itemPath, changes);
  }
}

/**
 * @param {string} path
 * @returns {boolean}
 */
function isMetaField(path) {
  const topLevel = path.split('.')[0];
  return META_FIELDS.has(topLevel);
}

/**
 * @param {unknown} val
 * @returns {val is number | null | undefined}
 */
function isNumericOrNull(val) {
  return val === null || val === undefined || typeof val === 'number';
}

/**
 * @param {unknown} val
 * @returns {val is Record<string, unknown>}
 */
function isPlainObject(val) {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * @param {unknown} val
 * @returns {number | null}
 */
function toNumOrNull(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  return null;
}
