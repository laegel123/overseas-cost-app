# 데이터 정책·스키마·운영

해외 생활비 비교 앱이 의존하는 모든 외부 데이터(도시 비용, 환율) 의 출처·스키마·갱신 절차·검증 방법을 한 곳에 모은 단일 출처. 새 도시 추가·항목 추가·출처 교체는 본 문서를 먼저 갱신하고 진행한다.

## 1. 데이터 종류

| 종류                            | 위치                                          | 갱신 주기             | 책임                |
| ------------------------------- | --------------------------------------------- | --------------------- | ------------------- |
| 도시 비용 데이터                | `data/cities/<id>.json` (호스팅: GitHub raw)  | 분기 1회 (3·6·9·12월) | 수동 큐레이션 (1인) |
| 시드 데이터 (오프라인 fallback) | `data/seed/{seoul, vancouver}.json` (앱 번들) | 도시 데이터와 동기    | 동일                |
| 환율                            | `open.er-api.com`                             | 일 1회 fetch          | 자동                |
| 출처 색인                       | `data/sources.md`                             | 데이터 갱신 시 동시   | 동일                |

## 2. 도시 비용 데이터 스키마

PRD §8.7 의 초안을 v1.0 정식 스키마로 고정.

```ts
// src/types/city.ts
export type CityCostData = {
  id: string; // 'vancouver'
  name: { ko: string; en: string };
  country: string; // 'CA' (ISO 3166-1 alpha-2)
  currency: string; // 'CAD' (ISO 4217)
  region: 'na' | 'eu' | 'asia' | 'oceania' | 'me';
  lastUpdated: string; // ISO date '2026-04-01'
  rent: {
    share: number | null; // 월세 (현지통화)
    studio: number | null;
    oneBed: number | null;
    twoBed: number | null;
    deposit?: number; // 보증금 (선택)
  };
  food: {
    restaurantMeal: number; // 식당 한 끼 평균
    cafe: number; // 카페 한 잔
    groceries: {
      milk1L: number;
      eggs12: number;
      rice1kg: number;
      chicken1kg: number;
      bread: number;
      onion1kg?: number;
      apple1kg?: number;
      ramen?: number; // 신라면 1봉 (한국식)
      [key: string]: number | undefined;
    };
  };
  transport: {
    monthlyPass: number;
    singleRide: number;
    taxiBase: number;
  };
  tuition?: Array<{
    school: string; // 'UBC'
    level: 'undergrad' | 'graduate' | 'language';
    annual: number; // 연간 학비
  }>;
  tax?: Array<{
    annualSalary: number; // 연봉 기준값 (현지통화)
    takeHomePctApprox: number; // 0.0~1.0 (실수령률)
  }>;
  visa?: {
    studentApplicationFee?: number;
    workApplicationFee?: number;
    settlementApprox?: number;
  };
  sources: Array<{
    category: 'rent' | 'food' | 'transport' | 'tuition' | 'tax' | 'visa';
    name: string; // 'Statistics Canada'
    url: string;
    accessedAt: string; // ISO date
  }>;
};
```

검증 함수: `src/lib/data.ts` 의 `validateCity(json): CityCostData`. 스키마 위반 시 throws (테스트 인벤토리 §7.4 참조).

검증 스크립트: `scripts/validate_cities.mjs` 가 `data/{seed,cities}/*.json` 모두 검사. CI 도입 전까지 매 데이터 PR 에서 수동 실행.

## 3. 출처 정책

### 3.1 사용 가능한 출처 (예시)

| 권역   | 출처                                      | 데이터                      |
| ------ | ----------------------------------------- | --------------------------- |
| 한국   | 통계청 KOSIS                              | 식료품 평균 가격, 임차 시세 |
| 한국   | 부동산플랫폼 (직방·다방 공개 통계)        | 원룸·셰어 시세              |
| 캐나다 | Statistics Canada                         | CPI, 물가                   |
| 캐나다 | Kijiji 평균                               | 단기 월세 시세              |
| 미국   | US BLS CPI                                | 물가                        |
| 미국   | Zillow                                    | 월세                        |
| 영국   | Office for National Statistics            | 물가                        |
| 일본   | SUUMO, e-Stat                             | 부동산·통계                 |
| 호주   | ABS                                       | 통계                        |
| 학비   | 각 대학 공식 international tuition 페이지 | 연간 학비                   |
| 비자   | 각국 정부 이민·외교부 페이지              | 신청비, 처리기간            |
| 환율   | open.er-api.com                           | 무료 환율                   |

