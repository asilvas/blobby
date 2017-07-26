import getStorage from '../storage';
import url from 'url';
import chalk from 'chalk';
import mimeTypes from 'mime-types';
import path from 'path';
import headFile from './head-file';
import getStatic from './get-static';
import getFile from './get-file';
import getFiles from './get-files';
import putFile from './put-file';
import deleteFile from './delete-file';
import deleteFiles from './delete-files';
import getAuthHandler from './get-auth';

export default (argv, config) => {
  return (req, res) => {
    const urlInfo = url.parse(req.url, true, true);
    const contentType = mimeTypes.lookup(path.extname(urlInfo.pathname)) || 'binary/octet-stream';
    if (req.method === 'GET' && getStatic(argv, config, { req, res, urlInfo, contentType })) return; // handled by static handler
    const pathParts = urlInfo.pathname.split('/');
    const storageId = pathParts[1];
    if (!storageId) { // root is healthcheck
      res.statusCode = 204;
      return void res.end();
    } else if (storageId === 'favicon.ico') { // benign, don't log
      res.statusCode = 404;
      return void res.end();
    }
    let storage;
    try {
      storage = getStorage(config, storageId);
    } catch (ex) {
      console.warn(chalk.yellow(ex.stack || ex));

      res.statusMessage = 'Invalid storage';
      res.statusCode = 404;
      return void res.end();
    }

    const fileKey = pathParts.slice(2).join('/');
    const opts = { argv, config, storage, fileKey, urlInfo, req, res, contentType };
    opts.auth = getAuthHandler(opts);
    switch (req.method) {
      case 'HEAD':
        headFile(opts);
        break;
      case 'GET':
        if (pathParts[pathParts.length - 1] === '') getFiles(opts); // if path ends in `/` it's a directory request
        else getFile(opts);
        break;
      case 'PUT':
        putFile(opts);
        break;
      case 'DELETE':
        if (pathParts[pathParts.length - 1] === '') deleteFiles(opts); // if path ends in `/` it's a directory request
        else deleteFile(opts);
        break;
      default:
        console.error(chalk.red(`Invalid req.method ${req.method}`));
        res.writeHead(404);
        res.end();
        break;
    }
  }
}
