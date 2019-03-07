const argv = require('./argv.json');
const logger = require('./logger');

module.exports = () => ({
  argv: { ... argv, logger },
  logger,
  authHeaders: {
    'Authorization': 'apiKey shhMySecret'
  }
});
