# Step 7: privacy-policy

## 배경

이 phase(`admob-banner-ads`)는 Google AdMob 하단 배너를 도입한다. AdMob SDK 는 광고 식별자(IDFA/GAID)·IP 기반 대략적 위치·기기 정보·광고 상호작용·성능 진단 정보를 수집해 Google 과 공유한다. 저장소 곳곳의 **"개인정보 수집 0건" 단언은 이제 거짓**이며, 이 step 이 법적 문서와 스토어 제출 문서를 사실에 맞게 고친다.

**이 step 의 범위:** 개인정보 처리방침 정본(`src/lib/privacyPolicy.json`) 개정 + 생성물 재생성 + `docs/store-metadata.md` + `docs/RELEASE.md` + `docs/RELEASE_CHECKLIST.md`. 코드 변경은 없다 (정본 JSON 과 그 테스트만).

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래를 반드시 직접 Read 할 것:

- `CLAUDE.md`
- `docs/plans/admob-banner-ads.md` §Context "검토 결론 2" 표 (갱신 대상 위치 전부), §K (문구 정본 — **그대로 사용**), §L 의 RELEASE·RELEASE_CHECKLIST·store-metadata 행, 인벤토리 9.40 · 9-A.11 행
- `docs/adr/072-privacy-policy-source.md` — 처리방침 단일 출처 정책 (JSON 정본 → `npm run gen:privacy` → HTML·MD 생성물, 직접 편집 금지)
- `src/lib/privacyPolicy.json` — 수정 대상 (현재 섹션 7개: 수집·저장 / 외부 서비스 / 분석·추적 / 정확성 고지 / 보호책임자 / 변경 / 문의)
- `src/lib/privacyPolicy.ts` — 타입 (`PrivacyBlock` kind: paragraph | list | email)
- `src/lib/__tests__/privacyPolicy.test.ts` — 17행 "섹션이 7개다" 불변조건 등
- `scripts/gen_privacy_docs.mjs`, `scripts/__tests__/gen_privacy_docs.test.ts` — 드리프트 가드
- `docs/RELEASE.md` §1 표(11행), §5 iOS(106·108행)·Android(119행), §6(140행 5.1.1), §6.1 PIPA 표(148~163행), §8 이용약관(191행), §13.5
- `docs/RELEASE_CHECKLIST.md` 단계 2 (32행 "광고: 없음", 36행 Data Safety)
- `docs/store-metadata.md` §3 "■ 개인정보, 수집하지 않습니다" 블록(95~100행), §6 Data Safety 표(168~178행)
- `docs/TESTING.md` §9.40 (2653행 부근), §9-A.11
- AdMob 데이터 공개 문서 (WebFetch 가능하면): https://developers.google.com/admob/ios/data-disclosure , https://developers.google.com/admob/android/privacy/play-data-disclosure — 수집 항목 근거

## 작업

### 1. `src/lib/privacyPolicy.json` (정본)

아래 문구는 설계 문서 §K 의 정본이다. **그대로** 쓴다 (문구 개선 금지 — 법적 문서, 사용자 승인 문구).

- `updatedAt`: 이 step 을 실행하는 날짜 (`YYYY-MM-DD`).
- `lead`: `본 앱은 회원가입 없이 사용하며, 광고 표시를 위해 광고 SDK 가 수집하는 정보 외에는 개인정보를 수집하지 않습니다.`
- **수집·저장 정보** 첫 항목 교체: `본 앱 자체는 사용자 정보를 외부 서버로 전송하거나 수집하지 않습니다. 광고 표시 과정에서 수집되는 정보는 아래 '광고' 항목을 참고하세요.` (나머지 3개 항목 유지)
- **외부 서비스** 유지 (환율·GitHub 2개 항목).
- **신규 섹션 `광고`** — 외부 서비스 **다음**, 분석·추적 **앞**. `kind: 'list'` 항목 6개:
  1. `본 앱은 Google AdMob 을 통해 배너 광고를 표시합니다. 광고 SDK 는 광고 게재·성과 측정·부정 클릭 방지를 위해 아래 정보를 수집하여 Google 에 전송합니다.`
  2. `수집 항목: 광고 식별자(iOS IDFA·Android 광고 ID), IP 주소와 이로부터 추정한 대략적 위치, 기기·OS 정보, 광고 노출·클릭 등 상호작용 정보, 앱 성능 진단 정보`
  3. `이전받는 자·국가: Google LLC (미국). 이전 방법·시기: 광고 요청 시 네트워크로 전송. 보유 기간: Google 개인정보처리방침(https://policies.google.com/privacy)에 따름`
  4. `iOS 에서는 첫 사용 시 앱 추적 허용 여부를 묻습니다. 거부해도 앱은 동일하게 동작하며 비맞춤형 광고가 표시됩니다. 설정 > 개인정보 보호 및 보안 > 추적 에서 언제든 변경할 수 있습니다.`
  5. `Android 에서는 설정 > Google > 광고 에서 광고 ID 재설정 또는 맞춤 광고 삭제를 선택할 수 있습니다.`
  6. `유럽경제지역(EEA)·영국·스위스 사용자에게는 광고 개인정보 동의 화면이 표시되며, 앱 설정 > 광고 개인정보 설정 에서 선택을 변경할 수 있습니다.`
