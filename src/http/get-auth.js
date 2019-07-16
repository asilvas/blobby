const path = require('path');

const gAuthDrivers = {};

module.exports = opts => {
  const { config, storage, req, fileKey, client } = opts;
  if (!config.auth) return; // auth config not avail

  const authId = storage.config.auth;
  const authConfig = config.auth[authId];
  if (!authConfig) return; // no valid auth object detected

  const configAuthId = `${config.id}.${authId}`;
  let driver = gAuthDrivers[configAuthId];
  if (driver) return getAuthHandler({ req, fileKey, storageId: storage.id, authId, authConfig, driver }); // already cached

  if (!driver) {
    const absPath = path.isAbsolute(authConfig.driver) ? authConfig.driver // already absolute path
      : path.resolve(process.cwd(), 'node_modules/' + authConfig.driver) // typical
    ;
    const mod = require(absPath);
    driver = mod.default || mod; // support ES Modules & CommonJS
    if (!driver) return void client.emit('error', { message: `Unable to load auth driver ${authConfig.driver}` });
    gAuthDrivers[configAuthId] = driver; // cache
  }

  return getAuthHandler({ req, fileKey, storageId: storage.id, authId, authConfig, driver });
};

function getAuthHandler({ req, fileKey, storageId, authId, authConfig, driver }) {
  const handler = new Promise((resolve, reject) => {
    driver(req, storageId, fileKey, authConfig.options || {}, err => {
      if (err) {
        return void resolve(false); // not authorized
      }
      resolve(true); // authorized
    }).catch(reject);
  });
  handler.id = authId;
  handler.config = authConfig;
  return handler;
}
