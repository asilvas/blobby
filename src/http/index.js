const url = require('url');
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
const getOptions = require('./options');
const BlobbyClient = require('blobby-client');

module.exports = (argv, config) => {
  const client = new BlobbyClient(argv, config);

  if (typeof config.logger === 'object') {
    client.on('warn', msg => config.logger.warn(msg));
    client.on('error', msg => config.logger.error(msg));
  }

  return async (req, res) => {
    const urlInfo = url.parse(req.url, true, true);
    let safePathname;
    try {
      safePathname = decodeURI(urlInfo.pathname);
    } catch (ex) {
      client.emit('error', { message: `Cannot decodeURI ${urlInfo.pathname}`, stack: ex.stack || ex });

      res.writeHead(400); // bad request
      return void res.end();
    }
    try {
      // retained for backward compatibility
      safePathname = safePathname.split('/').map(decodeURIComponent).join('/');
    } catch (ex) {
      client.emit('warn', { message: `Cannot decodeURIComponent ${urlInfo.pathname}`, stack: ex.stack || ex });
    }
    const contentType = mimeTypes.lookup(path.extname(safePathname)) || 'binary/octet-stream';
    if (req.method === 'GET' && getStatic(argv, config, { req, res, urlInfo, contentType, client })) return; // handled by static handler
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
      client.emit('warn', { message: 'Storage exception', stack: ex.stack || ex });
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
        req.isAuthorized = opts.isAuthorized;
      }
      if (typeof config.httpHandler === 'function') {
        if (config.httpHandler(req, res) === false) return; // if handled by parent ignore request
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
        case 'OPTIONS':
          await getOptions(opts);
          break;
        default:
          client.emit('warn', { status: 404, message: `Unsupported req.method ${req.method}` });
          res.writeHead(404);
          res.end();
          break;
      }
    } catch (err) {
      const status = err.statusCode || 500;
      client.emit(status >= 500 ? 'error' : 'warn', { url: req.url, status: status, message: `Error ${status}`, stack: err.stack || err });
      res.statusCode = status;
      return void res.end();
    }
  };
};
