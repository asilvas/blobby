import { getConfigs } from '../config';
import getStorage from '../storage';
import getComparer from '../compare';
import Stats from '../stats';
import async from 'async';
import shouldExecuteTask from './util/should-execute-task';
import getConfigStoragePairs from './util/get-config-storage-pairs';
import retry from '../util/retry';

export const command = 'repair <storage..>';
export const desc = 'Repair files between storage bindings and/or environments';
export const builder = {
  storage: {
    describe: 'Provide one or more storage bindings you wish to synchronize',
    type: 'array'
  }
};

let gLastKey = '';

export const handler = argv => {
  const stats = new Stats();

  const compareTasks = [];
  getConfigs(argv, (err, configs) => {
    if (err) return void console.error(err);

    const configStorages = getConfigStoragePairs(argv, configs);
    configStorages.forEach(src => {
      configStorages.forEach(dst => {
        if (!shouldExecuteTask(argv, src, dst)) return; // exclude task

        compareTasks.push(getCompareTask(argv, src, dst, stats));
      });
    });

    if (compareTasks.length === 0) return void console.error('No repair tasks detected, see help');

    const statsTimer = setInterval(() => console.log(`LastKey: ${gLastKey}\n${stats.toString()}\nRepairing...`), 5000);
    statsTimer.unref();

    // process all comparisons
    async.series(compareTasks, (err, results) => {
      clearInterval(statsTimer);
      console.log(stats.toString());

      if (err) {
        console.error('File repair has failed, aborting...', err.stack || err);
      } else {
        console.log('Repair complete');
      }
    });
    
  });
};

function getCompareTask(argv, src, dst, stats) {
  const statInfo = stats.getStats(src.config, src.storage, dst.config, dst.storage);

  return cb => {
    statInfo.running();
    compare(argv, src.config, src.storage, dst.config, dst.storage, statInfo, (err) => {
      statInfo.complete();

      if (err) {
        console.error('Repair failure:', err.stack || err); // log only, do not abort repair
      }

      cb();
    });
  };
}

function compare(argv, srcConfig, srcStorage, dstConfig, dstStorage, statInfo, cb) {
  const { dir } = argv;
  const compareFiles = (err, files, dirs, lastKey) => {
    if (err) return void cb(err);
    gLastKey = lastKey;
    const compareFileTasks = files.map(f => {
      return getCompareFileTask(f, argv, srcConfig, srcStorage, dstConfig, dstStorage, statInfo);
    });

    async.parallelLimit(compareFileTasks, argv.concurrency || 20, (err) => {
      if (err) return void cb(err);

      if (!lastKey) { // we're done, no more files to compare
        return void cb();
      }

      srcStorage.list(dir || '', { deepQuery: argv.recursive, maxKeys: 5000, lastKey }, compareFiles);
    });
  };

  srcStorage.list(dir || '', { deepQuery: argv.recursive, maxKeys: 5000 }, compareFiles);
}

function getCompareFileTask(file, argv, srcConfig, srcStorage, dstConfig, dstStorage, statInfo) {
  const { mode, acl } = argv;
  return cb => {
    getComparer(argv, file.Key, file, srcStorage, dstStorage, mode, (err, isMatch, srcHeaders, dstHeaders) => {
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
        const delta_min = (Date.now() - file.LastModified.getTime()) / 60000 /* ms/min */;
        if (delta_min < 60) {
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
