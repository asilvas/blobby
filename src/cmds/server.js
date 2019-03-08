const BlobbyClient = require('blobby-client');
const async = require('async');
const http = require('http');
const https = require('https');
const http2 = require('http2');
const httpServer = require('../http');
const chalk = require('chalk');
const Agent = require('agentkeepalive');
const HttpsAgent = Agent.HttpsAgent;
const fs = require('fs');

module.exports = {
  command: 'server',
  desc: 'Start HTTP API Server',
  builder: {
  },
  handler: async argv => {
    argv.logger = argv.logger || console;

    const [config] = await BlobbyClient.getConfigs(argv);

    if (!config.http) return void console.error('Config.http object required');
    const httpConfigs = Object.keys(config.http).map(k => {
      const httpConfig = config.http[k];
      return {
        port: httpConfig.port || 80,
        host: httpConfig.host,
        backlog: httpConfig.backlog || 511,
        ssl: httpConfig.ssl
      };
    });

    if (!httpConfigs.length) httpConfigs.push({ port: 80 });

    initializeGlobalAgents(config);

    const serverTasks = httpConfigs.map(httpConfig => createServerTask(argv, config, httpConfig));

    return new Promise(resolve => {
      async.series(serverTasks, (err, servers) => {
        if (err) {
          console.error('Failed to start server successfully');
          console.error(err.stack || err);
          console.error('Shutting down...');
          process.exit();
        }

        resolve(servers);
      });
    });
  }
};

function initializeGlobalAgents({ httpAgent }) {
  http.globalAgent = httpAgent === false ? false : new Agent(httpAgent);
  https.globalAgent = httpAgent === false ? false : new HttpsAgent(httpAgent);
}

function createServerTask(argv, config, httpConfig) {
  return cb => {
    async.parallel([
      cb => {
        if (!httpConfig.ssl || !httpConfig.ssl.pfx || typeof httpConfig.ssl.pfx !== 'string') return void cb();

        fs.readFile(httpConfig.ssl.pfx, 'utf8', (err, data) => {
          if (err) return void cb(err);

          httpConfig.ssl.pfx = data;

          cb();
        });
      },
      cb => {
        if (!httpConfig.ssl || !httpConfig.ssl.key || typeof httpConfig.ssl.key !== 'string') return void cb();

        fs.readFile(httpConfig.ssl.key, 'utf8', (err, data) => {
          if (err) return void cb(err);

          httpConfig.ssl.key = data;

          cb();
        });
      },
      cb => {
        if (!httpConfig.ssl || !httpConfig.ssl.cert || typeof httpConfig.ssl.cert !== 'string') return void cb();

        fs.readFile(httpConfig.ssl.cert, 'utf8', (err, data) => {
          if (err) return void cb(err);

          httpConfig.ssl.cert = data;

          cb();
        });
      }
    ], (err, results) => {
      if (err) return void console.error('Failed to create HTTP server:', httpConfig, err);

      if (httpConfig.ssl) {
        const server = http2.createServer(httpConfig.ssl, httpServer(argv, config));
        server.listen(httpConfig.port, httpConfig.host, httpConfig.backlog, err => {
          if (err) return void cb(err);

          console.log(chalk.green(`Listening on https://${httpConfig.host || 'localhost'}:${httpConfig.port}`));
          cb(null, server);
        });
      } else {
        const server = http.createServer(httpServer(argv, config));
        server.listen(httpConfig.port, httpConfig.host, err => {
          if (err) return void cb(err);

          console.log(chalk.green(`Listening on http://${httpConfig.host || 'localhost'}:${httpConfig.port}`));
          cb(null, server);
        });
      }
    });
  };
}
