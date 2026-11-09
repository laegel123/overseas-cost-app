# 출시 체크리스트 — 살까말까 v1.1.0 (App Store)

> **목적:** App Store 첫 출시 진행 상황과 실제 제출값을 기록하는 living 문서. 진행하면서 상태를 갱신한다.
>
> **현재 상태 (2026-11-09):** 심사 대기 (`Waiting for Review`). 수동 출시로 설정돼 있어 승인돼도 자동 공개되지 않는다.
>
> **Android:** `docs/RELEASE_CHECKLIST.md` 참조.

---

## 지금 남은 일

### 출시(Release This Version) 전 — 필수

- ⬜ **GDPR 동의 폼 확인** — EU 를 판매 국가에 포함했다. 2026-09-29 EEA 시험에서 폼이 뜨지 않았고(`status:OBTAINED`, `isConsentFormAvailable:false`) 원인은 추정(게시 반영 지연)에 그쳤다. AdMob 콘솔에서 GDPR 메시지 게시 상태·대상 iOS 앱을 확인하고 `docs/TESTING.md` §18.9 절차로 재시험한다.
- ⬜ **EU Trader 신고** — App Store Connect → Business → Compliance → Digital Services Act. 주소·전화번호·이메일이 EU 스토어에 공개된다. 판매 국가는 175개(EU 포함).

### 승인 후

- ⬜ `Release This Version` 클릭 (위 필수 항목 완료 후)
- ⬜ AdMob 콘솔에서 앱을 App Store 에 연결 → AdMob 앱 심사 통과 후 실제 광고 게재
- ⬜ 출시 앱을 설치한 기기는 AdMob 테스트 기기로 등록 (본인 광고 클릭은 무효 트래픽)

### 기한이 있는 후속

- ⬜ **Expo SDK 57+ 업그레이드 + UIScene 채택** — `sdk-54` 이미지 고정(ADR-080)은 Apple 이 업로드 최소 요건을 Xcode 27 로 올리면(예년 패턴상 2027-04 경) 제출을 통과하지 못한다.

---

## 완료 내역

### 빌드·서명

| 항목 | 값 |
|---|---|
| EAS 빌드 | `45591b38-5edc-457a-93fd-b8bfa2977fc4` (production) |
| 커밋 | `83c69db` |
| 버전 | 1.1.0 (빌드 번호 2, EAS 원격 관리 — ADR-081) |
| Xcode / SDK | 26.0 / `iphoneos26.0` — IPA 의 Info.plist 로 확인 (ADR-080) |
| 서명 | App Store 배포 프로필, 2027-11-09 만료. 인증서·프로필은 EAS 보관 |
| App Store Connect Apple ID | 6832399256 |

IPA 에서 함께 확인한 값: `ITSAppUsesNonExemptEncryption=false`, AdMob 실 App ID·배너 단위 ID, ATT 문구, SKAdNetwork 50개, 업데이트 채널 `production`.

### TestFlight 실기기 확인 (iOS 27, 2026-11-09, 사용자 확인)

- ✅ 실행 직후 크래시 없음
- ✅ 온보딩 어절 줄바꿈
- ✅ 도시 선택 후 ATT 팝업
- ✅ 화면 이동·깨짐 없음
- ✅ 홈·비교·상세 배너 영역
- ✅ 설정의 개인정보·출처 화면
- ✅ 비행기 모드 실행

### 첫 빌드 전 수정

- PR #63 — 빌드 이미지 고정, 암호화 면제, 빌드 번호 자동화, 페르소나 문구 제거, 스크린샷
- PR #67 — 한글 어절 줄바꿈, 출처명의 내부 ADR 번호 제거
- PR #68 — 잘못된 값을 쓰던 refresh fetcher 4건 수정 (ADR-082)

---

## App Store Connect 제출값

언어판은 한국어만 남겼다 (자동 생성된 English (U.S.) 삭제). 다음 버전은 이 값을 기준으로 수정한다.

| 항목 | 값 |
|---|---|
| 이름 | `살까말까 : 해외 생활비 비교` (`살까말까` 단독은 선점으로 보임 — 홈 화면 표시명은 `살까말까`) |
| 부제 | `서울 vs 해외, 한 달에 얼마?` |
| 카테고리 | Travel |
| 가격 | 무료 |
| 판매 국가 | 175개 (EU 포함) |
| 지원 URL | `https://github.com/laegel123/overseas-cost-app/issues` |
| 마케팅 URL | `https://laegel123.github.io` (`app-ads.txt` 도메인) |
| 개인정보 처리방침 URL | `https://laegel123.github.io/overseas-cost-app/privacy-policy.html` |
| 출시 방식 | 수동 |
| 스크린샷 | `store-assets/screenshots/ios-6.3/` 5장 (1206×2622, 입력 칸 요구 크기). 원본은 `ios-6.9/` |

**키워드**

```
유학,이민,워홀,해외취업,물가,월세,환율,생활비,밴쿠버,도쿄,런던,뉴욕
```

**프로모션 텍스트**

