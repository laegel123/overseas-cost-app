[← ADR 인덱스](../ADR.md)

# ADR-053: 개발용 web 번들링 활성화 (`react-native-web` + `@expo/metro-runtime` + `react-dom`) — 출시 정책은 ADR-001 유지

**상태:** 채택 (2026-04-30)

**맥락:**

- ADR-001 은 "iOS·Android 네이티브 앱 우선, web/PWA 는 v2 이후" 로 **출시 채널** 을 정한 결정이다. 이는 Metro 의 web 번들링 자체를 금지한 것이 아니다.
- 개발 중 NativeWind v4 기본 `darkMode: 'media'` 가 web 미리보기에서 system color scheme 을 추적하다가 `Cannot manually set color scheme` 런타임 에러를 일으키는 것을 확인.
- Expo SDK 54 기준 web preview 는 `expo install react-dom react-native-web @expo/metro-runtime` 3종 패키지가 있어야 동작.

**결정:**

1. `@expo/metro-runtime`, `react-dom@19.1.0`, `react-native-web@^0.21` 을 정식 `dependencies` 로 추가. Expo 권장 위치이며, 네이티브 EAS Build 결과물에는 Metro 의 플랫폼 분기로 제외된다.
2. `tailwind.config.js` `darkMode: 'class'` 로 전환 — `'media'` 모드의 system scheme 추적 회피. ADR-016 (light 고정) 정책상 `dark` 클래스를 토글하지 않으므로 web/native 모두 항상 light.
3. `app.json` 에 `expo.web.bundler: 'metro'` 명시 — Expo SDK 54 의 기본값이지만 명시적 선언으로 향후 SDK 업그레이드·기여자 환경 차이에 따른 webpack fallback 회피.
4. **출시 채널 정책은 변경 없음** — App Store / Play Store 만 v1.0 출시 대상. 사용자 대상 web 배포는 v2 이후 별도 ADR 로 결정.
5. web 번들의 용도: 로컬 개발·QA 미리보기·hifi 디자인 대조용. 사용자에게 노출하지 않는다.

**대안 검토:**

- (A) web 비활성 유지 + tailwind 만 `'class'` 로 전환: NativeWind 가 web 환경을 인식 못 해 결국 같은 에러를 던질 수 있음. 또 web preview 는 hifi mock 과 빠르게 대조하는 1인 개발 흐름의 가치가 크다. 거부.
- (B) `darkMode: 'media'` 유지하고 web 만 따로 회피: NativeWind 내부 동작이라 우회 비용이 크다. 거부.

**결과 / 영향:**

- 네이티브 번들 (ADR-017 번들 예산 ≤5MB) 에 web 패키지가 포함되지 않으므로 영향 없음.
- 신규 개발자/기여자는 `npm run dev` → `w` 키로 web preview 가능.
- 향후 web/PWA 출시를 검토할 때는 본 ADR 의 "출시 정책 미변경" 을 명시적으로 새 ADR 에서 supersede 해야 함.

**관련:** ADR-001 (모바일 앱 우선 — 출시 채널 정책), ADR-016 (다크 모드 미지원), ADR-017 (번들 예산 — 본 변경 영향 없음).
