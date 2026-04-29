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
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/index.ts',
    '!**/__fixtures__/**',
    '!**/__tests__/**',
    '!**/__test-utils__/**',
  ],
  coverageThreshold: {
    global: { statements: 85, branches: 80, lines: 85, functions: 85 },
    'src/lib/**': { statements: 100, branches: 95, lines: 100, functions: 100 },
    'src/store/**': { statements: 100, branches: 90, lines: 100, functions: 100 },
    'src/components/**': { statements: 85, branches: 75, lines: 85, functions: 85 },
    'app/**': { statements: 75, branches: 65, lines: 75, functions: 75 },
  },
};
