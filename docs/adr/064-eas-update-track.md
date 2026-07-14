[← ADR 인덱스](../ADR.md)

# ADR-064: EAS Update(expo-updates) 도입 + 신규 개인 계정 대응 비공개 테스트 트랙 전환

> **상태**: Active

**컨텍스트:**

v1.0 Android 출시를 실제 진행하던 중 ADR-063 의 두 전제가 현실과 어긋났다.

1. ADR-063 은 `production` 프로필에 `channel: "production"` 만 박아두고 expo-updates 도입은 deferred 했으나, `eas build --profile production` 실행 시 EAS CLI 가 "channel 이 지정됐는데 expo-updates 가 없다" 며 빌드를 중단하고 설치 후 재실행을 요구했다. 즉 channel 을 박아둔 이상 expo-updates 설치는 사실상 필수였다.
2. ADR-063 의 `submit.production.android.track: "internal"` / `releaseStatus: "draft"` 는 출시 계정이 **2023-11 이후 생성된 개인 개발자 계정** 이라는 사실과 충돌. 이 계정 유형은 프로덕션 액세스 신청 전에 **비공개 테스트(Closed testing) 20명 × 14일 연속** 이 의무이고, internal testing 트랙은 이 14일 요건에 카운트되지 않는다.

**결정:**

1. **expo-updates(`~29.0.18`) 도입 + EAS Update 활성화.** `eas build` 가 자동 설치 + `app.json` 에 `updates.url` 구성 + EAS Update 채널/브랜치 `production` 생성. ADR-063 의 "EAS Update 도입 시점 deferred" 를 여기서 해소.
   - 효과: 심사 없이 JS/asset 패치를 `eas update --branch production` 으로 즉시 배포 가능. runtimeVersion `appVersion` 정책과 정합 (SDK 46+ / expo-updates ≥ 0.14.4 충족).
2. **Submit 트랙 전환: `track` `internal` → `alpha`(Closed testing), `releaseStatus` `draft` → `completed`.** 신규 개인 계정의 20×14 비공개 테스트 게이트 충족용. ADR-063 결정 #3 을 대체.
3. **첫 제출은 Play Console 수동 업로드.** service account 자동화(ADR-063 deferred)는 계속 보류 — 1회 업로드엔 수동이 단순.

**대안 검토:**

- (expo-updates 빼고 `channel` 도 제거): OTA 없이 가는 선택지였으나, channel 제거 자체가 또 다른 빌드 설정 변경 + 향후 OTA 도입 시 재빌드 필요. eas build 가 자동 설치까지 해준 김에 도입이 합리적.
- (트랙 internal 유지): 신규 개인 계정에서는 internal 이 14일 요건에 안 잡혀 프로덕션 액세스가 영영 안 열림 → 불가. alpha(closed) 필수.
- (releaseStatus draft 유지): 테스터에게 실제 배포되려면 completed 필요. draft 는 테스트 시계가 돌지 않음.

**결과 / 영향:**

- 출시 경로가 ADR-063 의 "internal draft → 콘솔 promote" 에서 **"closed testing 20×14 → 프로덕션 액세스 신청 → 프로덕션"** 으로 변경. 일정 하한 +2주.
- `package.json` / `package-lock.json` 에 expo-updates 추가, `app.json` 에 `updates.url` 추가, `eas.json` submit 블록 변경.
- 향후 OTA: `eas update --branch production` 즉시 사용 가능.
- 진행 추적은 `docs/RELEASE_CHECKLIST.md`.

**관련:** ADR-063 (대체: 결정 #3 + deferred EAS Update), RELEASE.md §4·§16, `eas.json`, `app.json`, `docs/RELEASE_CHECKLIST.md`.
