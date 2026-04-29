/**
 * 도시 / batch 파일 schema 검증.
 *
 * docs/DATA.md §2 (CityCostData), §6.1 (all.json batch), §11 (정의 표준) 의
 * 필드별 의미·제약을 런타임에서 강제한다. 외부 schema 라이브러리는 사용하지 않는다.
 *
 * 모든 위반은 CitySchemaError, JSON.parse 실패는 CityParseError 로 throw.
 * silent ignore 금지 — 미지의 추가 필드만 통과 + 무시 (forward compat).
 */

import type {
  AllCitiesData,
  CityCostData,
  CityFood,
  CityGroceries,
  CityRent,
  CitySource,
  CityTaxEntry,
  CityTransport,
  CityTuitionEntry,
  CityVisa,
  Region,
  SourceCategory,
  TuitionLevel,
} from '@/types/city';

import { CityParseError, CitySchemaError } from './errors';

const REGIONS: readonly Region[] = ['na', 'eu', 'asia', 'oceania', 'me'] as const;
const SOURCE_CATEGORIES: readonly SourceCategory[] = [
  'rent',
  'food',
  'transport',
  'tuition',
  'tax',
  'visa',
] as const;
const TUITION_LEVELS: readonly TuitionLevel[] = ['undergrad', 'graduate', 'language'] as const;

const REQUIRED_GROCERY_KEYS = ['milk1L', 'eggs12', 'rice1kg', 'chicken1kg', 'bread'] as const;

const ID_RE = /^[a-z][a-z0-9-]*$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

