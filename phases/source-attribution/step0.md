# Step 0: source-scripts

## 배경

이 phase(`source-attribution`)는 **광고 도입(별도 phase `admob-banner-ads`)에 앞서, 이미 미충족인 데이터 출처 표기 의무 3건을 고친다.** 광고와 독립이라 먼저 main 에 머지한다.

| 결함 | 현재 | 정정 |
| --- | --- | --- |
| 런던 교통 출처명이 사실과 다름 | `TfL Unified API + static estimates` — 실제로는 API 를 **운행 상태 연결 확인**에만 쓰고 운임값은 `STATIC_TRANSPORT` 정적 상수다 | API 표기 삭제 + 정적 추정치 명시 |
| 캐나다 3개 도시 월세 출처가 상업 파생물 금지 약관(CMHC 포털)을 가리킴 | `ca_cmhc.mjs` 는 StatCan WDS 벡터 API 로 받으면서 출처 URL 은 CMHC 포털 | StatCan Open Licence 가 요구하는 `Adapted from Statistics Canada, <product>` 형식으로 출처를 StatCan 표 34-10-0133-01 로 전환 |
| 환율 1차 출처 ER-API 의 필수 링크 표기 없음 | `/sources` 화면에 `Rates By Exchange Rate API` 링크 없음 | **step 1** 에서 `/sources` 푸터에 링크 추가 |

phase 전체 계획 (이 step 은 **0번만** 구현한다):

0. **(이 step)** refresh 스크립트 2개 SOURCE 정정 + 스크립트 테스트 + 데이터 재생성 + ADR-076 + DATA_SOURCES.md·DATA.md 정합
1. `app/sources/index.tsx` 푸터에 ER-API 링크 + 화면 테스트 + DATA.md §3.3·UI_GUIDE·TESTING 인벤토리

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래를 반드시 직접 Read 할 것:

- `CLAUDE.md` — CRITICAL 규칙 (특히 데이터는 자동 갱신 경로로만, ADR-032)
- `docs/plans/admob-banner-ads.md` — 이 phase 의 설계 정본. §Context 표(출처별 라이선스), §검증 결과의 "TfL 실태"·"CMHC 실태"·"SUUMO 잔재", §A-1·A-2·A-3·A-5 를 정독
- `docs/adr/070-source-name-language.md` — 출처명 언어 정책 + `legacyNames` 이름 이전 기전
- `docs/adr/071-in-app-policy-pages.md`, `docs/adr/075-hero-basket-sum-wording.md` — ADR 파일 형식 참고
- `docs/ADR.md` — 인덱스 행 형식 (마지막 행 075). **076 이 비어 있는지 재확인**
- `docs/AUTOMATION.md` §3 (스크립트 표준 인터페이스), §8 (정적 추정치 마커 규칙)
- `docs/DATA.md` §3.1 (96행 부근 SUUMO 행), §3.3, §9
- `docs/DATA_SOURCES.md` — 밴쿠버 임차료(117~124행 부근), 토론토 임차료(166~170행), 몬트리올(203~207행), 런던 교통(401~412행)
- `docs/TESTING.md` §9-A (자동화 스크립트 인벤토리, 3180행 부근 §9-A.9 형식 참고)
- `scripts/refresh/_common.mjs` — `hasLegacySourceName()`(200행 부근), `writeCity()` 의 legacyNames 제거 로직(253~265행 부근)
- `scripts/refresh/uk_tfl.mjs`, `scripts/refresh/ca_cmhc.mjs` — 수정 대상 (SOURCE 상수 36행·60행, refresh() 의 `writeCity` 호출부 143행·170행)
- `scripts/refresh/universities.mjs` 287~299행 — `hasLegacySourceName` 을 refresh() 에 물리는 **기존 패턴** (그대로 따를 것)
- `scripts/refresh/__tests__/uk_tfl.test.ts`, `ca_cmhc.test.ts`, `universities.test.ts`(110~115행, 294~340행 — legacyNames·이름 이전 테스트 패턴)
- `data/cities/london.json`(73행), `data/cities/{vancouver,toronto,montreal}.json`(61행) — 현재 출처명

## 작업

### 1. `scripts/refresh/uk_tfl.mjs`

`SOURCE` 를 아래로 교체한다 (문구 **그대로**):

```js
export const SOURCE = {
  category: 'transport',
  name: 'TfL 운임 안내 페이지 (정적 추정치)',
  url: 'https://tfl.gov.uk/fares/',
  legacyNames: ['TfL Unified API + static estimates'],
};
```

- ADR-070: 기관 고유명(TfL) 원어, 서술형은 한국어, `(정적 추정치)` 마커 유지.
- `refresh()` 에 `hasLegacySourceName(oldData?.sources, SOURCE)` 판정을 추가해, 값 변동이 없어도 구 이름이 남아 있으면 1회 `writeCity` 한다 (`universities.mjs` 287~299행 패턴). `_common.mjs` 에서 `hasLegacySourceName` import 추가.
- `checkTflApiStatus()` 와 `useStatic` 분기는 **그대로 둔다** (연결 확인용, 데이터 출처 아님).

