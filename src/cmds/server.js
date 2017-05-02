import { getConfigs } from '../config';
import async from 'async';
import http from 'http';
import https from 'https';
import httpServer from '../http';
import chalk from 'chalk';

export const command = 'server';
export const desc = 'Start HTTP API Server';
export const builder = {
};

// disable connection pooling across the board -- we'll handle pooling if needed on a case by case basis
http.globalAgent = https.globalAgent = false;

export const handler = argv => {
  getConfigs(argv, (err, configs) => {
    if (err) return void console.error(err.stack || err);
    const config = configs[0];
    if (!config.http) return void console.error('Config.http object required');
    const httpConfigs = Object.keys(config.http).map(k => {
      const httpConfig = config.http[k];
      return {
        port: httpConfig.port || 80,
        host: httpConfig.host || 'localhost',
        backlog: httpConfig.backlog || 511,
        ssl: httpConfig.ssl
      };
    });

    if (!httpConfigs.length) httpConfigs.push({ port: 80 });

    const serverTasks = httpConfigs.map(httpConfig => createServerTask(argv, config, httpConfig));

    async.series(serverTasks, err => {
      if (err) {
        console.error('Failed to start server successfully');
        console.error(err.stack || err);
        console.error('Shutting down...');
        process.exit();
      }
    });
  });
};

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
        https.createServer(httpConfig.ssl, httpServer(argv, config)).listen(httpConfig.port, httpConfig.host, httpConfig.backlog, err => {
          if (err) return void cb(err);

          console.log(chalk.green(`Listening on https://${httpConfig.host}:${httpConfig.port}`));
        });
      } else {
        http.createServer(httpServer(argv, config)).listen(httpConfig.port, httpConfig.host, httpConfig.backlog, err => {
          if (err) return void cb(err);

          console.log(chalk.green(`Listening on http://${httpConfig.host}:${httpConfig.port}`));
        });
      }
    });
  };
}