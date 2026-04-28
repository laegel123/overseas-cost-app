module.exports = function (api) {
  api.cache(true);
  const isTest = process.env.NODE_ENV === 'test';
  const isProd = process.env.NODE_ENV === 'production';
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind', reanimated: !isTest }],
      'nativewind/babel',
    ],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
          },
        },
      ],
      isProd && 'transform-remove-console',
    ].filter(Boolean),
  };
};
