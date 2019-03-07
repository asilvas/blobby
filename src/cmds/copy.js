const { handler } = require('./repair');

module.exports = {
  command: 'copy <storage..>',
  desc: 'One-way copy of files between storage bindings and/or environments',
  builder: {
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
