import { seoulValid } from '@/__fixtures__/cities/seoul-valid';
import { vancouverValid } from '@/__fixtures__/cities/vancouver-valid';

import { parseAllCitiesText, validateAllJson, validateCity } from '../citySchema';
import { CityParseError, CitySchemaError } from '../errors';

/**
 * 깊은 복제 — fixture 변형 시 다른 테스트 오염 방지.
 */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * 정상 batch (`all.json`) 객체 빌더. 검증 후 통과 가능.
 */
function buildAllJson(overrides?: { cities?: Record<string, unknown> }): unknown {
  return {
    schemaVersion: 1,
    generatedAt: '2026-04-28T00:00:00+09:00',
    fxBaseDate: '2026-04-01',
    cities: overrides?.cities ?? {
      seoul: clone(seoulValid),
      vancouver: clone(vancouverValid),
    },
  };
}

describe('validateCity — happy path', () => {
  it('서울 fixture 통과', () => {
    expect(() => validateCity(seoulValid)).not.toThrow();
  });

  it('밴쿠버 fixture (tuition + tax + visa 포함) 통과', () => {
    expect(() => validateCity(vancouverValid)).not.toThrow();
  });

  it('tuition / tax / visa 모두 누락해도 통과', () => {
    const v = clone(seoulValid);
    delete (v as { tuition?: unknown }).tuition;
    delete (v as { tax?: unknown }).tax;
    delete (v as { visa?: unknown }).visa;
    expect(() => validateCity(v)).not.toThrow();
  });

  it('tuition 빈 배열 허용', () => {
    const v = clone(vancouverValid);
    v.tuition = [];
    expect(() => validateCity(v)).not.toThrow();
  });

  it('tax 빈 배열 허용', () => {
    const v = clone(vancouverValid);
    v.tax = [];
    expect(() => validateCity(v)).not.toThrow();
  });

  it('groceries 추가 키 통과 + 무시', () => {
    const v = clone(seoulValid);
    (v.food.groceries as Record<string, number>).kimchi1kg = 10_000;
    expect(() => validateCity(v)).not.toThrow();
  });

  it('미지의 최상위 추가 필드 통과 + 무시', () => {
    const v = { ...clone(seoulValid), extra: 'foo', _meta: { ts: 1 } };
    expect(() => validateCity(v)).not.toThrow();
  });

  it('rent.deposit 미포함 허용', () => {
    const v = clone(seoulValid);
    delete (v.rent as { deposit?: number }).deposit;
    expect(() => validateCity(v)).not.toThrow();
  });

  it('rent 모든 카테고리 null 허용 (개별 도시 결측 정책)', () => {
    const v = clone(seoulValid);
    v.rent = { share: null, studio: null, oneBed: null, twoBed: null };
    expect(() => validateCity(v)).not.toThrow();
  });
});

describe('validateCity — 비-객체 입력', () => {
  it.each([null, undefined, 0, 'string', true, [], 42])('non-object 입력은 throws: %p', (v) => {
    expect(() => validateCity(v)).toThrow(CitySchemaError);
  });
});

