[← ADR 인덱스](../ADR.md)

# ADR-063: EAS Build 출시 전략 — Android 단독 v1.0 + 3개 프로필

> **상태**: Active

**컨텍스트:**

v1.0 출시를 앞두고 EAS Build/Submit 설정(`eas.json`)이 필요. 사이드 프로젝트 + 1차 페르소나가 한국 유학·취업자라는 점 + 출시 비용 최소화 요구가 얽혀 있다.

**결정:**

1. **Android 단독 v1.0** — Apple Developer Program $99/년 비용을 v1.x 까지 보류.
   - `app.json` 의 `ios.bundleIdentifier` 는 정의 유지 (식별자 선점), 다만 `eas.json` 에 iOS 프로필 미포함 → 실제 iOS 빌드/제출 발생 안 함.
   - iOS 프로필 정식 추가는 v1.x 에서 별도 ADR (Apple Developer 계정 + provisioning profile + TestFlight 흐름).
2. **EAS Build 3개 프로필** (RELEASE.md §3 명세 구현):
   - `development` — APK + dev client + `distribution: internal`. 시뮬레이터/실기기 dev.
   - `preview` — APK release + `distribution: internal`. 사이드로드 베타용 (Play Console 거치지 않는 빠른 배포).
   - `production` — AAB (`buildType: app-bundle`). Play Store 정식 업로드용.
3. **EAS Submit 정책**:
   - `submit.production.android.track: "internal"` — 첫 업로드는 항상 Internal testing.
   - `releaseStatus: "draft"` — 자동 공개 차단, 운영자가 콘솔에서 명시적 promote.
4. **`cli.appVersionSource: "local"`** — 버전은 `app.json` 단일 출처. EAS 클라우드 remote 버전 정책 미사용 (1인 운영에서는 명시적·예측 가능).
5. **EAS Update channel 사전 설정** — `production` 프로필에 `channel: "production"` 명시. v1.0 은 OTA 미사용이지만 v1.x OTA 도입 시 동일 빌드에 즉시 적용 (RELEASE.md §16).

**대안 검토:**

- (A 선택) Android 단독 + 3 프로필: 비용 0, 핵심 페르소나 디바이스 대응. iOS 는 v1.x.
- (B) iOS + Android 동시: $99 즉시 발생 + TestFlight/심사 추가 작업. 사이드 프로젝트 단계에서 과한 commit.
- (C) preview 도 AAB: Internal testing 도 AAB 가능하나, 사이드로드/지인 베타 단계에서는 APK 가 단순 (Play Console 거치지 않음). preview 와 production 의 분리가 명확.
- (D) Submit 자동화 미설정: 첫 빌드를 콘솔 수동 업로드. 가능하지만 service account 등록만 끝나면 자동화가 운영 부담을 줄임 → submit 섹션을 미리 박아둠.
- (E) `appVersionSource: "remote"`: EAS 가 buildNumber 자동 증가. 1인 운영에서는 local 이 명시적·예측 가능.
- (F) `channel` 미설정: v1.0 OTA 미사용이라 당장은 무관하나, 나중에 추가하려면 새 production 빌드 필요 (channel 은 빌드 시점에 박힘) → 미리 설정.

**결과 / 영향:**

- v1.0 베타·출시 전 과정이 무료 (Play Console $25 1회만).
- iOS 사용자는 v1.x 까지 대기 — 마케팅·커뮤니케이션에 명시 필요 (RELEASE.md §12 콜드스타트 채널의 한국인 유학·이주 카페에 노출 시 "Android 우선 출시" 표기).
- `eas build --profile preview --platform android` 로 베타 APK 즉시 생성, `eas build --profile production --platform android` 로 Play Store AAB 생성, `eas submit --platform android` 로 Internal track draft 자동 업로드.
- OTA 도입 시 `channel: "production"` 가 이미 있으므로 `eas update --branch production` 만 추가하면 됨.

**Deferred (v1.x):**

- iOS 프로필 추가 시 별도 ADR (Apple Developer 계정 + provisioning profile + TestFlight 흐름).
- `submit.production.android.serviceAccountKeyPath` — Play Console service account JSON 발급 후 `eas credentials` 로 EAS 클라우드에 보관.
- EAS Update 도입 시점 결정 (스키마 변경·UI 패치 빈도 가시화 후).

**관련:** RELEASE.md §3 (EAS 프로필), §4 (릴리스 절차), §16 (앱 업데이트 메커니즘), `eas.json`, `app.json`, PR #29.
