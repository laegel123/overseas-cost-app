/**
 * 도시 비용 데이터 타입.
 * docs/DATA.md §2 의 v1.0 정식 스키마와 1:1 일치.
 */

export type Persona = 'student' | 'worker' | 'unknown';

export type Region = 'na' | 'eu' | 'asia' | 'oceania' | 'me';

export type TuitionLevel = 'undergrad' | 'graduate' | 'language';

export type SourceCategory = 'rent' | 'food' | 'transport' | 'tuition' | 'tax' | 'visa';

export type CityRent = {
  share: number | null;
  studio: number | null;
  oneBed: number | null;
  twoBed: number | null;
  deposit?: number;
};

export type CityGroceries = {
  milk1L: number;
  eggs12: number;
  rice1kg: number;
  chicken1kg: number;
  bread: number;
  onion1kg?: number;
  apple1kg?: number;
  ramen?: number;
  [key: string]: number | undefined;
};

export type CityFood = {
  restaurantMeal: number;
  cafe: number;
  groceries: CityGroceries;
};

export type CityTransport = {
  monthlyPass: number;
  singleRide: number;
  taxiBase: number;
};

export type CityTuitionEntry = {
  school: string;
  level: TuitionLevel;
  annual: number;
};

export type CityTaxEntry = {
  annualSalary: number;
  takeHomePctApprox: number;
};

export type CityVisa = {
  studentApplicationFee?: number;
  workApplicationFee?: number;
  settlementApprox?: number;
};

export type CitySource = {
  category: SourceCategory;
  name: string;
  url: string;
  accessedAt: string;
};

export type CityCostData = {
  id: string;
  name: { ko: string; en: string };
  country: string;
  currency: string;
  region: Region;
  lastUpdated: string;
  rent: CityRent;
  food: CityFood;
  transport: CityTransport;
  tuition?: CityTuitionEntry[];
  tax?: CityTaxEntry[];
  visa?: CityVisa;
  sources: CitySource[];
};

/**
 * data.ts 가 메모리에 들고 있는 도시 맵.
 * `noUncheckedIndexedAccess` 가 켜져 있어 인덱스 접근 시 `| undefined`.
 */
export type CitiesMap = Record<string, CityCostData>;

/**
 * data.ts 가 fetch 하는 batch 파일 형식 (DATA.md §6.1).
 */
export type AllCitiesData = {
  schemaVersion: 1;
  generatedAt: string;
  fxBaseDate: string;
  cities: CitiesMap;
};

/**
 * 환율 테이블. 키: ISO 4217 alpha-3 통화 코드.
 * 값: 1 단위당 KRW 환산값 (예: { CAD: 980, JPY: 9.0 }).
 */
export type ExchangeRates = Record<string, number>;
