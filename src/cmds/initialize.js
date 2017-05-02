import { getConfigs } from '../config';
import getStorage from '../storage';
import async from 'async';

export const command = 'initialize <storage..>';
export const desc = 'Perform any initialization tasks required by the given storage (ex: pre-creating bucket shards in S3)';
export const builder = {
  storage: {
    describe: 'Provide one or more storage bindings you wish to initialize',
    type: 'array'
  }
};

export const handler = argv => {
  const tasks = [];
  getConfigs(argv, (err, configs) => {
    if (err) return void console.error(err);

    let configStorages = {};
    // initialize every config+storage combo
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
      if (!src.storage.initialize) return void console.warn(`Skipping ${src.id} as storage does not support initialization...`);
      tasks.push(getInitializeTask(src));
    });

    if (tasks.length === 0) return void console.error('No initialization tasks detected, see help');

    // process all tasks
    async.series(tasks, (err, results) => {
      if (err) {
        console.error('Initialization has failed, aborting...', err);
      } else {
        console.log('Initialization complete');
      }
    });
    
  });
};

function getInitializeTask(src) {
  return cb => {
    console.log(`Initializing ${src.id}...`);
    src.storage.initialize(cb);
  };
}
