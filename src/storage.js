import path from 'path';
import fs from 'fs';

export default function getClient(config, storageId) {
  const storeConfig = config.storage[storageId];
  if (!storeConfig) throw new Error('Configuration not found for storage ' + storageId);
  storeConfig.cacheControl = storeConfig.cacheControl || 'public,max-age=31536000';
  const absPath = path.isAbsolute(storeConfig.driver) ? storeConfig.driver // already absolute path
    : path.resolve(process.cwd(), 'node_modules/' + storeConfig.driver) // typical 
  ;
  const mod = require(absPath);
  const Driver = mod.default || mod; // support ES Modules & CommonJS
  const instance = new Driver(storeConfig.options || {});
  instance.id = storageId;
  instance.config = storeConfig;

  return instance;
}
