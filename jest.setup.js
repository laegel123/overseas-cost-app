import 'react-native-gesture-handler/jestSetup';

// AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-font (모든 폰트 즉시 로딩 완료로 처리)
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn(() => Promise.resolve()),
  isLoaded: jest.fn(() => true),
}));

// expo-router (Stack/Tabs 가 children 렌더 + Screen subcomponent 양립 형태)
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }) => children,
  Stack: Object.assign(({ children }) => children, { Screen: () => null }),
  Tabs: Object.assign(({ children }) => children, { Screen: () => null }),
  Slot: ({ children }) => children,
  Redirect: () => null,
}));

// react-native-svg
jest.mock('react-native-svg', () => require('react-native-svg-mock'));

// react-native-safe-area-context — SafeAreaView / Provider 는 단순 children
// passthrough. NativeWind 가 RN View 를 transform 해서 mock 안에서 JSX 사용 시
// _ReactNativeCSSInterop 참조 오류가 나므로 자체 wrapping 없이 children 만 반환.
//
// useSafeAreaInsets 는 jest.fn().mockReturnValue 로 등록 — per-test 에서
// `mockReturnValueOnce(seInsets)` 같은 표준 jest API 사용 가능 (try/finally
// 보일러플레이트 불요). DEFAULT_INSETS 는 iPhone X 류 (top 47, bottom 14).
jest.mock('react-native-safe-area-context', () => {
  const DEFAULT_INSETS = { top: 47, bottom: 14, left: 0, right: 0 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: jest.fn().mockReturnValue(DEFAULT_INSETS),
    SafeAreaInsetsContext: {
      Consumer: ({ children }) => children(DEFAULT_INSETS),
    },
  };
});

// expo-splash-screen
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

// react-native-google-mobile-ads — 광고 SDK (ADR-077). default 는 `mobileAds()` 호출 형태를 흉내 낸다.
// initialize 는 호출 순서 검증용으로 factory 밖 변수 (jest 호이스팅 규칙상 `mock` 접두 필수).
const mockMobileAdsInitialize = jest.fn(async () => []);
jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: () => ({ initialize: mockMobileAdsInitialize }),
  AdsConsent: {
    gatherConsent: jest.fn(async () => ({ status: 'NOT_REQUIRED', canRequestAds: true })),
    getConsentInfo: jest.fn(async () => ({
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'NOT_REQUIRED',
    })),
    showPrivacyOptionsForm: jest.fn(async () => undefined),
    reset: jest.fn(),
  },
  // 테스트가 mock.calls[0][0].onAdLoaded() 로 로드/실패를 시뮬레이션. NativeWind 제약으로 JSX 미사용
  BannerAd: jest.fn(() => null),
  BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER' },
  TestIds: { ADAPTIVE_BANNER: 'ca-app-pub-3940256099942544/2435281174' },
}));

// react-native Linking (legacy path 보강)
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(() => Promise.resolve(true)),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
}));

// fakeTimers 기본 활성화 — TESTING.md §5.2
jest.useFakeTimers();
