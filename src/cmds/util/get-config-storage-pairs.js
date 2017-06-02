import getStorage from '../../storage';

export default (argv, configs) => {
  const configStorages = {};
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
  return Object.keys(configStorages).map(id => configStorages[id]);
}