### 2. `scripts/refresh/ca_cmhc.mjs`

`SOURCE` 를 아래로 교체한다 (문구 **그대로**):

```js
export const SOURCE = {
  category: 'rent',
  name: 'Adapted from Statistics Canada, Table 34-10-0133-01 (CMHC 평균 월세 · share 는 studio×0.65 추정)',
  url: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301',
  legacyNames: ['CMHC Rental Market Survey via StatCan WDS (share=studio×0.65 estimated, ADR-059)'],
};
```

- StatCan Open Licence 의 `Adapted from Statistics Canada, <product>` 문구를 출처명에 그대로 담는다. reference date 는 화면의 `접속일 YYYY-MM-DD` 가 대신한다.
- 내부 ADR 번호(`ADR-059`)가 사용자 화면에서 사라진다. 다른 스크립트(HUD·StatCan CPI·BLS)의 ADR 번호 노출은 **건드리지 않는다** (별도 부채).
- `refresh()` 에 위 1 과 동일하게 `hasLegacySourceName` 판정을 추가한다.

### 3. 테스트 (`scripts/refresh/__tests__/`)

`uk_tfl.test.ts` 의 `SOURCE 정의`(117행 부근), `ca_cmhc.test.ts` 의 `SOURCE 정의`(182행 부근 — `'CMHC Rental Market Survey'`·`'cmhc'` 단언은 이제 **실패하므로** 교체) 를 새 값 기준으로 갱신하고, **각 파일에** 추가한다:

- `SOURCE.name` 과 `SOURCE.url` 이 위 문자열과 **정확히 일치** (`toBe`)
- `SOURCE.legacyNames` 에 구 이름이 포함
- 값 변동 0 + 구 출처명 잔존 fixture → `writeCity` 1회 호출되고 구 이름이 사라짐; 이전 완료 상태에서 재실행 → `writeCity` 미호출 (멱등). `universities.test.ts` 294~340행의 `값 변동 0 + 구 출처명 잔존` 테스트를 본떠 작성.

`docs/TESTING.md` §9-A 의 해당 스크립트 항목(uk_tfl · ca_cmhc)에 추가한 케이스를 기재한다 (**인벤토리 누락 = step 미완**).

### 4. 데이터 재생성 (자동화 경로로만 — ADR-032)

```bash
node scripts/refresh/_run.mjs uk_tfl --useStatic
node scripts/refresh/_run.mjs ca_cmhc              # StatCan WDS 실호출, API 키 불필요 — --useStatic 옵션 없음
node scripts/build_data.mjs                        # data/all.json + data/seed/all.json (ADR-074: 시드 = 실데이터 전량)
node scripts/validate_cities.mjs
```

- `ca_cmhc` 는 네트워크 필요. 실호출이라 캐나다 3개 도시 rent 숫자가 최신값으로 **바뀔 수 있으며 이는 정상**이다 (자동화 경로의 정규 갱신). 단, `_run.mjs` 출력의 변동 검증(AUTOMATION.md §6)이 임계치 초과로 거부하면 그 사실을 summary 에 적는다.
- `ca_cmhc` 가 네트워크 실패로 3개 도시 모두 갱신하지 못하면 이 step 을 `blocked` 로 두고 `blocked_reason` 에 "GitHub Actions `refresh-rent.yml` 수동 실행으로 대체 필요" 를 적는다. 도시 JSON 을 손으로 고치지 마라.
- 재생성 후 확인: `data/cities/{london,vancouver,toronto,montreal}.json` 의 `sources` 에 구 이름이 **0개**, 새 이름이 각 **1개**. 다른 17개 도시 JSON 은 `git diff --stat` 에 나타나지 않아야 한다.

### 5. ADR-076 + 문서

