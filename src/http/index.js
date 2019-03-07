const url = require('url');
const chalk = require('chalk');
const mimeTypes = require('mime-types');
const path = require('path');
const headFile = require('./head-file');
const getStatic = require('./get-static');
const getFile = require('./get-file');
const getFiles = require('./get-files');
const putFile = require('./put-file');
const deleteFile = require('./delete-file');
const deleteFiles = require('./delete-files');
const getAuthHandler = require('./get-auth');
const BlobbyClient = require('blobby-client');

module.exports = (argv, config) => {
  const client = new BlobbyClient(argv, config);

  return async (req, res) => {
    if (typeof config.httpHandler === 'function') {
      if (config.httpHandler(req, res) === false) return; // if handled by parent ignore request
    }
    const urlInfo = url.parse(req.url, true, true);
    let safePathname;
    try {
      safePathname = decodeURI(urlInfo.pathname);
    } catch (ex) {
      console.error(chalk.red(`Cannot decodeURI ${urlInfo.pathname}, err: ${ex.stack || ex}`));
      res.writeHead(400); // bad request
      return void res.end();
    }
    const contentType = mimeTypes.lookup(path.extname(safePathname)) || 'binary/octet-stream';
    if (req.method === 'GET' && getStatic(argv, config, { req, res, urlInfo, contentType })) return; // handled by static handler
    const pathParts = safePathname.split('/');
    const storageId = pathParts[1];
    if (!storageId) { // root is healthcheck
      res.statusCode = 200;
      return void res.end();
    } else if (storageId === 'favicon.ico') { // benign, don't log
      res.statusCode = 404;
      return void res.end();
    }
    let storage;
    try {
      storage = client.getStorage(storageId);
    } catch (ex) {
      console.warn(chalk.yellow(ex.stack || ex));

      res.statusMessage = 'Invalid storage';
      res.statusCode = 404;
      return void res.end();
    }

    const fileKey = pathParts.slice(2).join('/');
    const opts = { isAuthorized: true, argv, config, client, storage, fileKey, urlInfo, req, res, contentType, headers: req.headers || req.getAllHeaders() };
    try {
      const auth = getAuthHandler(opts);
      if (auth) {
        opts.isAuthorized = await auth;
      }
      switch (req.method) {
        case 'HEAD':
          await headFile(opts);
          break;
        case 'GET':
          if (pathParts[pathParts.length - 1] === '') await getFiles(opts); // if path ends in `/` it's a directory request
          else await getFile(opts);
          break;
        case 'PUT':
          await putFile(opts);
          break;
        case 'DELETE':
          if (pathParts[pathParts.length - 1] === '') await deleteFiles(opts); // if path ends in `/` it's a directory request
          else await deleteFile(opts);
          break;
        default:
          console.error(chalk.red(`Unsupported req.method ${req.method}`));
          res.writeHead(404);
          res.end();
          break;
      }
    } catch (err) {
      const status = err.statusCode || 500;
      console.error(chalk[status >= 500 ? 'red' : 'yellow'](`Error ${status}:`, err.stack || err));
      res.statusCode = status;
      return void res.end();
    }
  };
};