```
서울과 해외 20개 도시의 월세·식비·교통비를 원화로 1:1 비교하세요. 공공 통계를 바탕으로 출처까지 공개합니다.
```

**설명**

```
살까말까 — 서울 사는 한국인을 위한 해외 생활비 비교 앱.

"밴쿠버 유학 가면 한 달에 얼마 들까?"
"도쿄에서 일하면 서울보다 얼마나 더 들까?"

흩어진 정보를 서울 기준 1:1 비교로 정리해 드립니다.

■ 핵심 기능

• 서울 vs 해외 도시 1:1 비교
20개 해외 도시와 서울을 항목별로 나란히 비교합니다. 월세·식비·교통·학비·세금·비자 6개 항목의 차이를 한눈에 볼 수 있습니다.

• 내 상황에 맞는 한 달 예상 비용
기본 합계는 월세·식비·교통이며, 학비·세금·비자는 필요할 때 켜서 더할 수 있습니다.

• 즐겨찾기 · 최근 본 도시
관심 도시를 저장하고 최근 본 도시를 빠르게 다시 열어볼 수 있습니다.

• 원화 자동 환산
매일 갱신되는 환율로 비용을 원화로 환산합니다. 네트워크가 없으면 마지막 저장값으로 계산합니다.

■ 공개되는 출처

정부 통계, 공식 정부 페이지, 공식 교통공사, 공식 대학 페이지를 바탕으로 합니다. 일부 항목은 공식 자료를 바탕으로 한 추정치이며, 항목별 출처와 갱신일은 앱에서 확인할 수 있습니다.

■ 개인정보

회원가입과 로그인이 없습니다. 즐겨찾기와 최근 본 도시는 기기 안에만 저장됩니다. 배너 광고(Google AdMob)를 위해 광고 식별자 등이 Google에 전송되며, 자세한 내용은 개인정보 처리방침에서 확인할 수 있습니다.

■ 수록 도시 (서울 + 20개)

미국: 뉴욕 · 샌프란시스코 · 시애틀 · 로스앤젤레스 · 보스턴
캐나다: 밴쿠버 · 토론토 · 몬트리올
유럽: 런던 · 파리 · 베를린 · 뮌헨 · 암스테르담
아시아·중동: 도쿄 · 오사카 · 싱가포르 · 호치민 · 두바이
오세아니아: 시드니 · 멜버른

■ 알아두실 점

표시되는 정보는 참고용이며, 실제 비용은 시점·지역·개인 상황에 따라 다를 수 있습니다. 중요한 결정 전에는 공식 출처를 직접 확인해 주세요.

■ 문의

laegel1@gmail.com
```

### App Privacy (게시 완료)

수집 6종, 용도는 모두 Third-Party Advertising·Analytics. 데이터 유형은 Google Mobile Ads SDK 공식 공개 문서 기준이고, 사용자 연결·추적 여부는 문서에 대부분 없어 보수적으로 판단했다.

| 데이터 유형 | 사용자 연결 | 추적 |
|---|---|---|
| Device ID | 예 | 예 |
| Advertising Data | 예 | 예 |
| Product Interaction | 예 | 예 |
| Coarse Location | 예 | 예 |
| Performance Data | 예 | 게시본 확인 필요 |
| Crash Data | 아니요 | 게시본 확인 필요 |

게시 화면의 `Data Used to Track You` 에 Diagnostics 가 표시됐다. 넓게 고지한 쪽이라 유지했다. 광고 SDK 수집 항목이 바뀌면 이 표와 `src/lib/privacyPolicy.json` 을 함께 갱신한다 (ADR-077).

### 심사 메모

```
No account or login is required.

On first launch, select any city on the onboarding screen to open the comparison view.

The app shows Google AdMob banner ads on the Home, Compare, and Detail screens only. The App Tracking Transparency prompt appears through Google UMP around first launch. Declining tracking does not limit any feature. Banner ads may not appear during review if no ad is available; the layout is unaffected.

Cost data comes from public sources such as government statistics and official transit and university pages. Sources are shown in Settings and on each detail screen. Some values are estimates based on official figures and are labeled as such.
```

---

## 다음 빌드에서 주의할 점

- `eas build` 는 사용자 터미널에서 실행한다 (에이전트 셸에서 제출 단계가 멈춘 이력). 인증서·프로필은 EAS 저장본을 재사용한다.
- 로컬 Xcode 27 빌드는 iOS 27 실기기에서 실행되지 않는다. 실기기 검증은 TestFlight 로 한다 (ADR-080).
- EAS 가 만든 앱은 기본 언어가 영어이고 이름에 임의 문자가 붙을 수 있다. 이번 버전에서 정리했다.

## 알려진 후속

- `docs/store-metadata.md`(Play 용)의 설명에는 "실시간 환율", 데이터 전부 자동 갱신, 경쟁 서비스 이름 등 이번 제출본에서 고친 표현이 남아 있다.
- `ca_statcan` 실시간 CPI 재구현 (ADR-082), ONS 시리즈 404, `us_hud` 토큰 부재.
