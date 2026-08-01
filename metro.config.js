const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

// The backend lives in server/ with its own node_modules. Keep Metro from
// crawling or resolving into it.
config.resolver.blockList = [/\/server\/.*/];

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './src/uniwind-types.d.ts',
});
