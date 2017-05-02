import path from 'path';
import fs from 'fs';

export default function getClient(config, storageId) {
  const storeConfig = config.storage[storageId];
  if (!storeConfig) throw new Error('Configuration not found for storage ' + storageId);
  storeConfig.cacheControl = storeConfig.cacheControl || 'public,max-age=31536000';

  let mod;
  try {
    // try the standard way first
    mod = require(storeConfig.driver);
  } catch (ex) {
    // if relative path, resolve first
    mod = require(path.resolve(storeConfig.driver));
  }
  const Driver = mod.default || mod; // support ES Modules & CommonJS
  const instance = new Driver(storeConfig.options || {});
  instance.id = storageId;
  instance.config = storeConfig;

  return instance;
}
