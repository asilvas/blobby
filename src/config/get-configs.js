import async from 'async';
import getConfig from './get-config-by-id';

export default (argv, cb) => {
  const configs = argv.config;

  if (configs.length === 0) {
    // if no config specified, use environment, or fallback to default
    configs.push(argv.configEnv in process.env ? process.env[argv.configEnv] : argv.configDefault);
  }

  const configLoadTasks = configs.map(configName => {
    return cb => getConfig(configName, argv, cb);
  });

  async.parallelLimit(configLoadTasks, 3, cb);
};
