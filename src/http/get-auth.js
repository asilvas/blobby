import path from 'path';

const g_AuthDrivers = {};

export default opts => {
  const { config, storage, req, fileKey } = opts;
  if (!config.auth) return; // auth config not avail

  const storageConfig = config.storage[storage.id];
  const authId = storageConfig.auth;
  const authConfig = config.auth[authId];
  if (!authConfig) return; // no valid auth object detected

  const configAuthId = `${config.id}.${authId}`;
  let driver = g_AuthDrivers[configAuthId];
  if (driver) return getAuthHandler(req, fileKey, storage.id, authId, authConfig, driver); // already cached

  if (!driver) {
    let mod;
    try {
      // try the standard way first
      mod = require(authConfig.driver);
    } catch (ex) {
      // if relative path, resolve first
      // todo: make this flow more efficient for relative cases -- exception handling isn't ideal
      mod = require(path.resolve(authConfig.driver));
    }
    driver = mod.default || mod; // support ES Modules & CommonJS
    if (!driver) return console.error(`Unable to load auth driver ${authConfig.driver}`); // no driver detected
    g_AuthDrivers[configAuthId] = driver; // cache
  }

  return getAuthHandler(req, fileKey, storage.id, authId, authConfig, driver);
}

function getAuthHandler(req, fileKey, storageId, authId, authConfig, driver) {
  const handler = cb => {
    driver(req, storageId, fileKey, authConfig.options || {}, cb);
  };
  handler.id = authId;
  return handler;
}
