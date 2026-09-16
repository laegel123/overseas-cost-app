# Step 1: rent-data-refresh

## 배경

`scripts/refresh/ca_cmhc.mjs` 는 밴쿠버·토론토·몬트리올의 `rent` 를 StatCan WDS 표 34-10-0133-01 에서 받아 갱신하는 fetcher 다. 이 fetcher 의 벡터 ID 9개가 엉뚱한 표(ARCHIVED product 36100480, 노동생산성)를 가리켜 **도입 이래 한 번도 값을 가져오지 못했고**, 3개 도시의 rent 숫자는 초기 시드값으로 남아 있었다. **step 0 이 벡터 ID 를 올바른 값으로 교체하고 ADR-078 을 기록했다.**

이 step 은 그 수정을 **자동화 경로로만** 실제 데이터에 반영한다.

이 phase 의 남은 step:

2. `_run.mjs` 가 "대상 전부 실패" 를 exit 1 로 구분하도록 수정 (재발 방지) — **이 step 의 범위 아님**

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래를 반드시 직접 Read 할 것:

- `CLAUDE.md` — CRITICAL 규칙. 특히 **데이터는 공공 출처에서 자동으로만 갱신**(ADR-032). 도시 JSON 손편집 금지
- `docs/adr/078-ca-rent-statcan-vectors.md` — step 0 이 작성한 결정. 특히 "재매핑 직후 대폭 변동은 이상치가 아니라 최초 정상화" 결정
- `docs/adr/076-source-attribution-compliance.md` — `SOURCE` 가 StatCan 표로 전환된 경위와 `legacyNames` 이전 기전
- `docs/AUTOMATION.md` §6 (변동 검증 임계치 — `<5%` commit / `5~30%` PR / `≥30%` OUTLIER)
- `docs/DATA.md` §3.1, §9.1
- `docs/DATA_SOURCES.md` — 밴쿠버·토론토·몬트리올 임차료 절 (ADR-076 이 이미 StatCan 표로 정정해 둠)
- `scripts/refresh/ca_cmhc.mjs` — step 0 이 수정한 파일. `CITY_CONFIGS[*].vectors` 가 새 벡터인지 먼저 확인하라
- `scripts/refresh/_common.mjs` 의 `writeCity()` — `legacyNames` 에 해당하는 구 출처명을 제거하고 새 이름으로 쓰는 로직
- `data/cities/{vancouver,toronto,montreal}.json` — 현재 값과 출처명
- `scripts/build_data.mjs`, `scripts/validate_cities.mjs`

## 작업

### 1. 데이터 재생성 (자동화 경로로만 — ADR-032)

```bash
node scripts/refresh/_run.mjs ca_cmhc     # StatCan WDS 실호출, API 키 불필요
node scripts/build_data.mjs               # data/all.json + data/seed/all.json (ADR-074: 시드 = 실데이터 전량)
node scripts/validate_cities.mjs
```

`_run.mjs` 출력이 `updated 3 cities: vancouver, toronto, montreal` 이어야 한다. `updated 0 cities` 가 나오면 벡터가 아직 반영되지 않은 것이므로 step 0 산출물을 다시 확인하라.

### 2. 결과 검증 — 참고 기준값

step 0 시점(참조기간 `2025-01-01`)에 확인된 값이다. StatCan 이 새 참조기간을 게시했다면 **달라질 수 있고 그것이 정상**이다. 아래 표는 "자릿수가 맞는지" 판단하는 기준으로만 쓰고, 실제 값이 ±10% 이내면 정상으로 간주한다.

| 도시 | studio | oneBed | twoBed | share (= studio × 0.65) |
| --- | --- | --- | --- | --- |
| vancouver | 1669 | 1809 | 2367 | 1085 |
| toronto | 1494 | 1761 | 2056 | 971 |
| montreal | 1008 | 1200 | 1364 | 655 |

값이 기준에서 ±10% 를 **넘게** 벗어나면 벡터가 잘못됐을 가능성이 있다. 그 경우 데이터를 커밋하지 말고 `blocked` 로 두고 실제 받은 값과 벡터를 `blocked_reason` 에 적어라.

또한 다음을 반드시 확인한다:

- 세 도시 모두 `studio < oneBed < twoBed` 순서가 성립한다. 성립하지 않으면 벡터가 뒤섞인 것이다 — 커밋하지 말고 `blocked`.
- 세 도시의 `rent` 출처명이 `Adapted from Statistics Canada, Table 34-10-0133-01 (CMHC 평균 월세 · share 는 studio×0.65 추정)` **한 개**로 이전됐다. 구 이름 `CMHC Rental Market Survey via StatCan WDS` 는 0건이어야 한다 (`writeCity` 가 `legacyNames` 로 자동 처리한다 — 손으로 고치지 마라).
- `git diff --stat data/` 에 나타나는 파일이 `vancouver.json`, `toronto.json`, `montreal.json`, `all.json`, `seed/all.json` **5개뿐**이다. 다른 18개 도시 JSON 이 바뀌었다면 원인을 찾아 되돌려라.