### 3.2 사용 금지 출처 (CRITICAL)

| 출처                         | 이유                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| Numbeo                       | 약관상 데이터 재배포 금지. 참고는 OK. 우리 DB로 옮기지 않는다. |
| Expatistan                   | 동일                                                           |
| Mercer Cost of Living Survey | 유료, 라이선스 필요                                            |

이 출처들의 값을 우리 JSON 에 옮기는 행위는 ADR-005 위반. PR 에서 즉시 reject.

### 3.3 출처 표기

모든 데이터 포인트는 `sources` 배열에 카테고리별 출처 1개 이상 명시. 사용자에게 보이는 비교 화면 푸터에 `출처 N개` 카운트 + "출처 보기" 링크. 출처 없는 데이터는 추가하지 않는다.

## 4. 데이터 큐레이션 절차

분기 갱신 워크플로우:

1. **사전 준비**
   - 갱신 대상 도시 목록 (v1.0 = 21개 = 서울 + 20)
   - 환율 기준일 결정 (보통 분기 시작일)

2. **수집** (per city)
   - `data/sources.md` 의 도시 섹션에서 각 카테고리 출처 URL 확인
   - 출처 페이지 접속 → 값 추출 (수동, 또는 가능 시 스크립트)
   - 단위 통일: 모든 값은 현지통화 (서울 = KRW). 환율 변환은 앱이 처리.
   - 평균/중간값 정책: 월세는 도시 시내 기준 평균(메디안 가능 시 메디안). 식비는 평균.

3. **JSON 작성**
   - `data/cities/<id>.json` 새 분기로 덮어쓰기
   - `lastUpdated` 갱신
   - `sources[*].accessedAt` 갱신

4. **검증**

   ```bash
   node scripts/validate_cities.mjs
   ```

   - 스키마 통과
   - 직전 분기 대비 값 변동 ≤ 30% (이상 시 출처 재확인)

5. **시드 동기화**
   - `data/seed/seoul.json`, `data/seed/vancouver.json` 도 동일 분기로 업데이트

6. **commit + push**
   - `data: Q2 2026 cost update for 20 cities`
   - GitHub raw URL 로 호스팅됨 → 사용자 앱이 24h 내 자동 fetch

7. **`sources.md` 갱신**
   - 새 출처 추가/제거 시 색인 업데이트

## 5. 환율 운영

### 5.1 Fallback chain (3단계)

ADR-026 에 따라 3단계 fallback. 1차 실패 시 자동으로 다음 단계 시도. 모두 실패 시 stale 캐시 + 경고 배지.

| 우선순위   | 출처            | URL                                                                                                                     | 키     | 갱신                  |
| ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------------- | ------ | --------------------- |
| 1차        | open.er-api.com | `https://open.er-api.com/v6/latest/USD`                                                                                 | 불필요 | 일 1회                |
| 2차        | ECB (Euro 기반) | `https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html` (XML/JSON) | 불필요 | EUR base → KRW 환산   |
| 3차 (수동) | 한국은행 환율   | `https://www.bok.or.kr/portal/main/main.do`                                                                             | 수동   | 분기 갱신 시 하드코딩 |

- 1차 / 2차 자동 시도, 3차는 코드에 분기별 fallback 값 하드코딩 (마지막 안전망).
- 캐시: AsyncStorage 키 `fx:v1`, 24h TTL.
- 실패 처리: stale 캐시 + 상단 경고 배지. 캐시도 없으면 3차 fallback → 그래도 실패시 변환 불가 → "?" 표기.

### 5.2 통화 정규화 (currency.ts)

- 입력 통화 코드: `.toUpperCase().trim()` 정규화 후 처리
- ISO 4217 검증: 알파벳 3자리만 허용
- 미지의 통화: `UnknownCurrencyError` throws (silent fail 금지)

### 5.3 환율과 데이터 신선도 충돌

- 도시 데이터는 분기 1회 (현지통화 저장) / 환율은 일 1회 갱신
- 사용자가 보는 KRW 값은 **fetch 시점 환율 × 도시 분기 데이터** 의 곱
- 환율 변동 시 비교 화면의 KRW 값이 일별로 변할 수 있음 — 이는 의도된 동작 (현실 반영)
- 표시: Compare 헤더에 `1 CAD = 980원 · 04-27` 처럼 환율 + 기준일 항상 노출

