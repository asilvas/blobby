import { getConfigs } from '../config';
import getStorage from '../storage';
import getComparer from '../compare';
import Stats from '../stats';
import async from 'async';

export const command = 'repair <storage..>';
export const desc = 'Repair files between storage bindings and/or environments';
export const builder = {
  storage: {
    describe: 'Provide one or more storage bindings you wish to synchronize',
    type: 'array'
  }
};

export const handler = argv => {
  const stats = new Stats();

  const compareTasks = [];
  getConfigs(argv, (err, configs) => {
    if (err) return void console.error(err);

    let configStorages = {};
    // compare every config+storage combo against one another
    configs.forEach(config => {
      argv.storage.forEach(storage => {
        const configStorageId = `${config.id}.${storage}`;
        if (!configStorages[configStorageId]) {
          configStorages[configStorageId] = {
            id: configStorageId,
            config: config,
            storage: getStorage(config, storage)
          };
        }
      });
    });

    // turn hash into array
    configStorages = Object.keys(configStorages).map(id => configStorages[id]);

    configStorages.forEach(src => {
      if (argv.oneWay === true && src.storage.id !== argv.storage[0]) return; // do not create tasks for more than one source storage

      configStorages.forEach(dst => {
        if (src.id === dst.id) return; // do not create a task to compare itself, ignore

        compareTasks.push(getCompareTask(argv, src, dst, stats));
      });
    });

    if (compareTasks.length === 0) return void console.error('No repair tasks detected, see help');

    const statsTimer = setInterval(() => console.log(stats.toString() + '\nRepairing...'), 1000);
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
  const { mode, dir } = argv;
  const compareFiles = (err, files, dirs, lastKey) => {
    if (err) return void cb(err);

    const compareFileTasks = files.map(f => {
      return getCompareFileTask(f, mode, srcConfig, srcStorage, dstConfig, dstStorage, statInfo);
    });

    async.parallelLimit(compareFileTasks, 10, (err) => {
      if (err) return void cb(err);

      if (!lastKey) { // we're done, no more files to compare
        return void cb();
      }

      srcStorage.list(dir || '', { deepQuery: !dir, maxKeys: 5000, lastKey }, compareFiles);
    });
  };

  srcStorage.list(dir || '', { deepQuery: !dir, maxKeys: 5000 }, compareFiles);
}

function getCompareFileTask(file, mode, srcConfig, srcStorage, dstConfig, dstStorage, statInfo) {
  return cb => {
    getComparer(file.Key, file, srcStorage, dstStorage, mode, (err, isMatch, srcHeaders, dstHeaders) => {
      if (err || isMatch === false) {
        statInfo.diff(file.Size);
      } else {
        // is match
        statInfo.match(file.Size);

        cb();
        return;
      }

      // repair
      srcStorage.fetch(file.Key, (err, info, buffer) => {
        if (err) {
          // if we fail to repair, now record error
          statInfo.error(err);
          return void cb();
        }

        dstStorage.store(file.Key, { buffer, headers: info }, (err) => {
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
