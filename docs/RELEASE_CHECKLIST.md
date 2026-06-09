# 출시 체크리스트 — 살까말까 v1.0.0 (Google Play)

> **목적:** Google Play 출시까지 남은 단계를 한눈에 추적하는 living 문서. 진행하면서 상태를 갱신한다.
> **상태 표기:** ⬜ 미시작 · 🔄 진행 중 · ✅ 완료 · ⏳ 대기(외부 요인)
> **대상:** Google Play 우선 (iOS/App Store는 별도 진행). 계정: **신규 개인 계정** → 비공개 테스트 14일 게이트 적용.
> **마지막 갱신:** 2026-06-09

---

## ⚠️ 가장 중요한 사실 2가지
1. **스토어 등록정보(문구·이미지)만으로는 출시되지 않는다.** 서명된 AAB를 올려 릴리스를 만들고, "앱 콘텐츠" 선언을 끝내고, 심사를 통과해야 게시된다.
2. **신규 개인 계정**은 프로덕션 출시 전 **비공개 테스트(Closed testing)를 테스터 20명 이상으로 14일 연속** 운영해야 한다. 내부 테스트(internal)는 이 14일 요건에 **카운트되지 않는다.** → 지금부터 게시까지 현실적으로 **최소 3~4주**.

---

## 진행 현황

### 단계 0 — 사전 점검
- ✅ 개인정보처리방침 URL이 브라우저에서 실제로 열림 — **2026-06-09 확인**
  - 정본 본문: `docs/privacy-policy.html` → live: `https://laegel123.github.io/overseas-cost-app/privacy-policy.html` (정상 노출 — "개인정보 처리방침 · 살까말까")
  - GitHub Pages 서빙 정상 (`laegel123` 계정 확인됨; app.json owner `juno1001` 은 EAS 계정이라 별개 — 무관)
  - 인앱 "개인정보 처리방침" 메뉴 링크도 본 정본 URL 로 정렬됨 (ADR-065)
- ✅ EAS 로그인 확인 (`eas whoami` → `juno1001`)

### 단계 1 — 설정 파일 수정 (코드)
- ✅ `app.json` → `android.versionCode: 1` 추가
- ✅ `eas.json` → `submit.production.android.track`: `internal` → `alpha`(비공개 테스트), `releaseStatus`: `draft` → `completed`

### 단계 2 — Play Console "앱 콘텐츠" 선언 (콘솔)
등록정보 외에 아래가 모두 ✅ 되어야 릴리스 생성 가능. 답안은 `docs/store-metadata.md` §6~§8 참조.
- ⬜ 개인정보처리방침 URL 입력 (단계 0의 live URL)
- ⬜ 광고: **없음**
- ⬜ 앱 액세스 권한: 모든 기능 제한 없이 사용 가능 (로그인 없음)
- ⬜ 콘텐츠 등급 설문: 전부 "아니오" → 전체 이용가(3+)
- ⬜ 타겟층 및 콘텐츠: 13세+, 아동 대상 아님
- ⬜ 데이터 보안(Data Safety): **데이터 수집·공유 안 함** (ADR-009/011)
- ⬜ 정부 앱 / 금융 기능 / 건강: 모두 해당 없음
- ⬜ 등록정보 그래픽 업로드: 512 아이콘(`assets/icon-playstore-512.png`), 피처 그래픽(`assets/feature-graphic.png`), 스크린샷 5장(`store-assets/screenshots/`)

### 단계 3 — 프로덕션 AAB 빌드  ✅ 완료
- ✅ 빌드 완료 — ID `aaa0b047-645b-4a13-84fc-d1a764112092`, status `finished`, profile `production`, distribution `store`, versionCode 1
- ✅ 산출물 AAB: `https://expo.dev/artifacts/eas/n53VyxbNKPHFYMXeUTA6eL.aab`
- ✅ 실데이터 자동화 충족 (ADR-045 게이트) — `data/all.json` 이 fixture 아닌 실데이터(`generatedAt 2026-06-08`), GitHub Actions cron 가동 중(`data: weekly prices refresh` / `daily FX refresh`). 빌드 직전 fixture-시드 검출 게이트 통과.
- keystore: 기존 것 재사용(`Build Credentials dV0daWyC0p`, EAS 관리).
- 빌드 과정에서 `expo-updates`(~29.0.18) **자동 설치** + `app.json` `updates.url` 구성 + EAS Update 채널/브랜치 `production` 생성 (→ ADR-064).
- ⚠️ **빌드 제출 명령은 사용자 터미널에서 실행한다.** 에이전트 샌드박스 셸에서는 `eas build` 제출 단계가 반복 hang됨(fingerprint / credentials). 읽기 전용 `eas build:list` 는 정상. 재빌드 시:
  ```bash
  EAS_SKIP_AUTO_FINGERPRINT=1 eas build --profile production --platform android
  ```

### 단계 4 — 비공개 테스트 업로드 + 테스터 20명 × 14일 (게이트)  ← **현재 단계**
- ✅ AAB를 **비공개 테스트(Closed testing)** 트랙에 수동 업로드 + 릴리스 출시 완료 (Play Console)
- 🔄 테스터 **20명 이상** 등록(이메일/그룹) + opt-in 링크 공유 → 실제 옵트인 20명 확보  ← **지금 할 일**
- ⏳ **14일 연속** 운영 (옵트인 20명 유지)
- 테스트 시작일: _(20명 옵트인 시점 기록)_ → 신청 가능일: _(시작일 +14일)_

### 단계 5 — 프로덕션 액세스 신청 → 출시
- ⏳ 14일·20명 충족 후 콘솔에서 **"프로덕션 액세스 신청"** 작성·제출 → Google 검토(수일)
- ⬜ 승인 후 **프로덕션 트랙** 릴리스 생성(AAB 승격) → 단계적 출시(rollout) → 앱 심사 → **게시**

---

## 일정(현실치)
빌드/제출 1~2일 → 비공개 테스트 **14일 하한 + 테스터 20명 모집** → 프로덕션 액세스 검토 + 심사 수일~1주 → **지금부터 최소 약 3~4주**.

## 참고 문서
- `docs/store-metadata.md` — 등록정보 문구 + Data Safety/콘텐츠 등급 답안
- `docs/RELEASE.md` — 전체 릴리스 정책(버전·브랜치·자산·심사 거절 회피·PIPA)
- `docs/privacy-policy.html` / `docs/PRIVACY.md` — 개인정보처리방침
- `eas.json` / `app.json` — 빌드·제출 설정
