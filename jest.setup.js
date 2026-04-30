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
// useSafeAreaInsets 는 iPhone-X 류 기본값 (top 47, bottom 14) — per-test 로 갱신
// 가능. SafeArea 자체의 시각 동작은 라이브러리 책임.
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 47, bottom: 14, left: 0, right: 0 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => insets,
    SafeAreaInsetsContext: {
      Consumer: ({ children }) => children(insets),
    },
  };
});

// expo-splash-screen
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

// react-native Linking (legacy path 보강)
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(() => Promise.resolve(true)),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
}));

// fakeTimers 기본 활성화 — TESTING.md §5.2
jest.useFakeTimers();