- **분석·추적** 항목 교체: `본 앱은 분석 도구·오류 추적 SDK 를 사용하지 않습니다. 광고 게재를 위한 Google AdMob SDK 가 위 '광고' 항목의 정보를 수집하는 것이 유일한 예외입니다.`
- **개인정보 보호책임자** list 에 항목 추가: `개인정보 처리 위탁·국외 이전: 광고 게재 목적으로 Google LLC 에 위 '광고' 항목의 정보가 이전됩니다.`
- 나머지 섹션(정확성 고지·변경·문의) 유지. 결과 섹션 수 **8개**.

### 2. 생성물 재생성

```bash
npm run gen:privacy      # docs/privacy-policy.html + docs/PRIVACY.md 재생성 — 직접 편집 금지
```

### 3. 테스트 — `src/lib/__tests__/privacyPolicy.test.ts` (§9.40 갱신)

- "섹션이 7개다" → **8개** (수집·저장 / 외부 서비스 / **광고** / 분석·추적 / 정확성 고지 / 보호책임자 / 변경 / 문의) — 순서까지 단언
- `광고` 섹션에 `Google LLC` 문자열 포함 (국외이전 고지 회귀 방지)
- `광고` 섹션에 `IDFA` 와 `광고 ID` 포함 (수집 항목 회귀 방지)
- 문서 전체에 `수집하지 않습니다.` 로 **끝나는** lead 가 없음 (`PRIVACY_POLICY.lead` 가 해당 문자열로 끝나지 않음)
- 기존 페르소나 회귀 단언 등은 유지
- `scripts/__tests__/gen_privacy_docs.test.ts` 드리프트 가드가 재생성 후 통과

### 4. `docs/RELEASE.md`

- §1 표 3행: `호환성 깨지는 변경, 네이티브 의존성 변경 … v2.0.0` → 네이티브 의존성 **추가**는 "새 바이너리 빌드 + 스토어 심사" 이되 버전 bump 는 **변경 성격에 따름**(호환성 파괴만 major) 으로 정정. 광고 도입 = v1.1.0 (`runtimeVersion.policy = appVersion` 이라 OTA 호환 키는 자동으로 갈린다) 예시 추가.
- §5 iOS: `App Privacy` → **Identifiers(Device ID) · Usage Data(Advertising Data, Product Interaction) · Diagnostics(Crash Data, Performance Data) · Location(Coarse Location)** — 용도 "Third-Party Advertising", 추적(Tracking) 용도 표시. `App Tracking Transparency` → **사용** (UMP 가 IDFA 메시지 + 시스템 프롬프트 처리).
- §5 Android `Data Safety` → **기기 또는 기타 ID · 앱 상호작용 · 앱 성능(진단) · 대략적 위치 수집, Google 과 공유, 목적: 광고·분석·부정행위 방지**.
- §6 `5.1.1` 항목: "수집 안 함" → "광고 SDK 수집 항목을 처리방침 '광고' 섹션에 명시, ATT 로 추적 동의".
- §6.1 PIPA 표: 수집·이용 동의 → **필요 (ATT·UMP 프롬프트로 대체)**, 국외이전 동의 → **고지 (처리방침 '광고' 섹션 — Google LLC 미국)**, 처리 위탁 → **Google LLC (광고 게재)**, 정보주체 권리 → OS 설정(ATT/광고 ID 재설정) + EEA 는 앱 내 메뉴. "스토어 심사 시 추가" 의 두 줄도 갱신.
- §8 이용약관 1항: `본 앱은 무료로 제공되며 광고가 표시됩니다. 인앱 결제는 없습니다.`
- §13.5 에 한 줄: "AdMob 정책 위반 알림(콘솔 이메일) 수신 시 광고 단위 비활성화 → 원인 수정 → 재심사 요청".
- §3 환경·EAS 프로필에 `EXPO_PUBLIC_ADS_TEST` 스위치 한 줄 (값은 step 9 가 `eas.json` 에 넣는다 — "development·preview = 1, production = 미설정").

### 5. `docs/RELEASE_CHECKLIST.md`

