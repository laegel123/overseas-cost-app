[← ADR 인덱스](../ADR.md)

# ADR-071: 정책 페이지 인앱 내재화 + 출처 카운트 런타임 실측 (Supersedes ADR-065)

> **상태**: Active

**맥락:**

`app/(tabs)/settings.tsx` 의 메뉴 두 개가 `Linking.openURL` 로 앱 밖을 연다.

| 메뉴 | 현재 대상 |
| --- | --- |
| 데이터 출처 보기 (`12개`) | GitHub `docs/DATA_SOURCES.md` — 848줄 개발자용 마크다운 |
| 개인정보 처리방침 | GitHub Pages `privacy-policy.html` |

세 가지 문제가 겹쳐 있다.

1. **개발자 문서를 사용자에게 보여준다.** `DATA_SOURCES.md` 는 fetch endpoint·정규식·자동화 한계 매트릭스가 섞인 운영 문서다. "우리 데이터 어디서 왔나" 를 알고 싶은 사용자가 볼 것이 아니다. 게다가 앱 밖으로 나가므로 오프라인에서는 아예 열리지 않고, 앱 디자인 토큰과 무관한 GitHub UI 를 만난다.
2. **카운트가 화면과 어긋난다.** 메뉴 rightText 의 `DATA_SOURCES_COUNT = 12` 는 큐레이션된 "출처 **유형**" 수다 (ADR-065). 그런데 실제 도시 JSON 의 `sources[]` 엔트리는 104개, unique (name, url) 기준 46개다. 출처를 앱 안에서 나열하는 순간 "12개" 라는 메뉴 라벨과 46행짜리 목록이 같은 화면에서 모순된다.
3. **출처 URL 이 실제 출처가 아니다.** tuition·visa 출처 40개(해외 20개 도시 × 2)의 `url` 이 전부 `https://github.com/laegel123/overseas-cost-app/blob/main/docs/DATA_SOURCES.md` 를 가리킨다 — 방금 앱 안으로 들여온 바로 그 문서다. 원인은 `scripts/refresh/universities.mjs` / `visas.mjs` 의 `SOURCE` 가 **모듈 레벨 단일 상수**라 도시별로 다른 URL 을 쓸 수 없다는 것뿐이다. 두 스크립트는 실제 공공 출처 URL 을 `UNIVERSITY_REGISTRY` / `VISA_REGISTRY` 에 **이미 갖고 있다**.

**결정:**

1. **정책 페이지 인앱 내재화.** 데이터 출처·개인정보 처리방침을 앱 내부 화면(`/sources`, `/sources/[cityId]`, `/privacy`)으로 제공하고, `settings.tsx` 의 외부 링크 상수 `DATA_SOURCES_URL` / `PRIVACY_POLICY_URL` 을 제거한다. 오프라인에서도 열람 가능하고, 앱 디자인 토큰과 일관되며, 개발자 문서 대신 사용자용 뷰를 준다. 이로써 `docs/RELEASE.md` §7 의 **"URL 변경 가능성을 고려해 앱에서 항상 외부 링크로 노출" 정책을 전환한다** — 스토어 등록용 공개 URL(`privacy-policy.html`)은 스토어 심사 요구사항이라 그대로 유지되고, **앱 내부 표시만** 자체 화면으로 바뀐다. ADR-065 결정 2 를 supersede.
2. **출처 카운트 = 런타임 실측.** 설정 메뉴 rightText 와 출처 화면 헤더는 **현재 로드된 도시 데이터에서 계산한 unique 출처 수**를 쓴다. `src/lib/dataSources.ts` 의 `DATA_SOURCES_COUNT`, `docs/DATA_SOURCES.md` 의 `<!-- DATA_SOURCES_COUNT: N -->` 마커, 둘의 동기화를 강제하던 드리프트 테스트를 모두 제거한다. ADR-065 결정 1 을 supersede. 실측값은 정의상 drift 가 불가능하다. 번들 시드만 있는 첫 실행 시 값이 작게(10개) 표시되는 것은 "지금 앱이 가진 데이터" 를 정확히 반영한 것이므로 의도된 동작이다 — 설정의 "도시 DB" 통계 카드가 이미 같은 방식이다.
3. **진입점은 설정 메뉴로 한정.** Compare 화면의 `disabled` 된 "출처 보기 →" 와 Detail 화면의 인라인 출처 목록은 이 phase 에서 바꾸지 않는다. Detail 은 이미 해당 카테고리 출처를 전부 인라인으로 보여주므로 중복 진입점이 된다. 화면 이동은 일반 Stack push 다 — `docs/UI_GUIDE.md` §Sheet C 의 full-screen modal 명세와 다르지만 기존 compare/detail 과 동일한 방식으로 통일하는 편이 낫다 (UI_GUIDE 편차표에 기록).
4. **tuition/visa 출처 URL 도시별 실제화.** `SOURCE` 모듈 상수를 `buildSource(cityId)` 함수로 바꿔 도시별 실제 공공 출처 URL 과 구체적 기관·대학명을 기록한다.
   - tuition `url` = `UNIVERSITY_REGISTRY[cityId]` 첫 대학의 공식 페이지, `name` = `` `${대학명 · 나열} 공식 국제학생 학비 페이지 (정적 추정치)` `` (예: `UBC · SFU · BCIT 공식 국제학생 학비 페이지 (정적 추정치)`).
   - visa `url` = `VISA_REGISTRY[CITY_TO_COUNTRY[cityId]].url`, `name` = `` `${기관} 공식 비자 수수료 페이지 (정적 추정치)` `` (예: `캐나다 이민·난민·시민권부(IRCC) 공식 비자 수수료 페이지 (정적 추정치)`).
   - 기관·대학 고유명은 원어 유지, 서술 부분만 한국어, `(정적 추정치)` 마커 유지 — ADR-070 규칙 그대로. ADR-070 이 "후속 (이 결정의 범위 밖)" 으로 남긴 항목의 연장이며, 같은 `legacyNames` 기전을 재사용해 자동화 경로 안에서 이름·URL 이 이전된다 (ADR-032 준수). `legacyNames` 에는 **구 한국어명과 그 이전 영문명을 둘 다** 넣는다 — 하나라도 빠지면 `updateSources` 가 구 항목을 지우지 못해 도시별로 출처가 중복 append 된다.
   - registry 미등록 도시는 명시적 throw (silent fallback 금지).