### 3. 변동 검증 — 대폭 하락은 예상된 결과다

시드값 대비 10~45% 하락이 발생한다 (몬트리올이 가장 크다). `docs/AUTOMATION.md` §6 기준으로는 OUTLIER(≥30%) 에 해당하지만, **ADR-078 결정 2 에 따라 이는 이상치가 아니라 최초 정상화이므로 이 step 에서 1회 반영한다.**

`_run.mjs` 나 변동 검증 로직이 실행을 거부하지는 않는다 (임계치는 GitHub Actions 출력 분류용이다). 다만 실제 변동률을 summary 에 도시별로 기록해, 리뷰어가 PR diff 에서 근거를 확인할 수 있게 하라.

### 4. 문서 정합

- `docs/DATA_SOURCES.md` 의 밴쿠버·토론토·몬트리올 임차료 절에 **structure 기준**을 명시한다: 표 34-10-0133-01 의 `Apartment structures of six units and over` (6세대 이상 아파트) 평균 임대료를 쓰며, `share` 는 `studio × 0.65` 추정이라는 점. 출처명·URL 은 ADR-076 이 이미 정정해 두었으므로 **바꾸지 마라**.
- `docs/DATA.md` 에 캐나다 rent 갱신 주기·기준에 관한 기술이 있으면 실제와 맞는지 확인하고, 어긋난 부분만 고친다. 없으면 추가하지 마라.

## Acceptance Criteria

```bash
node scripts/refresh/_run.mjs ca_cmhc
node scripts/build_data.mjs
node scripts/validate_cities.mjs
npm run typecheck
npm run lint
npm test
```

추가 검증 (모두 통과해야 함):

```bash
# 구 출처명 0건 / 새 출처명 도시당 1건
grep -c 'CMHC Rental Market Survey via StatCan WDS' data/all.json data/seed/all.json   # 전부 0
for c in vancouver toronto montreal; do
  grep -c 'Adapted from Statistics Canada, Table 34-10-0133-01' data/cities/$c.json
done   # 각 1
# 값 순서 검증 (studio < oneBed < twoBed)
for c in vancouver toronto montreal; do
  node -e "const r=require('./data/cities/$c.json').rent; if(!(r.studio<r.oneBed&&r.oneBed<r.twoBed)) {console.error('$c order broken', r); process.exit(1)} console.log('$c ok', r)"
done
# 변경 파일이 5개뿐
git diff --stat data/ | tail -1
```

## 검증 절차

1. 위 AC 커맨드를 순서대로 실행한다.
2. 작업 §2 의 세 가지 확인(기준값 ±10%, 값 순서, 출처명 이전)을 모두 통과했는지 본다. 하나라도 실패하면 데이터를 커밋하지 말고 `blocked` 로 둔다.
3. 아키텍처 체크리스트:
   - 도시 JSON 을 손으로 편집하지 않고 자동화 경로로만 재생성했는가? (ADR-032)
   - 출처명 이전이 `writeCity` 의 `legacyNames` 기전으로 자동 처리됐는가?
   - 다른 18개 도시 JSON 이 무변경인가?
4. 결과에 따라 `phases/ca-rent-vectors/index.json` 의 step 1 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (도시별 변동률과 최종 값, 참조기간을 담을 것)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 네트워크 실패·기준값 이탈 등 → `"status": "blocked"`, `"blocked_reason": "실제 받은 값과 벡터를 포함한 구체적 사유"` 후 즉시 중단

## 금지사항

- `data/cities/*.json`, `data/all.json`, `data/seed/all.json` 을 직접 편집하지 마라. 이유: ADR-032 위반이며 다음 cron 이 스크립트 값으로 덮어써 원복된다. 값이 이상하면 고치지 말고 `blocked` 로 보고하라.
- 기준값과 맞추려고 `scripts/refresh/ca_cmhc.mjs` 의 벡터를 바꾸지 마라. 이유: step 0 이 제목 자기검증으로 확정한 값이다. 실제 값이 기준에서 벗어나면 그것은 보고 대상이지 조정 대상이 아니다.
- 출처명을 손으로 고치지 마라. 이유: `writeCity` 의 `legacyNames` 기전이 자동 처리한다. 손으로 고치면 다음 갱신 때 이름이 다시 갈린다.
- `_run.mjs` 를 수정하지 마라. 이유: step 2 의 작업 범위다.
- `docs/DATA_SOURCES.md` 의 캐나다 출처명·URL 을 바꾸지 마라. 이유: ADR-076 이 StatCan Open Licence 요구 형식으로 확정했다. 이 step 은 structure 기준만 덧붙인다.
- 기존 테스트를 깨뜨리지 마라.