describe('validateCity — 필수 필드 결측', () => {
  const requiredFields = [
    'id',
    'name',
    'country',
    'currency',
    'region',
    'lastUpdated',
    'rent',
    'food',
    'transport',
    'sources',
  ] as const;

  it.each(requiredFields)("'%s' 누락 시 CitySchemaError + 메시지에 필드명 포함", (field) => {
    const v = clone(seoulValid) as Record<string, unknown>;
    delete v[field];
    let caught: unknown;
    try {
      validateCity(v);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(CitySchemaError);
    expect((caught as CitySchemaError).code).toBe('CITY_SCHEMA_INVALID');
    expect((caught as CitySchemaError).message).toContain(field);
  });

  it('name.ko 누락 시 throws', () => {
    const v = clone(seoulValid);
    delete (v.name as { ko?: string }).ko;
    expect(() => validateCity(v)).toThrow(/name\.ko/);
  });

  it('name.en 누락 시 throws', () => {
    const v = clone(seoulValid);
    delete (v.name as { en?: string }).en;
    expect(() => validateCity(v)).toThrow(/name\.en/);
  });

  it('food.groceries 의 필수 키(milk1L) 누락 시 throws', () => {
    const v = clone(seoulValid);
    delete (v.food.groceries as { milk1L?: number }).milk1L;
    expect(() => validateCity(v)).toThrow(/milk1L/);
  });

  it('food.restaurantMeal 누락 시 throws', () => {
    const v = clone(seoulValid);
    delete (v.food as { restaurantMeal?: number }).restaurantMeal;
    expect(() => validateCity(v)).toThrow(/restaurantMeal/);
  });

  it('transport.monthlyPass 누락 시 throws', () => {
    const v = clone(seoulValid);
    delete (v.transport as { monthlyPass?: number }).monthlyPass;
    expect(() => validateCity(v)).toThrow(/monthlyPass/);
  });

  it('sources 빈 배열 시 throws', () => {
    const v = clone(seoulValid);
    v.sources = [];
    expect(() => validateCity(v)).toThrow(/sources/);
  });

  it('sources 원소의 필드 누락 시 throws', () => {
    const v = clone(seoulValid);
    (v.sources[0] as { url?: string }).url = '';
    expect(() => validateCity(v)).toThrow(/sources\[0\]\.url/);
  });
});

describe('validateCity — 타입 위반', () => {
  it("currency: 123 (number) → throws", () => {
    const v = clone(seoulValid) as unknown as { currency: unknown };
    v.currency = 123;
    expect(() => validateCity(v)).toThrow(CitySchemaError);
  });

  it("country: 'KOR' (3자리) → throws", () => {
    const v = clone(seoulValid);
    v.country = 'KOR';
    expect(() => validateCity(v)).toThrow(/country/);
  });

  it("currency: 'KRW2' (4자) → throws", () => {
    const v = clone(seoulValid);
    v.currency = 'KRW2';
    expect(() => validateCity(v)).toThrow(/currency/);
  });

  it("currency: ' cad ' (lowercase + spaces) → throws (자동 정규화 안 함)", () => {
    const v = clone(seoulValid);
    v.currency = ' cad ';
    expect(() => validateCity(v)).toThrow(/currency/);
  });

  it("country lowercase ('kr') → throws", () => {
    const v = clone(seoulValid);
    v.country = 'kr';
    expect(() => validateCity(v)).toThrow(/country/);
  });

  it("rent.oneBed: '2300' (문자열) → throws", () => {
    const v = clone(seoulValid) as unknown as { rent: { oneBed: unknown } };
    v.rent.oneBed = '2300';
    expect(() => validateCity(v)).toThrow(/oneBed/);
  });

  it('rent.share: -100 → throws', () => {
    const v = clone(seoulValid);
    v.rent.share = -100;
    expect(() => validateCity(v)).toThrow(/share/);
  });

  it("lastUpdated: '2026/04/01' (잘못된 구분자) → throws", () => {
    const v = clone(seoulValid);
    v.lastUpdated = '2026/04/01';
    expect(() => validateCity(v)).toThrow(/lastUpdated/);
  });

  it("region: 'antarctica' → throws", () => {
    const v = clone(seoulValid) as unknown as { region: unknown };
    v.region = 'antarctica';
    expect(() => validateCity(v)).toThrow(/region/);
  });

  it('food.restaurantMeal: 0 → throws (양수만)', () => {
    const v = clone(seoulValid);
    v.food.restaurantMeal = 0;
    expect(() => validateCity(v)).toThrow(/restaurantMeal/);
  });

  it('food.cafe: -1 → throws', () => {
    const v = clone(seoulValid);
    v.food.cafe = -1;
    expect(() => validateCity(v)).toThrow(/cafe/);
  });

  it('food.restaurantMeal: NaN → throws', () => {
    const v = clone(seoulValid);
    v.food.restaurantMeal = NaN;
    expect(() => validateCity(v)).toThrow(/restaurantMeal/);
  });

  it('food.restaurantMeal: Infinity → throws', () => {
    const v = clone(seoulValid);
    v.food.restaurantMeal = Infinity;
    expect(() => validateCity(v)).toThrow(/restaurantMeal/);
  });

  it('tax[0].takeHomePctApprox: 1.5 → throws (범위 위반)', () => {
    const v = clone(vancouverValid);
    v.tax![0]!.takeHomePctApprox = 1.5;
    expect(() => validateCity(v)).toThrow(/takeHomePctApprox/);
  });

  it('tax[0].takeHomePctApprox: -0.1 → throws', () => {
    const v = clone(vancouverValid);
    v.tax![0]!.takeHomePctApprox = -0.1;
    expect(() => validateCity(v)).toThrow(/takeHomePctApprox/);
  });

  it('tax[0].takeHomePctApprox: 0 / 1 경계값 통과', () => {
    const v = clone(vancouverValid);
    v.tax![0]!.takeHomePctApprox = 0;
    v.tax![1]!.takeHomePctApprox = 1;
    expect(() => validateCity(v)).not.toThrow();
  });

  it('tax[0].takeHomePctApprox: NaN → throws (finite number 아님)', () => {
    const v = clone(vancouverValid) as unknown as { tax: { takeHomePctApprox: unknown }[] };
    v.tax[0]!.takeHomePctApprox = Number.NaN;
    expect(() => validateCity(v as never)).toThrow(/takeHomePctApprox/);
  });

  it('tax[0].takeHomePctApprox: string → throws', () => {
    const v = clone(vancouverValid) as unknown as { tax: { takeHomePctApprox: unknown }[] };
    v.tax[0]!.takeHomePctApprox = '0.7';
    expect(() => validateCity(v as never)).toThrow(/takeHomePctApprox/);
  });

  it('sources: 객체 (배열 아님) → throws', () => {
    const v = clone(seoulValid) as unknown as { sources: unknown };
    v.sources = { not: 'array' };
    expect(() => validateCity(v as never)).toThrow(/sources/);
  });

  it('food.restaurantMeal: string → throws (typeof number 아님)', () => {
    const v = clone(seoulValid) as unknown as { food: { restaurantMeal: unknown } };
    v.food.restaurantMeal = '9000';
    expect(() => validateCity(v as never)).toThrow(/restaurantMeal/);
  });

  it('rent.share: string → throws (typeof number 아님)', () => {
    const v = clone(seoulValid) as unknown as { rent: { share: unknown } };
    v.rent.share = '500000';
    expect(() => validateCity(v as never)).toThrow(/share/);
  });

  it('rent.share: NaN → throws (finite 아님)', () => {
    const v = clone(seoulValid);
    v.rent.share = Number.NaN;
    expect(() => validateCity(v)).toThrow(/share/);
  });

  it('food: 누락 → throws', () => {
    const v = clone(seoulValid) as unknown as { food?: unknown };
    delete v.food;
    expect(() => validateCity(v as never)).toThrow(/food/);
  });

  it('food.cafe 누락 → throws', () => {
    const v = clone(seoulValid) as unknown as { food: { cafe?: number } };
    delete v.food.cafe;
    expect(() => validateCity(v as never)).toThrow(/cafe/);
  });

  it('food.groceries 누락 → throws', () => {
    const v = clone(seoulValid) as unknown as { food: { groceries?: unknown } };
    delete v.food.groceries;
    expect(() => validateCity(v as never)).toThrow(/groceries/);
  });

  it('groceries 추가 키 값이 string → throws', () => {
    const v = clone(seoulValid) as unknown as { food: { groceries: Record<string, unknown> } };
    v.food.groceries.kimchi1kg = 'cheap';
    expect(() => validateCity(v as never)).toThrow(/kimchi1kg/);
  });

  it('groceries 추가 키 값이 undefined → 통과 + 무시', () => {
    const v = clone(seoulValid) as unknown as { food: { groceries: Record<string, unknown> } };
    v.food.groceries.kimchi1kg = undefined;
    expect(() => validateCity(v as never)).not.toThrow();
  });

  it('visa.workApplicationFee: -1 → throws', () => {
    const v = clone(vancouverValid);
    v.visa!.workApplicationFee = -1;
    expect(() => validateCity(v)).toThrow(/workApplicationFee/);
  });

  it('visa.settlementApprox: 0 → throws (양수만)', () => {
    const v = clone(vancouverValid);
    v.visa!.settlementApprox = 0;
    expect(() => validateCity(v)).toThrow(/settlementApprox/);
  });

  it('parseAllCitiesText: JSON.parse 실패 (Error 아닌 cause)', () => {
    // 실 시나리오에서는 JSON.parse 가 SyntaxError 를 throw 하지만,
    // 본 테스트는 cause 가 Error 인 경로를 검증.
    expect(() => parseAllCitiesText('{not json')).toThrow(/JSON/);
  });

  it("tuition[0].level: 'phd' (잘못된 enum) → throws", () => {
    const v = clone(vancouverValid) as unknown as { tuition: { level: unknown }[] };
    v.tuition[0]!.level = 'phd';
    expect(() => validateCity(v)).toThrow(/level/);
  });

  it("sources[0].category: 'food' 외 잘못된 enum → throws", () => {
    const v = clone(seoulValid) as unknown as { sources: { category: unknown }[] };
    v.sources[0]!.category = 'parking';
    expect(() => validateCity(v)).toThrow(/sources\[0\]\.category/);
  });

  it("sources[0].accessedAt: '2026-13-01' (잘못된 ISO) — 패턴만 검증하므로 통과 (런타임 검증은 정책 외)", () => {
    // ISO_DATE_RE 는 형식 (YYYY-MM-DD) 만 검증. 의미적 유효성은 별도.
    // 잘못된 형식만 throws.
    const v = clone(seoulValid);
    v.sources[0]!.accessedAt = '2026-04-1';
    expect(() => validateCity(v)).toThrow(/accessedAt/);
  });

  it('id 가 영문 소문자 + 하이픈 외 (대문자) → throws', () => {
    const v = clone(seoulValid);
    v.id = 'Seoul';
    expect(() => validateCity(v)).toThrow(/id/);
  });

  it('id 가 숫자로 시작 → throws', () => {
    const v = clone(seoulValid);
    v.id = '1seoul';
    expect(() => validateCity(v)).toThrow(/id/);
  });

  it('rent (배열) → throws (객체 기대)', () => {
    const v = clone(seoulValid) as unknown as { rent: unknown };
    v.rent = [];
    expect(() => validateCity(v)).toThrow(/rent/);
  });

  it('groceries 추가 키가 양수가 아니면 throws', () => {
    const v = clone(seoulValid);
    (v.food.groceries as Record<string, unknown>).custom = -5;
    expect(() => validateCity(v)).toThrow(/groceries\.custom/);
  });
});

describe('validateAllJson — happy path', () => {
  it('정상 batch 통과', () => {
    expect(() => validateAllJson(buildAllJson())).not.toThrow();
  });

  it('미지의 최상위 추가 필드 통과 + 무시', () => {
    const all = buildAllJson() as Record<string, unknown>;
    all.extra = 'foo';
    expect(() => validateAllJson(all)).not.toThrow();
  });

  it('cities 한 개만 있어도 통과', () => {
    const all = buildAllJson({ cities: { seoul: clone(seoulValid) } });
    const result = validateAllJson(all);
    expect(Object.keys(result.cities)).toEqual(['seoul']);
  });
});

describe('validateAllJson — 위반', () => {
  it('schemaVersion: 2 → throws (메시지에 schemaVersion 포함)', () => {
    const all = buildAllJson() as Record<string, unknown>;
    all.schemaVersion = 2;
    expect(() => validateAllJson(all)).toThrow(/schemaVersion/);
  });

  it('schemaVersion: 누락 → throws', () => {
    const all = buildAllJson() as Record<string, unknown>;
    delete all.schemaVersion;
    expect(() => validateAllJson(all)).toThrow(/schemaVersion/);
  });

  it('schemaVersion: 문자열 → throws', () => {
    const all = buildAllJson() as Record<string, unknown>;
    all.schemaVersion = '1';
    expect(() => validateAllJson(all)).toThrow(/schemaVersion/);
  });

  it('cities: {} → throws (≥ 1)', () => {
    const all = buildAllJson({ cities: {} });
    expect(() => validateAllJson(all)).toThrow(/cities/);
  });

  it('cities 누락 → throws', () => {
    const all = buildAllJson() as Record<string, unknown>;
    delete all.cities;
    expect(() => validateAllJson(all)).toThrow(/cities/);
  });

  it('cities.seoul.currency 위반 → throws (메시지에 seoul + currency 포함)', () => {
    const seoul = clone(seoulValid);
    seoul.currency = 'KRW2';
    const all = buildAllJson({ cities: { seoul, vancouver: clone(vancouverValid) } });
    let caught: unknown;
    try {
      validateAllJson(all);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(CitySchemaError);
    const msg = (caught as CitySchemaError).message;
    expect(msg).toContain("'seoul'");
    expect(msg).toContain('currency');
  });

  it('generatedAt: 잘못된 ISO datetime → throws', () => {
    const all = buildAllJson() as Record<string, unknown>;
    all.generatedAt = '2026-04-28';
    expect(() => validateAllJson(all)).toThrow(/generatedAt/);
  });

  it('fxBaseDate: 잘못된 ISO date → throws', () => {
    const all = buildAllJson() as Record<string, unknown>;
    all.fxBaseDate = '2026/04/01';
    expect(() => validateAllJson(all)).toThrow(/fxBaseDate/);
  });

  it('non-object 입력 → throws', () => {
    expect(() => validateAllJson(null)).toThrow(CitySchemaError);
    expect(() => validateAllJson('string')).toThrow(CitySchemaError);
    expect(() => validateAllJson([])).toThrow(CitySchemaError);
  });
});

describe('parseAllCitiesText', () => {
  it('정상 JSON 통과', () => {
    const text = JSON.stringify(buildAllJson());
    const result = parseAllCitiesText(text);
    expect(result.schemaVersion).toBe(1);
    expect(Object.keys(result.cities)).toEqual(['seoul', 'vancouver']);
  });

  it("깨진 JSON ('{not json') → CityParseError", () => {
    let caught: unknown;
    try {
      parseAllCitiesText('{not json');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(CityParseError);
    expect((caught as CityParseError).code).toBe('CITY_PARSE_FAILED');
  });

  it('빈 문자열 → CityParseError', () => {
    expect(() => parseAllCitiesText('')).toThrow(CityParseError);
  });

  it("HTML 응답 ('<!DOCTYPE html>') → CityParseError", () => {
    expect(() => parseAllCitiesText('<!DOCTYPE html><html><body>404</body></html>')).toThrow(
      CityParseError,
    );
  });

  it('JSON.parse 성공했지만 schema 위반 시 CitySchemaError (CityParseError 아님)', () => {
    const text = JSON.stringify({ schemaVersion: 2, cities: {} });
    expect(() => parseAllCitiesText(text)).toThrow(CitySchemaError);
  });

  it('CityParseError 의 cause 가 원본 SyntaxError 보존', () => {
    let caught: unknown;
    try {
      parseAllCitiesText('{not json');
    } catch (e) {
      caught = e;
    }
    expect((caught as CityParseError).cause).toBeInstanceOf(SyntaxError);
  });
});
