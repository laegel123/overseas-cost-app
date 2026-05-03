/**
 * 결정적 에러 타입 카탈로그.
 * docs/ARCHITECTURE.md §에러 타입 카탈로그 와 1:1 일치 (19개 클래스).
 *
 * 모든 lib 함수는 본 카탈로그의 클래스만 throw 한다.
 * 외부 라이브러리 에러를 잡으면 wrap 후 카탈로그 클래스로 다시 throw.
 */

export abstract class AppError extends Error {
  abstract readonly code: string;

  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }

  toJSON(): { name: string; code: string; message: string } {
    return { name: this.name, code: this.code, message: this.message };
  }
}

export class InvalidNumberError extends AppError {
  readonly code = 'INVALID_NUMBER';
}

export class InvalidMultiplierError extends AppError {
  readonly code = 'INVALID_MULTIPLIER';
}

export class InvalidAmountError extends AppError {
  readonly code = 'INVALID_AMOUNT';
}

export class UnknownCurrencyError extends AppError {
  readonly code = 'UNKNOWN_CURRENCY';
}

export class FxFetchError extends AppError {
  readonly code = 'FX_FETCH_FAILED';
}

export class FxParseError extends AppError {
  readonly code = 'FX_PARSE_FAILED';
}

export class FxTimeoutError extends AppError {
  readonly code = 'FX_TIMEOUT';
}

export class CityParseError extends AppError {
  readonly code = 'CITY_PARSE_FAILED';
}

export class CitySchemaError extends AppError {
  readonly code = 'CITY_SCHEMA_INVALID';
}

export class CityNotFoundError extends AppError {
  readonly code = 'CITY_NOT_FOUND';
}

export class CityFetchError extends AppError {
  readonly code = 'CITY_FETCH_FAILED';
}

export class CityTimeoutError extends AppError {
  readonly code = 'CITY_TIMEOUT';
}

export class AllCitiesUnavailableError extends AppError {
  readonly code = 'ALL_CITIES_UNAVAILABLE';
}

export class FavoritesLimitError extends AppError {
  readonly code = 'FAVORITES_LIMIT';
}

export class InvariantError extends AppError {
  readonly code = 'INVARIANT';
}

// --- data-automation phase 에러 (step 0) ---
//
// 아래 4 클래스는 `scripts/refresh/_common.mjs` 의 plain-Error factory (createFetchRetryExhaustedError 등)
// 가 던지는 에러의 **타입 카탈로그** 역할. .mjs 스크립트는 직접 `new FetchRetryExhaustedError(...)` 를
// 사용하지 않고 factory 가 `{ name, code }` 를 수동 부여한 plain Error 를 throw 한다 (ESM/CJS 경계 회피).
// 앱 레이어 (`src/lib/data.ts` 등) 가 향후 cron 결과를 통신·표시할 때 `instanceof` 체크용으로 사용 예정.
// 현재 앱 레이어 import 0 곳 — v1.x data-automation 결과 노출 phase 에서 채택.

export class FetchRetryExhaustedError extends AppError {
  readonly code = 'FETCH_RETRY_EXHAUSTED';
}

export class FetchTimeoutError extends AppError {
  readonly code = 'FETCH_TIMEOUT';
}

export class MissingApiKeyError extends AppError {
  readonly code = 'MISSING_API_KEY';
}

export class InvalidCityIdError extends AppError {
  readonly code = 'INVALID_CITY_ID';
}
