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
