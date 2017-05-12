import { getConfigs } from '../config';
import getStorage from '../storage';
import chalk from 'chalk';

export const command = 'shard <storage> <dir>';
export const desc = 'Look up the given shard for a given storage and path';
export const builder = {
  dir: {
    describe: 'Directory to lookup shard on',
    type: 'string'
  },
  storage: {
    describe: 'Storage to perform shard lookup on',
    type: 'string'
  }
};

export const handler = argv => {
  const compareTasks = [];
  getConfigs(argv, (err, configs) => {
    if (err) return void console.error(err);

    const storage = getStorage(configs[0], argv.storage);
    if ('getShard' in storage) {
      console.log('Shard:', chalk.green(storage.getShard(argv.dir)));
    } else {
      console.error(chalk.red(`"getShard" not supported on storage: ${storage.id}`));
    }
    
  });
};
