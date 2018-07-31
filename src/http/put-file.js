import async from 'async';
import getStorage from '../storage';
import getConfig from '../config/get-config-by-id';
import retry from '../util/retry';
import setHeaders from './set-headers';

export default opts => {
  const { auth, config, storage, fileKey, req, res, contentType, urlInfo } = opts;
  const { headers } = req;

  if (!auth) { // auth required for put's
    res.statusCode = 403;
    return void res.end();
  }

  // use request content-type if known, otherwise try to auto-detect
  const headerContentType = headers['content-type'];
  // use content-type provided by header if explicit enough, otherwise use format detected by extension
  const ContentType = (headerContentType && headerContentType !== 'binary/octet-stream' && headerContentType !== 'application/x-www-form-urlencoded') ? headerContentType : contentType;
  const ETag = headers['etag'];
  const LastModified = headers['last-modified'];
  // use request cache-control if avail, otherwise fallback storage setting
  const CacheControl = headers['cache-control'] || storage.config.cacheControl;
  const AccessControl = headers['x-amz-acl'] || storage.config.accessControl || 'public-read';
  const CopySource = headers['x-amz-copy-source'];
  const CopySupport = CopySource
    && typeof storage.copy === 'function'
    && storage.config.replicas.reduce((state, r) => !state ? false : typeof storage.copy === 'function', true)
  ; // all-or-nothing native copy support
  const CustomHeaders = {};
  Object.keys(headers).forEach(k => {
    const xHeader = /^x\-(.*)$/.exec(k);
    if (xHeader && k !== 'x-amz-acl') {
      CustomHeaders[xHeader[1]] = headers[k]; // forward custom headers
    }
  });
  const fileInfo = { ContentType, CacheControl, AccessControl, CustomHeaders }; // storage file headers
  if (ETag) fileInfo.ETag = ETag;
  if (LastModified) fileInfo.LastModified = LastModified;

  const getReplicaTask = (replica, file) => {
    return cb => {
      writeToReplica(replica, CopySource, fileKey, file, opts, cb);
    }
  };

  async.auto({
    authorize: cb => {
      auth(err => {
        if (err) {
          err.statusCode = 403; // specific status
          return void cb(err);
        }

        cb(); // OK
      });
    },
    copyFile: ['authorize', (results, cb) => {
      if (!CopySource || CopySupport) return void cb(null, { headers: fileInfo }); // if we are not copying, or have native copy support, no need for copy data

      storage.fetch(CopySource, { acl: 'private' }, (err, headers, buffer) => {
        if (err) {
          res.statusCode = 404;
          return void cb(err);
        }
  
        cb(null, { headers, buffer });
      });  
    }],
    file: ['copyFile', (results, cb) => {
      if (results.copyFile || CopySupport) {
        req.resume();
        return void cb(null, results.copyFile); // return now if copyData OR native copy support is provided
      }

      const bufs = [];
      req.on('data', function (chunk) {
        bufs.push(chunk);
      });

      req.on('end', function () {
        const buffer = Buffer.concat(bufs);
        if (storage.config.maxUploadSize && buffer.length > storage.config.maxUploadSize) {

          const maxUploadMsg = `Max upload size of ${storage.config.maxUploadSize}B exceeded`;
          const maxUploadErr = new Error(maxUploadMsg);
          maxUploadErr.statusCode = 413;
          maxUploadErr.statusMessage = maxUploadMsg;
          return void cb(maxUploadErr);
        }

        cb(null, { headers: fileInfo, buffer });
      });

      req.on('error', err => {
        try {
          err.statusCode = 500;
          cb(err);
        } catch (ex) {
          cb(ex);
        }
      });      
    }],
    writeMaster: ['authorize', 'file', (results, cb) => {
      const op = CopySource && storage.copy
        ? storage.copy.bind(storage, CopySource, fileKey, results.file.headers)
        : storage.store.bind(storage, fileKey, results.file, {})
      ;
      retry(op, config.retry, cb);
    }],
    writeReplicas: ['authorize', 'file', (results, cb) => { // write in parallel to master
      if (!Array.isArray(storage.config.replicas) || storage.config.replicas.length === 0) return void cb(); // no replicas to write to

      const doNotWaitForReplicaSuccess = urlInfo.query.waitForReplicas === '0';
      if (doNotWaitForReplicaSuccess) cb(); // do not wait, but do NOT return yet either

      const replicaTasks = storage.config.replicas.map(replica => getReplicaTask(replica, results.file));

      async.parallelLimit(replicaTasks, 5, err => {
        if (err) {
          err.statusCode = 502; // bad gateway if any replica write fails
          if (!doNotWaitForReplicaSuccess) cb(err); // failure only if query param not set
          else console.error('writeReplicas failed:', err.stack || err); // if no error passed on, at least record to stderr
        } else if (!doNotWaitForReplicaSuccess) cb(); // success only if query param not set
      });
    }]
  }, (err, results) => {
    if (err) { // if any writes fail, we fail
      res.statusCode = err.statusCode || 400; // default to request error if none provided
      if (err.statusMessage) res.statusMessage = err.statusMessage;
      console.error(`PUT ${storage.id}/${fileKey} failed with ${res.statusCode}, err: ${err.stack || err}`);
      return void res.end();
    }

    const headers = results.writeMaster || results.file.headers;
    opts.realContentType = headers.ContentType && headers.ContentType !== 'binary/octet-stream' ? headers.ContentType : ContentType;
    opts.headers = headers;
    res.statusCode = 204;
    setHeaders(opts);
    res.end();
  });

}

function writeToReplica(replica, sourceKey, destinationKey, file, opts, cb) {
  const { argv, config, req } = opts;
  const { headers } = req;
  const replicaSplit = replica.split('::');
  const configId = replicaSplit.length > 1 ? replicaSplit[0] : null;
  const storageId = replicaSplit.length > 1 ? replicaSplit[1] : replicaSplit[0];

  async.auto({
    config: cb => {
      if (!configId) return void cb(null, opts.config); // if no explicit config is requested, use current config

      getConfig(configId, argv, cb);
    },
    storage: ['config', (results, cb) => {
      try {
        const storage = getStorage(results.config, storageId);
        cb(null, storage);
      } catch (ex) {
        cb(ex);
      }
    }],
    write: ['storage', (results, cb) => {
      // use caching provided by the specific environment storage config
      file.headers.CacheControl = headers['cache-control'] || results.storage.config.cacheControl;

      const op = sourceKey && results.storage.copy // use copy if requested and supported
        ? results.storage.copy.bind(results.storage, sourceKey, destinationKey, file.headers)
        : results.storage.store.bind(results.storage, destinationKey, file, {})
      ;
      retry(op, results.config.retry, cb);
    }]
  }, cb);
}
