const BlobbyClient = require('blobby-client');
const async = require('async');

module.exports = {
  command: 'initialize <storage..>',
  desc: 'Perform any initialization tasks required by the given storage (ex: pre-creating bucket shards in S3)',
  builder: {
    storage: {
      describe: 'Provide one or more storage bindings you wish to initialize',
      type: 'array'
    }
  },
  handler: async argv => {
    argv.logger = argv.logger || console;

    const tasks = [];

    const configs = await BlobbyClient.getConfigs(argv);

    let configStorages = {};
    // initialize every config+storage combo
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
      if (!src.storage.initialize) return void console.warn(`Skipping ${src.id} as storage does not support initialization...`);
      tasks.push(getInitializeTask(src));
    });

    if (tasks.length === 0) return void console.error('No initialization tasks detected, see help');

    return new Promise(resolve => {
      // process all tasks
      async.series(tasks, (err, results) => {
        if (err) {
          argv.logger.error('Initialization has failed, aborting...', err);
        } else {
          argv.logger.log('Initialization complete');
        }

        resolve();
      });
    });
  }
};

function getInitializeTask(src) {
  return cb => {
    console.log(`Initializing ${src.id}...`);
    src.storage.initialize(cb);
  };
}