**대안 검토:**

- **(A) 채택 — 자체 화면 + 런타임 실측 카운트 + 도시별 실제 출처 URL**: 오프라인 동작, 디자인 일관, 카운트 모순 소멸, "페이지 열기 →" 가 진짜 공공 출처로 착지.
- **(B) 기각 — WebView 로 원격 HTML 임베드**: `react-native-webview` 라는 신규 네이티브 의존성이 필요하고, 오프라인에서 여전히 빈 화면이며, 앱 디자인 토큰과 이질적이다.
- **(C) 기각 — 출처 화면은 만들되 각 출처 링크는 GitHub 문서 유지**: 사용자용 화면이 개발자 문서로 나가는 경험. 실제 공공 출처 URL 을 registry 에 이미 갖고 있으므로 유지할 이유가 없다.
- **(D) 기각 — `DATA_SOURCES_COUNT` 를 유지하고 화면만 실측**: 같은 화면에서 두 숫자(12 vs 46)가 어긋난다. 유형 수와 실측 수 중 하나만 남겨야 하고, 화면이 나열하는 것은 실측 쪽이다.
- **(E) 기각 — 도시별 URL 을 데이터 JSON 직접 편집으로 반영**: ADR-032 위반. 다음 cron 이 스크립트 값으로 덮어써 원복된다.

**결과 / 영향:**

- **ADR-065 는 Superseded by ADR-071** — 두 결정 모두 뒤집힌다. 단 스토어 등록용 `privacy-policy.html` 공개 URL 자체는 `docs/RELEASE.md` §7 대로 유지된다 (심사 요구).
- 신규: `src/lib/categoryMeta.ts`, `src/lib/sources.ts`, `src/lib/privacyPolicy.ts`, `app/sources/index.tsx`, `app/sources/[cityId].tsx`, `app/privacy.tsx`.
- 제거: `src/lib/dataSources.ts` + 그 테스트, `docs/DATA_SOURCES.md` 의 `DATA_SOURCES_COUNT` 마커 블록, `settings.tsx` 의 외부 링크 상수 2개.
- 결정 4 재생성 범위: `data/cities/*.json` 해외 20개 + `data/all.json`. **숫자 값 무변경** — `sources[].name` / `sources[].url` / `accessedAt` / `lastUpdated` / `generatedAt` 만 바뀐다. `seoul.json` 은 tuition·visa 출처가 없어 무변경, `data/seed/` 는 fixture 기반이라 무변경 (ADR-045). 재생성 후 `sources[]` 엔트리 총수는 104개 유지, `github.com` 을 가리키는 출처 URL 0개.
- 결정 4 는 숫자 변동이 0 이므로 `detect_outliers` 가 직접 commit 경로로 분기한다 (AUTOMATION.md §4.4·§4.5 의 "변경 0" 서술과 일관).

**관련:** ADR-032 (공공 출처 100% 자동화), ADR-045 (seed fixture), ADR-064 (expo-updates OTA), ADR-065 (superseded), ADR-070 (출처명 언어 정책 + `legacyNames`), `docs/RELEASE.md` §7, `docs/AUTOMATION.md` §3·§4.4·§4.5·§8, `docs/DATA.md` §3.3, `phases/in-app-policy-pages/` (step 명세 = 설계 문서).
