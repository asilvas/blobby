const BlobbyClient = require('blobby-client');
const Stats = require('../stats');
const async = require('async');
const readStatsFile = require('./util/read-stats-file');
const writeStatsFile = require('./util/write-stats-file');

let gLastKey = '';

module.exports = {
  command: 'stats <storage..>',
  desc: 'Compute stats for storage bindings and/or environments',
  builder: {
    storage: {
      describe: 'Provide one or more storage bindings you wish to compute stats for',
      type: 'array'
    }
  },
  handler: async argv => {
    argv.logger = argv.logger || console;

    const stats = new Stats();

    if (argv.statsFile) {
      const info = readStatsFile(argv.statsFile);
      argv.resumeKey = info.lastKey || argv.resumeKey || '';
    }

    const tasks = [];
    const configs = await BlobbyClient.getConfigs(argv);

    let configStorages = {};
    // compare every config+storage combo against one another
    configs.forEach(config => {
      argv.storage.forEach(storage => {
        const configStorageId = `${config.id}.${storage}`;
        if (!configStorages[configStorageId]) {
          configStorages[configStorageId] = {
            id: configStorageId,
            config: config,
            storage: new BlobbyClient(argv, config).getStorage(storage)
          };
        }
      });
    });

    // turn hash into array
    configStorages = Object.keys(configStorages).map(id => configStorages[id]);

    configStorages.forEach(src => {
      tasks.push(getTask(argv, src, stats));
    });

    if (tasks.length === 0) return void argv.logger.error('No tasks detected, see help');

    const statsTimer = setInterval(() => {
      argv.logger.log(`LastKey: ${gLastKey}\n${(!argv.silent && stats.toString() + '\n') || ''}Computing stats...`);
      argv.statsFile && writeStatsFile(argv.statsFile, stats.toJSON());
    }, 5000);
    statsTimer.unref();

    return new Promise(resolve => {
      // process all comparisons
      async.series(tasks, (err, results) => {
        clearInterval(statsTimer);
        !argv.silent && argv.logger.log(stats.toString());
        argv.statsFile && writeStatsFile(argv.statsFile, stats.toJSON());

        if (err) {
          argv.logger.error('Stats has failed, aborting...', err);
        } else {
          argv.logger.log('Stats complete');
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
  const compareFiles = (err, files, dirs, lastKey) => {
    if (err) return void cb(err);
    gLastKey = lastKey;
    const dateMin = argv.dateMin && new Date(argv.dateMin);
    const dateMax = argv.dateMax && new Date(argv.dateMax);
    files.filter(f => {
      return (!dateMin || f.LastModified >= dateMin) && (!dateMax || f.LastModified <= dateMax);
    }).forEach(f => {
      statInfo.match(f);
    });

    if (!lastKey) { // we're done, no more files to compare
      return void cb();
    }

    srcStorage.list('', { deepQuery: argv.recursive, maxKeys: 5000, lastKey }, compareFiles);
  };

  srcStorage.list('', { deepQuery: argv.recursive, maxKeys: 5000, lastKey: argv.resumeKey }, compareFiles);
}