- `docs/adr/076-source-attribution-compliance.md` 신규 (형식은 075 참고). 내용: (a) ER-API 무료 endpoint 약관의 `Rates By Exchange Rate API` 링크 의무 → `/sources` 푸터 (step 1 에서 구현, 여기서는 결정만 기록), (b) TfL 출처명 정정 사유 — Unified API 를 데이터 출처로 쓰지 않으므로 "Powered by TfL Open Data" 의무는 발생하지 않고, 기존 이름이 사실과 달랐던 것이 문제, (c) CMHC → StatCan 전환 사유 — CMHC 포털 약관은 상업 파생물 금지, 우리는 StatCan WDS 로 받으므로 StatCan Open Licence 아래 두려면 출처를 StatCan 표로 바꿔야 함, (d) `docs/DATA.md` §3.1 의 SUUMO 잔재 제거 (스크립트 사용처 0건, ADR-032 금지 출처). 참고 링크는 `docs/plans/admob-banner-ads.md` §참고 링크에서 가져온다.
- `docs/ADR.md` 인덱스에 076 행 추가.
- `docs/DATA.md` §3.1 표: `| 일본 | SUUMO, e-Stat | 부동산·통계 |` → `| 일본 | e-Stat | 통계 |`. §9 에 "출처별 라이선스 요약" 소절 추가 — `docs/plans/admob-banner-ads.md` §Context "검토 결론 1" 표의 요약본 (출처 / 상업 이용 / 요구 표기 3열). §3.3 은 **step 1 이 수정**하므로 건드리지 않는다.
- `docs/DATA_SOURCES.md`: 런던 §교통 — TfL 절의 출처를 "TfL 운임 안내 페이지 (정적 추정치), https://tfl.gov.uk/fares/ — Unified API 는 운행 상태 연결 확인용, 운임값은 정적 상수" 로 정정. 밴쿠버·토론토·몬트리올 임차료 절의 출처를 "Statistics Canada Table 34-10-0133-01 (CMHC 평균 월세 원자료, StatCan WDS 벡터 API 수신)" + 새 URL 로 정정하고 CMHC 포털 URL 은 삭제.

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test
node scripts/refresh/_run.mjs uk_tfl --useStatic
node scripts/refresh/_run.mjs ca_cmhc
node scripts/build_data.mjs
node scripts/validate_cities.mjs
```

추가 검증 (모두 통과해야 함):

```bash
# 구 이름 0건
grep -c 'TfL Unified API + static estimates' data/all.json data/seed/all.json data/cities/london.json   # 전부 0
grep -c 'CMHC Rental Market Survey via StatCan WDS' data/all.json data/seed/all.json                    # 0
# 새 이름 도시당 1건
grep -c 'TfL 운임 안내 페이지 (정적 추정치)' data/cities/london.json                                   # 1
for c in vancouver toronto montreal; do grep -c 'Adapted from Statistics Canada, Table 34-10-0133-01' data/cities/$c.json; done   # 각 1
# ADR 076 존재 + 인덱스 행
test -f docs/adr/076-source-attribution-compliance.md && grep -c '\[076\]' docs/ADR.md   # 1
# SUUMO 잔재 0
grep -c 'SUUMO' docs/DATA.md   # 0
```

## 검증 절차

1. 위 AC 커맨드를 순서대로 실행한다.
2. `git diff --stat data/` 로 변경 파일이 london·vancouver·toronto·montreal 4개 도시 JSON + `data/all.json` + `data/seed/all.json` 뿐인지 확인한다. 런던의 transport 숫자는 **무변경**이어야 한다 (`--useStatic`). 캐나다 3개 도시의 rent 숫자 변동은 허용.
3. 아키텍처 체크리스트:
   - 데이터를 손으로 편집하지 않고 자동화 경로로만 재생성했는가? (ADR-032)
   - 출처명이 "기관 고유명 원어 + 서술 한국어 + (정적 추정치) 마커" 규칙을 지키는가? (ADR-070)
   - `legacyNames` 를 선언해 값 변동 없는 출처에서도 1회 쓰기가 일어나는가? (`_common.mjs`)
   - ADR 파일 + 인덱스 행, TESTING §9-A 인벤토리를 갱신했는가?
4. 결과에 따라 `phases/source-attribution/index.json` 의 step 0 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (변경한 파일, 캐나다 rent 값 변동 여부, ADR 번호를 담을 것)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (StatCan 네트워크 실패 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `data/cities/*.json`, `data/all.json`, `data/seed/all.json` 을 직접 편집하지 마라. 이유: ADR-032 위반이며 다음 cron 이 스크립트 값으로 덮어써 원복된다.
- `scripts/refresh/_common.mjs` 를 수정하지 마라. 이유: `legacyNames` / `hasLegacySourceName` 기전은 ADR-070 에서 완성돼 있고, 이 step 은 호출자 쪽만 바꾸면 된다.
- 다른 refresh 스크립트(`us_hud.mjs`, `us_bls.mjs`, StatCan CPI 등)의 출처명을 손대지 마라. 이유: ADR 번호·계산식 노출 정리는 별도 부채로 분리됐다 (`docs/plans/admob-banner-ads.md` §범위 밖).
- `app/sources/index.tsx` 를 수정하지 마라. 이유: step 1 의 작업 범위다.
- `docs/DATA.md` §3.3 표를 수정하지 마라. 이유: step 1 이 ER-API 링크 행을 추가한다.
- `checkTflApiStatus()` 를 삭제하지 마라. 이유: 운행 상태 연결 확인 기능은 유지 대상이고, 테스트 3건이 의존한다.
- 기존 테스트를 깨뜨리지 마라.
