const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);
config.watchFolders = [path.resolve(projectRoot, '../../src/shared')];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
if (!config.resolver.assetExts.includes('wasm')) config.resolver.assetExts.push('wasm');
const previousMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const next = previousMiddleware ? previousMiddleware(middleware, server) : middleware;
  return (req, res, done) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return next(req, res, done);
  };
};
// Shared TypeScript uses Node ESM .js specifiers; Metro consumes the .ts sources.
const sharedRoot = path.resolve(projectRoot, '../../src/shared') + path.sep;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const sourceName = context.originModulePath.startsWith(sharedRoot) && moduleName.startsWith('.') && moduleName.endsWith('.js')
    ? moduleName.slice(0, -3) : moduleName;
  return context.resolveRequest(context, sourceName, platform);
};
module.exports = config;
