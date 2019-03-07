const BlobbyClient = require('blobby-client');
const Stats = require('../stats');
const async = require('async');
const getConfigStoragePairs = require('./util/get-config-storage-pairs');

let gLastKey = '';

module.exports = {
  command: 'acl <dir> <storage..>',
  desc: 'Set ACL\'s for a given directory for the given storage bindings and/or environments',
  builder: {
    dir: {
      describe: 'Directory to apply ACL\'s to',
      type: 'string'
    },
    storage: {
      describe: 'Provide two or more storage bindings you wish to synchronize',
      type: 'array'
    }
  },
  handler: async argv => {
    argv.logger = argv.logger || console;

    const stats = new Stats();

    const tasks = [];
    const configs = await BlobbyClient.getConfigs(argv);

    const configStorages = getConfigStoragePairs(argv, configs);
    configStorages.forEach(src => {
      tasks.push(getTask(argv, src, stats));
    });

    if (tasks.length === 0) return void argv.logger.error('No tasks detected, see help');

    const statsTimer = setInterval(() => argv.logger.log(`LastKey: ${gLastKey}\n${!argv.silent && stats.toString()}\nApplying ACL's...`), 5000);
    statsTimer.unref();

    return new Promise(resolve => {
      // process all comparisons
      async.series(tasks, (err, results) => {
        clearInterval(statsTimer);
        !argv.silent && argv.logger.log(stats.toString());

        if (err) {
          argv.logger.error('ACL\'s has failed, aborting...', err);
        } else {
          argv.logger.log('ACL\'s complete');
        }

        resolve();
      });
    });
  }
};

function getTask(argv, src, stats) {
  const statInfo = stats.getStats(src.config, src.storage);
  return cb => {
    statInfo.running();
    task({ argv, srcConfig: src.config, srcStorage: src.storage, statInfo }, err => {
      statInfo.complete();
      cb(err);
    });
  };
}

function task({ argv, srcConfig, srcStorage, statInfo }, cb) {
  const nextFiles = (err, files, dirs, lastKey) => {
    if (err) return void cb(err);
    gLastKey = lastKey;
    const fileTasks = files.map(f => getFileTask(f, argv.acl, srcStorage, statInfo));

    async.parallelLimit(fileTasks, argv.concurrency || 20, (err) => {
      if (err) return void cb(err);

      if (!lastKey) { // we're done, no more files
        return void cb();
      }

      srcStorage.list(argv.dir, { deepQuery: argv.recursive, maxKeys: 5000, lastKey }, nextFiles);
    });
  };

  srcStorage.list(argv.dir, { deepQuery: argv.recursive, maxKeys: 5000 }, nextFiles);
}

function getFileTask(file, acl, storage, statInfo) {
  statInfo.diff(file);

  return cb => {
    if (!storage.setACL) return void cb(new Error(`Storage ${storage.id} does not support required 'setACL'`));

    storage.setACL(file.Key, acl, err => {
      if (err) {
        statInfo.error(err);
        return void cb();
      }

      statInfo.repair();
      cb();
    });
  };
}
