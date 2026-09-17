module.exports = {
  root: true,
  extends: [
    'expo',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import', 'react', 'react-native'],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
      'babel-module': {},
    },
  },
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    '@typescript-eslint/no-explicit-any': 'error',
    'react-native/no-color-literals': 'warn',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        pathGroups: [
          {
            pattern: 'react',
            group: 'builtin',
            position: 'before',
          },
          {
            pattern: 'react-native',
            group: 'builtin',
            position: 'before',
          },
          {
            pattern: 'expo',
            group: 'builtin',
            position: 'before',
          },
          {
            pattern: 'expo-*',
            group: 'builtin',
            position: 'before',
          },
          {
            pattern: '@/**',
            group: 'internal',
            position: 'before',
          },
        ],
        pathGroupsExcludedImportTypes: ['react', 'react-native'],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    'import/no-unresolved': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'react-native-google-mobile-ads',
            message:
              '광고 SDK 는 src/lib/ads.native.ts 와 src/components/AdBanner.native.tsx 만 import 한다 (ADR-077).',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['src/lib/ads.native.ts', 'src/components/AdBanner.native.tsx'],
      rules: { 'no-restricted-imports': 'off' },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    'dist/',
    'babel.config.js',
    'metro.config.js',
    'tailwind.config.js',
    'scripts/',
    'docs/design/hifi/',
    'jest.setup.js',
  ],
};
