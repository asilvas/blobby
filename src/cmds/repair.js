const BlobbyClient = require('blobby-client');
const async = require('async');
const getComparer = require('../compare');
const Stats = require('../stats');
const shouldExecuteTask = require('./util/should-execute-task');
const getConfigStoragePairs = require('./util/get-config-storage-pairs');
const retry = require('../util/retry');

let gLastKey = '';

module.exports = {
  command: 'repair <storage..>',
  desc: 'Repair files between storage bindings and/or environments',
  builder: {
    storage: {
      describe: 'Provide one or more storage bindings you wish to synchronize',
      type: 'array'
    }
  },
  handler: async argv => {
    argv.logger = argv.logger || console;

    const stats = new Stats();

    const compareTasks = [];

    const configs = await BlobbyClient.getConfigs(argv);

    const configStorages = getConfigStoragePairs(argv, configs);
    configStorages.forEach(src => {
      configStorages.forEach(dst => {
        if (!shouldExecuteTask(argv, src, dst)) return; // exclude task

        compareTasks.push(getCompareTask(argv, src, dst, stats));
      });
    });

    if (compareTasks.length === 0) return void argv.logger.error('No repair tasks detected, see help');

    const statsTimer = setInterval(() => argv.logger.log(`LastKey: ${gLastKey}\n${!argv.silent && stats.toString()}\nRepairing...`), 5000);
    statsTimer.unref();

    return new Promise(resolve => {
      // process all comparisons
      async.series(compareTasks, (err, results) => {
        clearInterval(statsTimer);
        !argv.silent && argv.logger.log(stats.toString());

        if (err) {
          argv.logger.error('File repair has failed, aborting...', err.stack || err);
        } else {
          argv.logger.log('Repair complete');
        }

        resolve();
      });
    });
  }
};

function getCompareTask(argv, src, dst, stats) {
  const statInfo = stats.getStats(src.config, src.storage, dst.config, dst.storage);

  return cb => {
    statInfo.running();
    compare({ argv, srcConfig: src.config, srcStorage: src.storage, dstConfig: dst.config, dstStorage: dst.storage, statInfo }, (err) => {
      statInfo.complete();

      if (err) {
        argv.logger.error('Repair failure:', err.stack || err); // log only, do not abort repair
      }

      cb();
    });
  };
}

function compare({ argv, srcConfig, srcStorage, dstConfig, dstStorage, statInfo }, cb) {
  const { dir } = argv;
  const compareFiles = (err, files, dirs, lastKey) => {
    if (err) return void cb(err);
    gLastKey = lastKey;
    const compareFileTasks = files.map(f => {
      return getCompareFileTask({ file: f, argv, srcConfig, srcStorage, dstConfig, dstStorage, statInfo });
    });

    async.parallelLimit(compareFileTasks, argv.concurrency || 20, (err) => {
      if (err) return void cb(err);

      if (!lastKey) { // we're done, no more files to compare
        return void cb();
      }

      srcStorage.list(dir || '', { deepQuery: argv.recursive, maxKeys: 5000, lastKey }, compareFiles);
    });
  };

  srcStorage.list(dir || '', { deepQuery: argv.recursive, maxKeys: 5000, lastKey: argv.resumeKey }, compareFiles);
}

function getCompareFileTask({ file, argv, srcConfig, srcStorage, dstConfig, dstStorage, statInfo }) {
  const { mode, acl } = argv;
  return cb => {
    getComparer({ argv, fileKey: file.Key, srcHeaders: file, srcStorage, dstStorage, mode }, (err, isMatch, srcHeaders, dstHeaders) => {
      if (err || isMatch === false) {
        statInfo.diff(file);
      } else {
        // is match
        statInfo.match(file);

        cb();
        return;
      }

      const retryOpts = { min: argv.retryMin, factor: argv.retryFactor, retries: argv.retryAttempts };

      if (argv.removeGhosts && !dstHeaders) { // only perform removal if removeDiffs is true and the destination object does not exist
        const deltaMin = (Date.now() - file.LastModified.getTime()) / 60000 /* ms/min */;
        if (deltaMin < 60) {
          statInfo.error(new Error(`Cannot remove a difference newer than an hour: ${file.Key}`));
          return void cb();
        }

        return void retry(srcStorage.remove.bind(srcStorage, file.Key), retryOpts, err => {
          if (err) {
            // if we fail to repair, now record error
            statInfo.error(err);
            return void cb();
          }

          // flag as repaired
          statInfo.repair();
          cb();
        });
      }

      // repair
      retry(srcStorage.fetch.bind(srcStorage, file.Key), retryOpts, (err, info, buffer) => {
        if (err) {
          // if we fail to repair, now record error
          statInfo.error(err);
          return void cb();
        }

        info.AccessControl = info.AccessControl || acl; // apply default acl's if not available from source
        retry(dstStorage.store.bind(dstStorage, file.Key, { buffer, headers: info }), retryOpts, (err) => {
          if (err) {
            // if we fail to repair, now record error
            statInfo.error(err);
            return void cb();
          }

          // flag as repaired
          statInfo.repair();
          cb();
        });
      });
    });
  };
}
