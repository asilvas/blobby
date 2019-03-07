const { handler } = require('./compare');

module.exports = {
  command: 'check <storage..>',
  desc: 'One-Way compare files between storage bindings and/or environments',
  builder: {
    storage: {
      describe: 'Provide one or more storage bindings you wish to compare',
      type: 'array'
    }
  },
  handler: argv => {
    argv.oneWay = true;
    argv.logger = argv.logger || console;

    return handler(argv);
  }
};
