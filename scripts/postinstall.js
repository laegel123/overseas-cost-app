// ADR-043: react-native-worklets 빈 plugin stub 생성.
// babel-preset-expo (SDK 52) 가 reanimated 플러그인 체인 안에서
// `react-native-worklets/plugin` 을 require 하지만, Expo SDK 52 의 명시적 의존성에는
// 빠져 있어 미설치 상태로 expo start 가 실패한다. 우리는 worklets 기능을
// 사용하지 않으므로 빈 stub 으로 require 만 통과시킨다.
// SDK 업그레이드 (53/54+) 시 정식 의존성으로 들어오면 본 파일과 ADR-043 폐기.
const fs = require('fs');
const path = require('path');

const workletsDir = path.join(__dirname, '../node_modules/react-native-worklets');

if (!fs.existsSync(workletsDir)) {
  fs.mkdirSync(workletsDir, { recursive: true });
}

fs.writeFileSync(
  path.join(workletsDir, 'plugin.js'),
  'module.exports = function() { return {}; };',
);

fs.writeFileSync(
  path.join(workletsDir, 'package.json'),
  JSON.stringify({ name: 'react-native-worklets', version: '0.0.0', main: 'plugin.js' }),
);
