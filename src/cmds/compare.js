const { getConfigs } = require('blobby-client');
const getComparer = require('../compare');
const Stats = require('../stats');
const async = require('async');
const shouldExecuteTask = require('./util/should-execute-task');
const getConfigStoragePairs = require('./util/get-config-storage-pairs');
const readStatsFile = require('./util/read-stats-file');
const writeStatsFile = require('./util/write-stats-file');

let gLastKey = '';

module.exports = {
  command: 'compare <storage..>',
  desc: 'Compare files between storage bindings and/or environments',
  builder: {
    storage: {
      describe: 'Provide one or more storage bindings you wish to compare',
      type: 'array'
    }
  },
  handler: async argv => {
    argv.logger = argv.logger || console;

    const stats = new Stats();

    if (argv.statsFile && !argv.resumeKey) {
      const info = readStatsFile(argv.statsFile);
      argv.resumeKey = info.lastKey || '';
    }

    const compareTasks = [];
    const configs = await getConfigs(argv);

    const configStorages = getConfigStoragePairs(argv, configs);
    configStorages.forEach(src => {
      configStorages.forEach(dst => {
        if (!shouldExecuteTask(argv, src, dst)) return; // exclude task

        compareTasks.push(getCompareTask(argv, src, dst, stats));
      });
    });

    if (compareTasks.length === 0) return void argv.logger.error('No comparison tasks detected, see help');

    const statsTimer = setInterval(() => {
      argv.logger.log(`LastKey: ${gLastKey}\n${(!argv.silent && stats.toString() + '\n') || ''}Comparing...`);
      argv.statsFile && writeStatsFile(argv.statsFile, stats.toJSON());
    }, 5000);
    statsTimer.unref();

    // process all comparisons
    return new Promise(resolve => {
      async.series(compareTasks, (err, results) => {
        clearInterval(statsTimer);
        !argv.silent && argv.logger.log(stats.toString());
        argv.statsFile && writeStatsFile(argv.statsFile, stats.toJSON());

        if (err) {
          argv.logger.error('File comparison has failed, aborting...', err);
        } else {
          argv.logger.log('Comparison complete');
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
        argv.logger.error('Compare failure:', err.stack || err); // log only, do not abort repair
      }

      cb();
    });
  };
}

function compare({ argv, srcConfig, srcStorage, dstConfig, dstStorage, statInfo }, cb) {
  const { mode, dir } = argv;
  const compareFiles = (err, files, dirs, lastKey) => {
    if (err) return void cb(err);
    gLastKey = lastKey;
    const dateMin = argv.dateMin && new Date(argv.dateMin);
    const dateMax = argv.dateMax && new Date(argv.dateMax);
    const compareFileTasks = files.filter(f => {
      return (!dateMin || f.LastModified >= dateMin) && (!dateMax || f.LastModified <= dateMax);
    }).map(f => {
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
  const { mode } = argv;
  return cb => {
    getComparer({ argv, fileKey: file.Key, srcHeaders: file, srcStorage, dstStorage, mode }, (err, isMatch, srcHeaders, dstHeaders) => {
      if (err || isMatch === false) {
        // errors are implied to be "not found", just track as difference
        statInfo.diff(file);
      } else {
        // is match
        statInfo.match(file);
      }

      cb();
    });
  };
}
