import getStorage from '../storage';
import url from 'url';
import chalk from 'chalk';
import mimeTypes from 'mime-types';
import path from 'path';
import headFile from './head-file';
import getFile from './get-file';
import putFile from './put-file';
import deleteFile from './delete-file';
import getAuthHandler from './get-auth';

export default (argv, config) => {
  return (req, res) => {
    const urlInfo = url.parse(req.url, true, true);
    const pathParts = urlInfo.pathname.split('/');
    const storageId = pathParts[1];
    let storage;
    try {
      storage = getStorage(config, storageId);
    } catch (ex) {
      console.warn(chalk.yellow(ex));

      res.statusMessage = 'Invalid storage';
      res.statusCode = 404;
      return void res.end();
    }

    const fileKey = pathParts.slice(2).join('/');
    const contentType = mimeTypes.lookup(path.extname(fileKey)) || 'binary/octet-stream';
    const opts = { argv, config, storage, fileKey, urlInfo, req, res, contentType };
    opts.auth = getAuthHandler(opts);

    switch (req.method) {
      case 'HEAD':
        headFile(opts);
        break;
      case 'GET':
        getFile(opts);
        break;
      case 'PUT':
        putFile(opts);
        break;
      case 'DELETE':
        deleteFile(opts);
        break;
      default:
        console.error(chalk.red(`Invalid req.method ${req.method}`));
        res.writeHead(404);
        res.end();
        break;
    }
  }
}
