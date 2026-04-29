import {
  AllCitiesUnavailableError,
  AppError,
  CityFetchError,
  CityNotFoundError,
  CityParseError,
  CitySchemaError,
  CityTimeoutError,
  FavoritesLimitError,
  FxFetchError,
  FxParseError,
  FxTimeoutError,
  InvalidAmountError,
  InvalidMultiplierError,
  InvalidNumberError,
  InvariantError,
  UnknownCurrencyError,
} from '../errors';

type ErrorCtor = new (msg: string, cause?: unknown) => AppError;

const errorCases: Array<[ErrorCtor, string]> = [
  [InvalidNumberError, 'INVALID_NUMBER'],
  [InvalidMultiplierError, 'INVALID_MULTIPLIER'],
  [InvalidAmountError, 'INVALID_AMOUNT'],
  [UnknownCurrencyError, 'UNKNOWN_CURRENCY'],
  [FxFetchError, 'FX_FETCH_FAILED'],
  [FxParseError, 'FX_PARSE_FAILED'],
  [FxTimeoutError, 'FX_TIMEOUT'],
  [CityParseError, 'CITY_PARSE_FAILED'],
  [CitySchemaError, 'CITY_SCHEMA_INVALID'],
  [CityNotFoundError, 'CITY_NOT_FOUND'],
  [CityFetchError, 'CITY_FETCH_FAILED'],
  [CityTimeoutError, 'CITY_TIMEOUT'],
  [AllCitiesUnavailableError, 'ALL_CITIES_UNAVAILABLE'],
  [FavoritesLimitError, 'FAVORITES_LIMIT'],
  [InvariantError, 'INVARIANT'],
];

describe('errors 카탈로그 (15 클래스)', () => {
  it('카탈로그 길이가 정확히 15개', () => {
    expect(errorCases).toHaveLength(15);
  });

  describe.each(errorCases)('%p', (Ctor, expectedCode) => {
    it('AppError + Error 모두 상속', () => {
      const e = new Ctor('test');
      expect(e).toBeInstanceOf(AppError);
      expect(e).toBeInstanceOf(Error);
    });

    it('code 가 카탈로그 값과 정확히 일치', () => {
      expect(new Ctor('test').code).toBe(expectedCode);
    });

    it('message 가 생성자 인자로 전달한 값 그대로', () => {
      expect(new Ctor('hello world').message).toBe('hello world');
    });

    it('name 이 클래스 이름과 일치', () => {
      expect(new Ctor('test').name).toBe(Ctor.name);
    });

    it('cause 옵션 보존', () => {
      const cause = new Error('underlying failure');
      const e = new Ctor('outer', cause);
      expect(e.cause).toBe(cause);
    });

    it('cause 미전달 시 undefined', () => {
      expect(new Ctor('test').cause).toBeUndefined();
    });

    it('toJSON 직렬화에 name + code + message 포함', () => {
      const e = new Ctor('msg-payload');
      const json = JSON.parse(JSON.stringify(e)) as {
        name: string;
        code: string;
        message: string;
      };
      expect(json.code).toBe(expectedCode);
      expect(json.message).toBe('msg-payload');
      expect(json.name).toBe(Ctor.name);
    });
  });
});
