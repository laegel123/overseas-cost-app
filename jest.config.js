module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/dist/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop))',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    // 다음은 후속 phase 의 책임 — 해당 phase 에서 활성화:
    //   'app/**/*.{ts,tsx}'  : app-shell phase (placeholder routes from bootstrap)
    //   'src/store/**'        : stores phase (zustand 영속화)
    //   'src/components/**'   : components phase (UI primitives)
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
    // src/components/**, app/** threshold 는 해당 phase 에서 재활성화.
    // global threshold 는 lib/store 만 측정 대상이라 의미 없어 제거.
  },
};
