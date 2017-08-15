import configShield from 'config-shield';
import path from 'path';
import fs from 'fs';
import json5 from 'json5';
import merge from 'merge';
import async from 'async';
import defaultConfig from './default-config';

const gConfigs = {};

export default (configName, argv, cb) => {
  const configDir = path.resolve(argv.configDir);

  async.auto({
    baseConfig: cb => {
      if (!argv.configBase) return void cb(null, {}); // base config not specified, return now

      loadConfig(configDir, argv.configBase, argv, cb);
    },
    envConfig: cb => {
      loadConfig(configDir, configName, argv, cb);
    },
    secureConfig: cb => {
      if (!argv.secureConfig) return void cb(null, {}); // secure config not provided, skip this step
      if (!argv.secureFile) return void cb(new Error('secure-config requires associated secure-file. secure-secret not yet supported.'));

      const ext = path.extname(configName);
      const configId = path.basename(configName, ext);

      const secureConfig = configShield.load({
        instance: configId,
        configPath: path.join(argv.secureConfig, configId + '.json'),
        privateKeyPath: argv.secureFile
      }, (err) => {
        if (err) return void cb(err);

        const config = {};
        // merge secure config into base config
        secureConfig.getKeys().forEach(k => {
          config[k] = secureConfig.getProp(k);
        });

        cb(null, config);
      });
    }
  }, (err, results) => {
    if (err) return void cb(err);

    const finalConfig = merge.recursive({}, defaultConfig, results.baseConfig, results.envConfig, results.secureConfig);

    if (typeof finalConfig.httpHandler === 'string') {
      finalConfig.httpHandler = require(path.resolve(finalConfig.httpHandler)); // app-relative path
    }

    cb(null, finalConfig);
  });
};

function loadConfig(configDir, configName, argv, cb) {
  // IKNOWRIGHT:
  // there are some minor blocking calls in here, but they should be reasonable
  // being they are once-per-config calls. may refactor with async.auto later
  // to remove all blocking

  let ext = path.extname(configName);
  const configId = path.basename(configName, ext);
  const gConfig = gConfigs[configId];
  if (gConfig) return void cb(null, gConfig); // return global object if already avail  
  let absPath = path.join(configDir, configName);

  if (!ext) {
    // auto-detect
    for (var i = 0; i < argv.configExts.length; i++) {
      ext = argv.configExts[i];
      if (fs.existsSync(absPath + ext)) { // found
        absPath += ext;
        break;
      } else { // not found
        ext = null;
      }
    }
    if (!ext) { // ext not detected
      return void cb (new Error('Configuration not found: ' + absPath));
    }
  }

  let o;

  if (!/\.json5?/.test(ext)) {
    // perform require on commonJS

    try {
      o = require(absPath);
      o.id = configId;
      gConfigs[absPath] = o; // store in global object
      return void getSecureConfig(o, argv, cb);
    } catch (ex) {
      return void cb(ex);
    }
  }

  // for json/json5 files, utilize json5 loader

  fs.readFile(absPath, 'utf8', (err, data) => {
    if (err) return void cb(err);

    try {
      o = json5.parse(data);
      o.id = configId;
    } catch (ex) {
      return void cb(ex);
    }

    gConfigs[configId] = o; // store in global object
    cb(null, o);
  });
}