### 5.4 모니터링

- 운영자가 분기마다 1회 응답 shape 확인 (스키마 변경 감지)
- 실패율 > 5% 시 fallback 출처 검토

## 6. 데이터 호스팅 · Fetch 전략

### 6.1 단일 batch 파일 전략 (ADR-031)

**v1.0 = 단일 `all.json` batch fetch**. 21개 도시(서울 + 20) + 메타데이터를 1개 파일로 호스팅. 사용자 앱은 1번의 fetch 로 모든 비교 데이터를 확보한다.

```
저장소 구조:
data/
├── cities/                  # 큐레이터 편집용 — 도시별 개별 JSON
│   ├── seoul.json
│   ├── vancouver.json
│   └── ... (21개)
├── all.json                 # build 산출물 — 21개 도시 + 메타 합본 (런타임 fetch 대상)
└── seed/
    └── all.json             # 앱 번들 시드 (오프라인 fallback, all.json 과 동일 형식)
```

`all.json` 스키마:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-04-28T00:00:00+09:00",
  "fxBaseDate": "2026-04-01",
  "cities": {
    "seoul": { ... CityCostData },
    "vancouver": { ... CityCostData },
    "toronto": { ... CityCostData },
    ...
  }
}
```

### 6.2 Build script (분기 갱신 시 자동)

`scripts/build_data.mjs`:

1. `data/cities/*.json` 모두 읽음
2. 각각 `validateCity` 통과 검증
3. `data/all.json` + `data/seed/all.json` 동시 생성
4. (선택) gzip 압축 미리 생성 (`data/all.json.gz`)

큐레이터 워크플로우:

1. `data/cities/<id>.json` 편집
2. `npm run build:data` → `all.json` + `seed/all.json` 자동 갱신
3. 검증 (`npm run validate:data`)
4. commit + push

### 6.3 Primary 호스팅: GitHub Raw

- URL: `https://raw.githubusercontent.com/<user>/<repo>/main/data/all.json`
- baseURL 환경 변수: `EXPO_PUBLIC_DATA_BASE_URL`
- 무료, 변경 즉시 반영 (사용자는 24h 캐시 만료 후 자동 fetch)

### 6.4 Backup 호스팅: jsDelivr CDN

- 자동 미러: `https://cdn.jsdelivr.net/gh/<user>/<repo>@main/data/all.json`
- GitHub raw 다운 시 자동 fallback
- 무료, 자동 미러링 (24h 이내)

### 6.5 Fallback chain (`src/lib/data.ts`)

```
loadCityData():
  1. 캐시 hit (24h 이내) → 반환 (네트워크 호출 없음)
  2. 캐시 miss → primary URL fetch (GitHub raw)
  3. primary 실패 → backup URL fetch (jsDelivr)
  4. backup 실패 → 시드 (assets/data/seed/all.json) 사용 + 경고 배지
  5. 시드도 손상 → throws CitiesUnavailableError (앱 ErrorView)
```

### 6.6 캐시 키

| 키              | 내용                                                   | TTL  |
| --------------- | ------------------------------------------------------ | ---- |
| `data:all:v1`   | 도시 batch 데이터 (`all.json` 통째 — 21개 도시 + 메타) | 24h  |
| `fx:v1`         | 환율 (open.er-api.com 응답)                            | 24h  |
| `meta:lastSync` | 마지막 성공 fetch 시각 (settings 표시용)               | 영구 |

스키마 변경 시: `data:all:v2` 새 키 + 구 키 정리 (ADR-022).

### 6.7 Fetch 시점

| 시점                          | 동작                                                                     |
| ----------------------------- | ------------------------------------------------------------------------ |
| 앱 콜드스타트                 | hydration → 캐시 검사 → stale 시 백그라운드 fetch (UI 는 캐시 즉시 표시) |
| 사용자 수동 새로고침 (설정)   | 캐시 무시 → 강제 refetch                                                 |
| 백그라운드 → 포그라운드 복귀  | 캐시 stale 시 백그라운드 fetch                                           |
| 화면 진입 (홈/Compare/Detail) | 별도 fetch 없음 — 메모리에서 즉시 반환                                   |

**핵심**: UI 가 fetch 를 기다리지 않는다. 캐시·시드 우선 표시 → 백그라운드 갱신 → 데이터 변경 시 reactive 갱신.

### 6.8 환율은 별도

- 도시 batch 와 다른 갱신 주기 (도시 분기, 환율 일별)
- 별도 fetch (`fetchExchangeRates()`), 별도 캐시 키 (`fx:v1`)
- 도시 batch 가 hit 이고 환율이 stale 이면 환율만 갱신

### 6.9 Size 예산

| 항목                     | raw        | gzipped    |
| ------------------------ | ---------- | ---------- |
| 도시 1개 평균            | 3~7 KB     | 1~2 KB     |
| 21개 합본 (`all.json`)   | 100~150 KB | 30~40 KB   |
| 환율 응답                | ~5 KB      | ~2 KB      |
| **사용자 일일 다운로드** | ~155 KB    | **~42 KB** |

4G 환경에서 < 1초. 무선 데이터 부담 무시 가능 수준.

### 6.10 트래픽·비용

- GitHub raw rate limit: 인증 없이 60/시간 per IP (사용자 디바이스 기준 — 우리 서버 X)
- 사용자 1인 일 1회 fetch → 1만 사용자 = 일 1만 요청 (분산 IP, rate limit 무관)
- jsDelivr: 무료, rate limit 사실상 없음

## 7. 데이터 검증·품질 게이트

CI 도입 전까지 수동 게이트:

- [ ] `scripts/validate_cities.mjs` 통과
- [ ] 모든 도시의 필수 카테고리(rent/food/transport) 비어 있지 않음
- [ ] 모든 데이터 포인트에 sources 매핑 존재
- [ ] 환율 변환 후 합계가 비현실적이지 않음 (예: 도쿄 월 식비가 1만원 미만 → 단위 오류 의심)
- [ ] `lastUpdated` 가 분기 시작일 이후
- [ ] 시드 데이터(seoul/vancouver)와 cities 데이터 일치

## 8. 사용자 신고 흐름 (v1.1 이후)

v1.0 은 항목별 신고 없음(ADR-010). v1.1:

- Compare/Detail 카드 우상단 🚩 버튼
- 탭 → mailto 또는 인앱 폼: `cityId`, `category`, `currentValue`, `userSuggestion`, `optionalSource`
- 운영자가 분기 갱신 시 신고 사항 검토 + 반영

## 9. 데이터 라이선스·개인정보

- 우리가 큐레이션한 JSON 의 라이선스: **MIT** 또는 **CC-BY 4.0** (출시 전 결정 필요 — 별도 ADR)
- 출처는 각 출처 라이선스 명시 (sources 배열의 url 로 추적 가능)
- 사용자 개인정보 수집 0건 (계정·로그인 없음, 분석 도구 없음 — ADR-009/011)

## 10. 갱신 이력 (changelog)

| 분기    | 일자   | 변경             |
| ------- | ------ | ---------------- |
| Q2 2026 | (예정) | v1.0 초기 데이터 |

분기마다 본 표에 한 줄 추가.

---

## 11. 데이터 정의 표준

각 데이터 포인트가 정확히 무엇인지 정의. **모든 도시에 동일 적용**. 도시별 구체 출처는 `docs/DATA_SOURCES.md` 참조.

### 11.1 월세

- 모든 필드: 메디안 사용 (평균은 outlier 영향 큼)
- 시내 기준 (도시 중심 5km 반경 내)
- 1년 lease, 가구 미포함 default (`share` 만 가구 포함 허용)
- 단기 임대(<6개월), 호스텔, Airbnb 제외
- 통화: 현지 통화

### 11.2 식비 외식

- restaurantMeal: 평일 점심 정식 1인. 음료 별도. 일반 식당 (한식·로컬 우선). 패스트푸드·고급 X.
- cafe: 스타벅스 grande latte (350ml) 1순위. 없으면 동등 로컬 체인 명시.

### 11.3 식재료 (8개 표준)

- 일반 슈퍼마켓 (PB 아닌 일반 브랜드)
- 정상가 (세일가 X)
- 유기농·자유방목·글루텐프리 X
- ramen 만 한인 식료품점 허용

| 항목       | 정확한 정의                              |
| ---------- | ---------------------------------------- |
| milk1L     | 일반 우유 1L (UHT 또는 fresh, 일반 지방) |
| eggs12     | 갈색 또는 흰색 일반 12개                 |
| rice1kg    | 일반 백미 1kg (특수미 제외)              |
| chicken1kg | 닭가슴살 또는 통닭 1kg                   |
| bread      | 식빵 1봉 (400~600g, 일반 흰 빵)          |
| onion1kg   | 일반 양파 1kg                            |
| apple1kg   | 일반 사과 1kg (Fuji 또는 동등)           |
| ramen      | 신라면 1봉 (120g)                        |

### 11.4 교통

- monthlyPass: 성인 1존 또는 시내 기본 zone. 학생·노인 할인 X.
- singleRide: 교통카드/동등 (현금가 X). 기본 구간.
- taxiBase: 일반 택시 기본요금 (Uber/Lyft 별도). 주간.

### 11.5 학비

- 국제학생 기준 (한국인 타겟)
- 메인 학과 (Arts/Engineering 평균)
- 등록금만 (책값·기숙사·생활비 제외)
- 연 단위 (학기 단위는 ×2)

### 11.6 세금/실수령

- 단신 기준 (부양가족 공제 X)
- 도시 단위 (provincial/state tax 포함)
- 단순화한 추정치 — 실제는 deductions 으로 변동
- 출처: 각국 공식 calculator 또는 EY/PwC

### 11.7 비자

- studentApplicationFee: 정부 공식 신청 수수료
- workApplicationFee: 한국인 적용 카테고리 (워홀 협정국가)
- settlementApprox: 비자료 + 건강검진 + 편도 항공권 추정. 가정을 sources 에 명시.

---

## 12. 추출 방법론

### 12.1 자동화 정책 (v1.0 부터)

- **v1.0: 공공 출처 100% 자동화** (ADR-031, ADR-032). 수동 큐레이션 금지.
- 인프라: GitHub Actions cron + `scripts/refresh/<source>.mjs` (AUTOMATION.md 참조)
- 출처 한정: 정부 통계 API · 공식 정부 페이지 · 공식 교통공사 · 공식 대학 페이지만. 상업 플랫폼 (Zillow·Kijiji·Yelp 등) 사용 금지 (약관).
- 스크래핑이 약관 위반인 출처는 절대 사용 안 함.

### 12.2 자동화 빈도

| 카테고리             | 빈도             | 워크플로우          |
| -------------------- | ---------------- | ------------------- |
| 환율 (클라이언트)    | 일 1회           | (앱)                |
| 환율 (백업)          | 일 1회 cron      | refresh-fx.yml      |
| 식재료·외식 (CPI)    | 주 1회           | refresh-prices.yml  |
| 임차료 (정부 통계)   | 월 1회           | refresh-rent.yml    |
| 교통공사             | 분기 1회         | refresh-transit.yml |
| 대학 학비            | 분기 1회         | refresh-tuition.yml |
| 비자                 | 분기 1회         | refresh-visa.yml    |
| 세금 brackets (정적) | 연 1회 (수동 PR) | (운영자)            |

### 12.3 운영자 부담 (자동화 후)

| 작업                             | 빈도      | 시간              |
| -------------------------------- | --------- | ----------------- |
| 자동 PR 리뷰 (auto-update 5~30%) | 주 ~5건   | ~30분/주          |
| 자동 PR 리뷰 (outlier ≥30%)      | 월 ~3건   | ~1시간/월         |
| 워크플로우 실패 대응             | 분기 ~1건 | ~1시간/분기       |
| 세금 brackets 연 1회 갱신        | 연 1회    | ~3시간/년         |
| **연간 총 운영 시간**            | —         | **~30~40시간/년** |

수동 시 70시간/년 → 자동화 후 30~40시간/년. **운영 부담 ~50% 감소** + **데이터 신선도 향상** (분기 → 주·월).

### 12.3 Outlier 처리

수집 중:

- 한 출처의 값이 다른 출처 대비 ±50% 이상 차이 → 추가 출처로 검증
- 직전 분기 대비 ±30% 변동 → 출처 재확인 + sources 에 변경 사유 코멘트
- 단기 시즌성 (학기 시작 전 월세 ↑ 등) → 분기 평균값 사용

### 12.4 시즌성 처리

| 항목 | 시즌성                           | 정책                                   |
| ---- | -------------------------------- | -------------------------------------- |
| 월세 | 학기 시작 전 ↑ (북미·영국 8~9월) | 분기 평균 또는 분기 시작 시점 값       |
| 학비 | 학기 시작 전 갱신                | 매 분기 검증 (공식 인상 발표 모니터링) |
| 식비 | 약함                             | 무시                                   |
| 교통 | 연 1회 인상                      | 연초 검증                              |
| 환율 | 일별                             | 자동 갱신 (별도)                       |

### 12.5 데이터 품질 게이트

수집 후 자동 검증 (`scripts/validate_cities.mjs`):

- [ ] 스키마 통과 (모든 필수 필드)
- [ ] 직전 분기 대비 ≤ 30% 변동 (warn)
- [ ] sources 배열 비어 있지 않음
- [ ] lastUpdated 가 분기 시작일 이후
- [ ] 통화 코드 ISO 4217 통과
- [ ] 환율 변환 후 한 달 합계 비현실적 X (예: 1만원 미만 → 의심)

수동 검증:

- [ ] 도시 5곳 무작위 샘플 — 출처 URL 모두 작동
- [ ] 디자인 hifi mock 의 가정 (예: 밴쿠버 1.9×) 과 ±10% 일치
- [ ] 시드 (서울·밴쿠버) 와 cities 디렉터리 동기화

---

## 13.5 데이터 저장 위치 단일 카탈로그

해외 생활비 비교 앱이 사용하는 **모든 데이터의 저장 위치** 를 한 곳에 정리. 새 데이터 항목 추가 시 본 표 갱신.

### 13.5.1 사용자 디바이스 (런타임)

| 위치         | 키              | 내용                                                                   | TTL  | 용도                       |
| ------------ | --------------- | ---------------------------------------------------------------------- | ---- | -------------------------- |
| AsyncStorage | `persona:v1`    | `{ persona, onboarded }`                                               | 영구 | 페르소나·온보딩 플래그     |
| AsyncStorage | `favorites:v1`  | `{ cityIds: string[] }`                                                | 영구 | 즐겨찾기 (max 50)          |
| AsyncStorage | `recent:v1`     | `{ cityIds: string[] }`                                                | 영구 | 최근 본 도시 (max 5, FIFO) |
| AsyncStorage | `settings:v1`   | `{ lastSync: ISOString \| null }`                                      | 영구 | 설정                       |
| AsyncStorage | `data:all:v1`   | `{ schemaVersion, generatedAt, fxBaseDate, cities: {...}, _cachedAt }` | 24h  | 도시 batch 캐시            |
| AsyncStorage | `fx:v1`         | `{ rates: {...}, _cachedAt }`                                          | 24h  | 환율 캐시                  |
| AsyncStorage | `meta:lastSync` | ISOString                                                              | 영구 | 마지막 성공 fetch 시각     |

**디바이스당 총 사용량 추정**: 50KB ~ 200KB (대부분 `data:all:v1` 캐시).
**iOS/Android AsyncStorage 한계**: iOS 무제한 (디스크 공간 의존), Android 6MB 기본 (충분).

### 13.5.2 앱 번들 (다운로드 시 사용자 디바이스에 포함)

| 경로                                                         | 내용                               | 크기                       |
| ------------------------------------------------------------ | ---------------------------------- | -------------------------- |
| `assets/fonts/Manrope-{Regular,SemiBold,Bold,ExtraBold}.ttf` | Manrope subset                     | ~400KB                     |
| `assets/fonts/Mulish-{Regular,Bold}.ttf`                     | Mulish subset                      | ~150KB                     |
| `assets/fonts/Pretendard-{Regular,Bold}.otf`                 | 한국어 fallback                    | ~600KB                     |
| `assets/data/seed/all.json`                                  | 21개 도시 시드 (오프라인 fallback) | ~150KB raw / ~40KB gzipped |
| `assets/icon.png`                                            | 앱 아이콘 (1024×1024)              | ~200KB                     |
| `assets/splash.png`                                          | 스플래시 이미지                    | ~100KB                     |
| **합계**                                                     |                                    | **~1.6MB** (자산만)        |

앱 번들 전체 (네이티브 포함): ~5MB gzipped (ADR-017).

### 13.5.3 GitHub Repo (큐레이터·자동화 편집)

| 경로                                  | 내용                                         | 갱신 주체                    |
| ------------------------------------- | -------------------------------------------- | ---------------------------- |
| `data/cities/<id>.json` × 22          | 도시별 raw 데이터                            | 자동화 (`scripts/refresh/*`) |
| `data/all.json`                       | build 산출물 (런타임 fetch 대상)             | `scripts/build_data.mjs`     |
| `data/seed/all.json`                  | 시드 (`assets/data/seed/all.json` 으로 복사) | 동일                         |
| `data/static/tax_brackets.json`       | 국가·주별 세금 brackets                      | 운영자 연 1회 PR             |
| `data/static/correction_factors.json` | 외식 보정계수                                | 운영자 분기 1회 PR           |
| `data/static/fx_fallback.json`        | 환율 3차 fallback                            | 자동화 (`fx_backup.mjs`)     |
| `data/static/city_meta.json`          | 도시 별칭·인기·정렬                          | 운영자 ad-hoc PR             |

### 13.5.4 원격 호스팅 (클라이언트 fetch)

| 출처                  | URL                                                          | 용도               |
| --------------------- | ------------------------------------------------------------ | ------------------ |
| GitHub Raw (primary)  | `raw.githubusercontent.com/<user>/<repo>/main/data/all.json` | 도시 batch fetch   |
| jsDelivr CDN (backup) | `cdn.jsdelivr.net/gh/<user>/<repo>@main/data/all.json`       | 자동 미러 fallback |
| open.er-api.com       | `https://open.er-api.com/v6/latest/USD`                      | 환율 1차           |
| ECB                   | `https://www.ecb.europa.eu/.../rates.xml`                    | 환율 2차 fallback  |

### 13.5.5 환경변수

| 위치                          | 키                          | 노출          | 용도                           |
| ----------------------------- | --------------------------- | ------------- | ------------------------------ |
| 클라이언트 (`app.json` extra) | `EXPO_PUBLIC_DATA_BASE_URL` | 공개          | 도시 데이터 baseURL 오버라이드 |
| GitHub Actions Secrets        | `KR_DATA_API_KEY`           | 비공개        | 한국 공공데이터포털            |
| GitHub Actions Secrets        | `US_BLS_API_KEY`            | 비공개        | 미국 BLS                       |
| GitHub Actions Secrets        | `US_CENSUS_API_KEY`         | 비공개        | 미국 Census                    |
| GitHub Actions Secrets        | `US_HUD_API_KEY`            | 비공개        | 미국 HUD                       |
| GitHub Actions Secrets        | `JP_ESTAT_APP_ID`           | 비공개        | 일본 e-Stat                    |
| GitHub Actions Secrets        | `SG_DATA_GOV_KEY`           | 비공개 (선택) | 싱가포르                       |

**원칙**: 비밀값은 **클라이언트에 절대 노출 안 함**. 모든 API 키는 GitHub Actions 안에서만 사용.

### 13.5.6 어디에도 저장 안 하는 데이터 (CRITICAL)

다음은 v1.0 에서 **수집·저장·전송 절대 안 함** (ADR-009·011, RELEASE.md §6.1 PIPA):

- 사용자 식별 정보 (이름·이메일·전화·생년월일)
- 사용자 기기 식별자 (IDFA·AAID·UDID)
- 사용자 행동 로그 (탭 기록·체류 시간·검색 기록)
- 크래시 리포트 (Sentry 등 미도입)
- IP 주소·위치 정보
- 푸시 토큰

사용자가 앱 삭제 시 모든 로컬 데이터 즉시 제거. 외부 서버에 잔존 데이터 없음 (수집 자체가 없음).

---

## 13. 도시별 구체 매핑

상세 — 21개 도시 × 카테고리별 출처 URL·필터·추출 방법 — 은 별도 문서 `docs/DATA_SOURCES.md` 참조. 분기 갱신 시 그 문서가 단일 actionable 가이드.

---

## 14. 정적 데이터 파일 스키마

자동 fetch 가 어려운 정책·계산 데이터는 정적 JSON 으로 관리. `data/static/` 디렉터리.

### 14.1 `data/static/tax_brackets.json`

각국·각주 소득세 brackets. 연 1회 운영자 PR 로 갱신.

```json
{
  "schemaVersion": 1,
  "lastUpdated": "2026-01-15",
  "countries": {
    "CA": {
      "currency": "CAD",
      "federal": [
        { "upTo": 55867, "rate": 0.15 },
        { "upTo": 111733, "rate": 0.205 },
        { "upTo": 173205, "rate": 0.26 },
        { "upTo": 246752, "rate": 0.29 },
        { "upTo": null, "rate": 0.33 }
      ],
      "provincial": {
        "BC": [
          { "upTo": 47937, "rate": 0.0506 },
          { "upTo": null, "rate": 0.205 }
        ],
        "ON": [ ... ],
        "QC": [ ... ]
      },
      "socialSecurity": {
        "rate": 0.0595,
        "cap": 68500
      }
    },
    "US": { ... },
    "UK": { ... },
    "DE": { ... },
    "FR": { ... },
    "NL": { ... },
    "AU": { ... },
    "JP": { ... },
    "SG": { ... },
    "VN": { ... },
    "AE": { "personalIncomeTax": 0 }
  },
  "cityToProvince": {
    "vancouver": { "country": "CA", "provincial": "BC" },
    "toronto": { "country": "CA", "provincial": "ON" },
    "montreal": { "country": "CA", "provincial": "QC" },
    "new-york": { "country": "US", "provincial": "NY", "city": "NYC" },
    "los-angeles": { "country": "US", "provincial": "CA" },
    ...
  }
}
```

검증 (TESTING.md §9-A.12):

- 모든 도시 cityToProvince 매핑 존재
- brackets 단조 증가 (`upTo` ascending)
- rate 0~1 범위
- 마지막 bracket `upTo: null` (무한)

### 14.2 `data/static/correction_factors.json`

CPI 평균값 → 실제 도시 식당 1끼·카페 가격 변환 보정계수. 분기 1회 검토.

```json
{
  "schemaVersion": 1,
  "lastUpdated": "2026-04-01",
  "restaurantMeal": {
    "seoul": 1.0,
    "vancouver": 1.0,
    "toronto": 1.05,
    "montreal": 0.95,
    "new-york": 1.20,
    "los-angeles": 1.05,
    "san-francisco-bay": 1.30,
    "seattle": 1.05,
    "boston": 1.15,
    "london": 1.10,
    "berlin": 0.95,
    "munich": 1.05,
    "paris": 1.10,
    "amsterdam": 1.10,
    "sydney": 1.10,
    "melbourne": 1.00,
    "tokyo": 1.0,
    "osaka": 0.90,
    "singapore": 1.20,
    "ho-chi-minh-city": 0.80,
    "dubai": 1.20
  },
  "cafe": { ...동일 도시 매핑... }
}
```

운영: 분기 1회 운영자가 실제 도시 식당 가격 샘플 (Yelp 등 참고만, 데이터는 보관 X) 으로 보정계수 검토. 변경 시 PR.

### 14.3 `data/static/fx_fallback.json`

환율 3차 fallback (한국은행 분기별 하드코딩, ADR-026).

```json
{
  "schemaVersion": 1,
  "baseCurrency": "KRW",
  "asOf": "2026-04-01",
  "rates": {
    "USD": 1340.0,
    "CAD": 980.0,
    "EUR": 1450.0,
    "GBP": 1700.0,
    "AUD": 880.0,
    "JPY": 8.9,
    "SGD": 1000.0,
    "VND": 0.054,
    "AED": 365.0
  }
}
```

### 14.4 `data/static/city_meta.json`

자동 fetch 와 무관한 도시 메타 (페르소나 적용 카드 우선순위, 권역 분류 등).

```json
{
  "schemaVersion": 1,
  "cities": {
    "vancouver": {
      "region": "na",
      "popularPersonas": ["student", "worker"],
      "kAliases": ["밴쿠버"],
      "enAliases": ["Vancouver", "YVR"],
      "displayOrder": 7
    },
    ...
  }
}
```

### 14.5 정적 데이터 갱신

| 파일                    | 빈도     | 트리거                            |
| ----------------------- | -------- | --------------------------------- |
| tax_brackets.json       | 연 1회   | 각국 회계연도 시작 (보통 1월)     |
| correction_factors.json | 분기 1회 | 분기 갱신 시 검토                 |
| fx_fallback.json        | 분기 1회 | refresh-fx 워크플로우가 자동 갱신 |
| city_meta.json          | ad-hoc   | 새 도시 추가·별칭 추가 시         |

모든 정적 파일은 PR 로 갱신 (자동 또는 수동). schemaVersion 변경 시 ADR.