- 32행 `광고: 없음` → `광고: **있음** (AdMob 배너)`.
- 36행 Data Safety 답안을 §4 의 Android 값으로 교체 (근거 ADR-077).
- 단계 2 에 항목 추가: `⬜ app-ads.txt: laegel123.github.io 루트에 AdMob 콘솔 제공 1줄 게시 + 스토어 등록정보 개발자 웹사이트 = https://laegel123.github.io`, `⬜ ATT: App Store Connect 에서 추적 사용 표시`, `⬜ 프로덕션 첫 빌드 전 app.json App ID 2개 + src/lib AD_UNIT_IDS placeholder 교체 확인 (미교체 시 런타임 AdsConfigError 로 광고만 꺼짐 — 빌드는 실패하지 않으므로 이 체크리스트로 강제)`.

### 6. `docs/store-metadata.md`

- §3 `■ 개인정보, 수집하지 않습니다` 블록 → `■ 개인정보는 광고 표시에 필요한 최소한만` 으로 제목·불릿 4개 재작성: 회원가입·로그인 없음 / 앱 자체는 사용자 정보를 서버로 전송하지 않음 / 즐겨찾기·최근 본 도시는 기기 내부에만 / 배너 광고(Google AdMob)를 위해 광고 식별자 등이 Google 에 전송되며 상세는 개인정보 처리방침. "페르소나" 단어가 남아 있으면 제거 (ADR-067).
- §6 Data Safety 표 교체: 수집·공유 **예** / 전송 중 암호화 **예** / 삭제 요청 — 광고 ID 는 OS 설정에서 재설정, 앱 자체 보관 데이터 없음 / 수집 유형별 행(기기 ID·앱 상호작용·앱 성능·대략적 위치 — 공유 대상 Google, 목적 광고·분석·부정방지, 선택적 여부). 근거 ADR-077.

### 7. 문서 인벤토리

- `docs/TESTING.md` §9.40 항목을 8개 섹션·광고 섹션 단언으로 갱신 (**누락 = step 미완**).

## Acceptance Criteria

```bash
npm run typecheck
npm run lint
npm test
npm run gen:privacy && npm test -- scripts/__tests__/gen_privacy_docs      # 재생성 후 드리프트 가드 통과 (생성물은 아직 미커밋이므로 git diff 로 판정하지 말 것)
node -e "const p=require('./src/lib/privacyPolicy.json');const t=p.sections.map(s=>s.title);if(t.length!==8||t[2]!=='광고')process.exit(1);if(/수집하지 않습니다\.$/.test(p.lead))process.exit(1)"
grep -c 'Google LLC' src/lib/privacyPolicy.json docs/privacy-policy.html docs/PRIVACY.md   # 각 ≥ 1
grep -c '광고·인앱 결제가 없습니다' docs/RELEASE.md                                        # 0
grep -c 'Data Not Collected' docs/RELEASE.md                                               # 0
grep -c '광고: \*\*없음\*\*' docs/RELEASE_CHECKLIST.md                                      # 0
grep -c '수집하지 않습니다' docs/store-metadata.md                                          # 0
grep -c 'app-ads.txt' docs/RELEASE_CHECKLIST.md                                            # ≥ 1
```

## 검증 절차

1. 위 AC 를 실행한다.
2. 아키텍처 체크리스트:
   - 생성물(HTML·MD)을 직접 편집하지 않고 `gen:privacy` 로만 만들었는가? (ADR-072)
   - 정본 문구가 설계 문서 §K 와 **글자 단위로** 일치하는가?
   - "수집 안 함" 단언이 4개 문서(RELEASE·RELEASE_CHECKLIST·store-metadata·privacyPolicy) 어디에도 남지 않았는가?
   - 페르소나 단어를 되살리지 않았는가? (ADR-067)
3. 결과에 따라 `phases/admob-banner-ads/index.json` 의 step 7 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` (updatedAt 값, 섹션 수, 갱신 문서 목록)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- `docs/privacy-policy.html`, `docs/PRIVACY.md` 를 직접 편집하지 마라. 이유: ADR-072 — 드리프트 테스트가 CI 에서 실패한다.
- §K 정본 문구를 "개선" 하지 마라. 이유: 법적 문서이며 사용자가 승인한 문구다. 오탈자가 의심되면 summary 에 적고 그대로 둔다.
- `app/privacy.tsx` 를 수정하지 마라. 이유: 화면은 JSON 을 그대로 렌더하므로 변경이 필요 없다. 섹션 8개가 렌더되는지는 기존 화면 테스트가 커버한다 — 화면 테스트가 섹션 수를 하드코딩했다면 그 단언만 갱신.
- `docs/ARCHITECTURE.md`, `CLAUDE.md`, `docs/adr/011-*`, ADR-077 을 만들거나 수정하지 마라. 이유: step 8 의 범위.
- `app.json`, `eas.json` 을 수정하지 마라. 이유: step 9 의 범위.
- 기존 테스트를 깨뜨리지 마라.