function fail(path: string, reason: string): never {
  throw new CitySchemaError(`${path}: ${reason}`);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function assertObject(path: string, v: unknown): Record<string, unknown> {
  if (!isPlainObject(v)) {
    fail(path, `expected object, got ${v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v}`);
  }
  return v;
}

function assertNonEmptyString(path: string, v: unknown): string {
  if (typeof v !== 'string') fail(path, `expected string, got ${typeof v}`);
  if (v.length === 0) fail(path, 'expected non-empty string, got empty string');
  return v;
}

function assertPositiveNumber(path: string, v: unknown): number {
  if (typeof v !== 'number') fail(path, `expected number, got ${typeof v}`);
  if (!Number.isFinite(v)) fail(path, `expected finite number, got ${v}`);
  if (v <= 0) fail(path, `expected positive number, got ${v}`);
  return v;
}

function assertNonNegativeNumber(path: string, v: unknown): number {
  if (typeof v !== 'number') fail(path, `expected number, got ${typeof v}`);
  if (!Number.isFinite(v)) fail(path, `expected finite number, got ${v}`);
  if (v < 0) fail(path, `expected non-negative number, got ${v}`);
  return v;
}

function assertNullableNonNegativeNumber(path: string, v: unknown): number | null {
  if (v === null) return null;
  return assertNonNegativeNumber(path, v);
}

function assertEnum<T extends string>(path: string, v: unknown, allowed: readonly T[]): T {
  if (typeof v !== 'string') fail(path, `expected string, got ${typeof v}`);
  if (!(allowed as readonly string[]).includes(v)) {
    fail(path, `expected one of [${allowed.join(', ')}], got '${v}'`);
  }
  return v as T;
}

function assertIsoDate(path: string, v: unknown): string {
  const s = assertNonEmptyString(path, v);
  if (!ISO_DATE_RE.test(s)) {
    fail(path, `expected ISO date 'YYYY-MM-DD', got '${s}'`);
  }
  return s;
}

function assertIsoDateTime(path: string, v: unknown): string {
  const s = assertNonEmptyString(path, v);
  if (!ISO_DATETIME_RE.test(s)) {
    fail(path, `expected ISO datetime, got '${s}'`);
  }
  return s;
}

function assertArray(path: string, v: unknown): unknown[] {
  if (!Array.isArray(v)) fail(path, `expected array, got ${typeof v}`);
  return v;
}

function validateRent(path: string, v: unknown): CityRent {
  const obj = assertObject(path, v);
  const rent: CityRent = {
    share: assertNullableNonNegativeNumber(`${path}.share`, obj.share),
    studio: assertNullableNonNegativeNumber(`${path}.studio`, obj.studio),
    oneBed: assertNullableNonNegativeNumber(`${path}.oneBed`, obj.oneBed),
    twoBed: assertNullableNonNegativeNumber(`${path}.twoBed`, obj.twoBed),
  };
  if (obj.deposit !== undefined) {
    rent.deposit = assertPositiveNumber(`${path}.deposit`, obj.deposit);
  }
  return rent;
}

function validateGroceries(path: string, v: unknown): CityGroceries {
  const obj = assertObject(path, v);
  for (const key of REQUIRED_GROCERY_KEYS) {
    if (!(key in obj)) fail(`${path}.${key}`, 'missing required field');
    assertPositiveNumber(`${path}.${key}`, obj[key]);
  }
  // 추가 키도 양수 number 또는 undefined 만 허용 (사람 실수 차단).
  for (const [key, val] of Object.entries(obj)) {
    if ((REQUIRED_GROCERY_KEYS as readonly string[]).includes(key)) continue;
    if (val === undefined) continue;
    assertPositiveNumber(`${path}.${key}`, val);
  }
  return obj as CityGroceries;
}

function validateFood(path: string, v: unknown): CityFood {
  const obj = assertObject(path, v);
  if (!('restaurantMeal' in obj)) fail(`${path}.restaurantMeal`, 'missing required field');
  if (!('cafe' in obj)) fail(`${path}.cafe`, 'missing required field');
  if (!('groceries' in obj)) fail(`${path}.groceries`, 'missing required field');
  return {
    restaurantMeal: assertPositiveNumber(`${path}.restaurantMeal`, obj.restaurantMeal),
    cafe: assertPositiveNumber(`${path}.cafe`, obj.cafe),
    groceries: validateGroceries(`${path}.groceries`, obj.groceries),
  };
}

function validateTransport(path: string, v: unknown): CityTransport {
  const obj = assertObject(path, v);
  for (const key of ['monthlyPass', 'singleRide', 'taxiBase'] as const) {
    if (!(key in obj)) fail(`${path}.${key}`, 'missing required field');
  }
  return {
    monthlyPass: assertPositiveNumber(`${path}.monthlyPass`, obj.monthlyPass),
    singleRide: assertPositiveNumber(`${path}.singleRide`, obj.singleRide),
    taxiBase: assertPositiveNumber(`${path}.taxiBase`, obj.taxiBase),
  };
}

function validateTuitionEntry(path: string, v: unknown): CityTuitionEntry {
  const obj = assertObject(path, v);
  return {
    school: assertNonEmptyString(`${path}.school`, obj.school),
    level: assertEnum(`${path}.level`, obj.level, TUITION_LEVELS),
    annual: assertPositiveNumber(`${path}.annual`, obj.annual),
  };
}

function validateTaxEntry(path: string, v: unknown): CityTaxEntry {
  const obj = assertObject(path, v);
  const annualSalary = assertPositiveNumber(`${path}.annualSalary`, obj.annualSalary);
  const takeHome = obj.takeHomePctApprox;
  if (typeof takeHome !== 'number' || !Number.isFinite(takeHome)) {
    fail(`${path}.takeHomePctApprox`, `expected finite number, got ${typeof takeHome}`);
  }
  if (takeHome < 0 || takeHome > 1) {
    fail(`${path}.takeHomePctApprox`, `expected number in [0, 1], got ${takeHome}`);
  }
  return { annualSalary, takeHomePctApprox: takeHome };
}

function validateVisa(path: string, v: unknown): CityVisa {
  const obj = assertObject(path, v);
  const visa: CityVisa = {};
  if (obj.studentApplicationFee !== undefined) {
    visa.studentApplicationFee = assertPositiveNumber(
      `${path}.studentApplicationFee`,
      obj.studentApplicationFee,
    );
  }
  if (obj.workApplicationFee !== undefined) {
    visa.workApplicationFee = assertPositiveNumber(
      `${path}.workApplicationFee`,
      obj.workApplicationFee,
    );
  }
  if (obj.settlementApprox !== undefined) {
    visa.settlementApprox = assertPositiveNumber(`${path}.settlementApprox`, obj.settlementApprox);
  }
  return visa;
}

function validateSource(path: string, v: unknown): CitySource {
  const obj = assertObject(path, v);
  return {
    category: assertEnum(`${path}.category`, obj.category, SOURCE_CATEGORIES),
    name: assertNonEmptyString(`${path}.name`, obj.name),
    url: assertNonEmptyString(`${path}.url`, obj.url),
    accessedAt: assertIsoDate(`${path}.accessedAt`, obj.accessedAt),
  };
}

function validateName(path: string, v: unknown): { ko: string; en: string } {
  const obj = assertObject(path, v);
  return {
    ko: assertNonEmptyString(`${path}.ko`, obj.ko),
    en: assertNonEmptyString(`${path}.en`, obj.en),
  };
}

export function validateCity(input: unknown, ctxPath = 'city'): CityCostData {
  const obj = assertObject(ctxPath, input);

  const id = assertNonEmptyString(`${ctxPath}.id`, obj.id);
  if (!ID_RE.test(id)) {
    fail(`${ctxPath}.id`, `expected lowercase id matching /^[a-z][a-z0-9-]*$/, got '${id}'`);
  }

  const name = validateName(`${ctxPath}.name`, obj.name);

  const country = assertNonEmptyString(`${ctxPath}.country`, obj.country);
  if (!COUNTRY_RE.test(country)) {
    fail(`${ctxPath}.country`, `expected ISO 3166-1 alpha-2 (2 uppercase letters), got '${country}'`);
  }

  const currency = assertNonEmptyString(`${ctxPath}.currency`, obj.currency);
  if (!CURRENCY_RE.test(currency)) {
    fail(`${ctxPath}.currency`, `expected ISO 4217 (3 uppercase letters), got '${currency}'`);
  }

  const region = assertEnum(`${ctxPath}.region`, obj.region, REGIONS);
  const lastUpdated = assertIsoDate(`${ctxPath}.lastUpdated`, obj.lastUpdated);

  if (!('rent' in obj)) fail(`${ctxPath}.rent`, 'missing required field');
  const rent = validateRent(`${ctxPath}.rent`, obj.rent);

  if (!('food' in obj)) fail(`${ctxPath}.food`, 'missing required field');
  const food = validateFood(`${ctxPath}.food`, obj.food);

  if (!('transport' in obj)) fail(`${ctxPath}.transport`, 'missing required field');
  const transport = validateTransport(`${ctxPath}.transport`, obj.transport);

  if (!('sources' in obj)) fail(`${ctxPath}.sources`, 'missing required field');
  const sourcesArr = assertArray(`${ctxPath}.sources`, obj.sources);
  if (sourcesArr.length < 1) fail(`${ctxPath}.sources`, 'expected non-empty array');
  const sources = sourcesArr.map((s, i) => validateSource(`${ctxPath}.sources[${i}]`, s));

  const result: CityCostData = {
    id,
    name,
    country,
    currency,
    region,
    lastUpdated,
    rent,
    food,
    transport,
    sources,
  };

  if (obj.tuition !== undefined) {
    const arr = assertArray(`${ctxPath}.tuition`, obj.tuition);
    result.tuition = arr.map((e, i) => validateTuitionEntry(`${ctxPath}.tuition[${i}]`, e));
  }
  if (obj.tax !== undefined) {
    const arr = assertArray(`${ctxPath}.tax`, obj.tax);
    result.tax = arr.map((e, i) => validateTaxEntry(`${ctxPath}.tax[${i}]`, e));
  }
  if (obj.visa !== undefined) {
    result.visa = validateVisa(`${ctxPath}.visa`, obj.visa);
  }

  return result;
}

export function validateAllJson(input: unknown): AllCitiesData {
  const obj = assertObject('all.json', input);

  if (obj.schemaVersion !== 1) {
    fail(
      'all.json.schemaVersion',
      `expected schemaVersion === 1, got ${
        typeof obj.schemaVersion === 'number' ? obj.schemaVersion : typeof obj.schemaVersion
      }`,
    );
  }

  const generatedAt = assertIsoDateTime('all.json.generatedAt', obj.generatedAt);
  const fxBaseDate = assertIsoDate('all.json.fxBaseDate', obj.fxBaseDate);

  if (!('cities' in obj)) fail('all.json.cities', 'missing required field');
  const citiesObj = assertObject('all.json.cities', obj.cities);
  const cityKeys = Object.keys(citiesObj);
  if (cityKeys.length < 1) fail('all.json.cities', 'expected non-empty object (≥ 1 city)');

  const cities: Record<string, CityCostData> = {};
  for (const key of cityKeys) {
    cities[key] = validateCity(citiesObj[key], `all.json.cities['${key}']`);
  }

  return {
    schemaVersion: 1,
    generatedAt,
    fxBaseDate,
    cities,
  };
}

export function parseAllCitiesText(text: string): AllCitiesData {
  if (typeof text !== 'string' || text.length === 0) {
    throw new CityParseError('empty response body');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new CityParseError(
      `JSON.parse failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      cause,
    );
  }
  return validateAllJson(parsed);
}
