const { handler } = require('./repair');

module.exports = {
  command: 'copydir <dir> <storage..>',
  desc: 'One-way shallow directory copy between storage bindings and/or environments',
  builder: {
    dir: {
      describe: 'Directory to copy',
      type: 'string'
    },
    storage: {
      describe: 'Provide two or more storage bindings you wish to synchronize',
      type: 'array'
    }
  },
  handler: argv => {
    argv.oneWay = true;
    argv.logger = argv.logger || console;

    return handler(argv);
  }
};
