module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/dist/', 'scripts/refresh/__tests__/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // global.css (NativeWind) 는 metro/babel 에서 처리되며 jest 런타임에서는 빈 객체로 stub.
    '\\.css$': '<rootDir>/__mocks__/styleMock.js',
  },
  // ESM (.mjs) 스크립트 테스트 지원 (data-automation phase)
  transform: {
    '^.+\\.mjs$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node', 'mjs'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop))',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/index.ts',
    '!**/__fixtures__/**',
    '!**/__tests__/**',
    '!**/__test-utils__/**',
    // type-only / const-only 모듈 — 런타임 실행 0 이 정상
    '!src/types/**',
    '!src/theme/**',
  ],
  coverageThreshold: {
    'src/lib/**': { statements: 100, branches: 95, lines: 100, functions: 100 },
    'src/store/**': { statements: 100, branches: 90, lines: 100, functions: 100 },
    'src/components/**': { statements: 100, branches: 100, lines: 100, functions: 100 },
    // app/** threshold 는 화면 구현 phase 에서 재검토 — 현재는 RootLayout 만 있고
    // 부트로더 합성 로직이라 100% 가능하나 후속 화면 phase 가 라우트별 임계치를
    // 다시 정할 가능성이 커서 우선 미설정.
  },
};
