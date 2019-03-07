const BlobbyClient = require('blobby-client');
const chalk = require('chalk');

module.exports = {
  command: 'shard <storage> <dir>',
  desc: 'Look up the given shard for a given storage and path',
  builder: {
    dir: {
      describe: 'Directory to lookup shard on',
      type: 'string'
    },
    storage: {
      describe: 'Storage to perform shard lookup on',
      type: 'string'
    }
  },
  handler: async argv => {
    argv.logger = argv.logger || console;

    const [config] = await BlobbyClient.getConfigs(argv);
    const client = new BlobbyClient(argv, config);
    const storage = client.getStorage(argv.storage);
    if ('getShard' in storage) {
      argv.logger.log('Shard:', chalk.green(storage.getShard(argv.dir)));
    } else {
      argv.logger.error(chalk.red(`"getShard" not supported on storage: ${storage.id}`));
    }
  }
};
