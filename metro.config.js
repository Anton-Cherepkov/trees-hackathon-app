const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add .wasm to the list of asset extensions
config.resolver.assetExts.push('wasm');

// Add .wasm to the list of source extensions
config.resolver.sourceExts.push('wasm');

// Custom resolver to handle wa-sqlite.wasm path
const originalResolverRequest = config.resolver.resolverMainFields;
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'wa-sqlite/wa-sqlite.wasm' &&
    context.originModulePath.includes('expo-sqlite/web/worker.ts')
  ) {
    return {
      filePath: path.resolve(__dirname, 'node_modules/wa-sqlite/dist/wa-sqlite.wasm'),
      type: 'sourceFile',
    };
  }
  
  // Fall back to the default resolver
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;