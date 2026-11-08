[← ADR 인덱스](../ADR.md)

# ADR-081: 빌드 번호를 EAS 원격 관리 + production 자동 증가로 전환

**상태:** 채택 (2026-11-08)

**맥락:**

`eas.json` 이 `appVersionSource: "local"` 이라 iOS `buildNumber`·Android `versionCode` 를
`app.json` 에서 손으로 올려야 했다. App Store Connect 와 Play Console 은 같은 버전 안에서
이미 올린 빌드 번호의 재사용을 거부하므로, bump 를 잊으면 빌드를 다 마친 뒤 업로드
단계에서 실패한다. iOS 첫 출시(TestFlight 반복 업로드)를 앞두고 이 수작업이 늘어난다.

**결정:**

- `cli.appVersionSource` 를 **`remote`** 로 바꾼다 — 빌드 번호의 정본이 EAS 서버가 된다.
- `production` 프로필에 **`autoIncrement: true`** — 스토어 빌드마다 EAS 가 번호를 올린다.
- 사용자 노출 버전(`expo.version`, 예: 1.1.0)은 계속 `app.json` 에서 관리한다
  (`runtimeVersion.policy = appVersion` 의 OTA 호환 키이기도 하다).
- `app.json` 의 `ios.buildNumber`·`android.versionCode` 는 남겨 둔다. 원격 값이 없는 첫
  빌드에서 EAS 가 이 로컬 값으로 초기화하기 때문이다. 이후로는 무시된다.

**대안:**

- **local + `autoIncrement`** — EAS 가 빌드 시 `app.json` 을 고쳐 쓰므로 매 빌드 뒤 커밋이
  필요하고, 빠뜨리면 다음 빌드가 같은 번호로 돌아간다. 기각.
- **현행 유지(수동)** — 위 실패 모드 그대로. 기각.

**결과:**

- 현재 원격 값 확인·수정: `eas build:version:get` / `eas build:version:set`.
- `app.json` 의 `buildNumber`·`versionCode` 는 더 이상 실제 업로드 번호를 뜻하지 않는다.
- development·preview 프로필은 자동 증가하지 않는다(내부 배포라 스토어 제약 없음).
