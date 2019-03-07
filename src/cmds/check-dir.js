const { handler } = require('./compare');

module.exports = {
  command: 'checkdir <dir> <storage..>',
  desc: 'One-Way shallow directory compare between storage bindings and/or environments',
  builder: {
    dir: {
      describe: 'Directory to compare',
      type: 'string'
    },
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
