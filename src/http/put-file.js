import async from 'async';
import getStorage from '../storage';
import getConfig from '../config/get-config-by-id';

export default opts => {
  const { auth, storage, fileKey, req, res, contentType, urlInfo } = opts;
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
  const fileInfo = { ContentType, CacheControl, AccessControl }; // storage file headers
  if (ETag) fileInfo.ETag = ETag;
  if (LastModified) fileInfo.LastModified = LastModified;

  const getReplicaTask = (replica, buffer) => {
    return cb => {
      writeToReplica(replica, fileKey, { headers: { ...fileInfo }, buffer }, opts, cb);
    }
  }

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
    fileData: cb => {
      const bufs = [];
      req.on('data', function (chunk) {
        bufs.push(chunk);
      });

      req.on('end', function () {
        const data = Buffer.concat(bufs);
        if (storage.config.maxUploadSize && data.length > storage.config.maxUploadSize) {

          const maxUploadMsg = `Max upload size of ${storage.config.maxUploadSize}B exceeded`;
          const maxUploadErr = new Error(maxUploadMsg);
          maxUploadErr.statusCode = 413;
          maxUploadErr.statusMessage = maxUploadMsg;
          return void cb(maxUploadErr);
        }

        cb(null, data);
      });

      req.on('error', err => {
        try {
          err.statusCode = 500;
          cb(err);
        } catch (ex) {
          cb(ex);
        }
      });      
    },
    writeMaster: ['authorize', 'fileData', (results, cb) => {
      storage.store(fileKey, { headers: fileInfo, buffer: results.fileData }, {}, cb);
    }],
    writeReplicas: ['authorize', 'fileData', (results, cb) => { // write in parallel to master
      if (!Array.isArray(storage.config.replicas) || storage.config.replicas.length === 0) return void cb(); // no replicas to write to

      const doNotWaitForReplicaSuccess = urlInfo.query.waitForReplicas === '0';
      if (doNotWaitForReplicaSuccess) cb(); // do not wait, but do NOT return yet either

      const replicaTasks = storage.config.replicas.map(replica => getReplicaTask(replica, results.fileData));

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

    // todo
    res.statusCode = 204; // no body for successful uploads
    res.end();
  });

}

function writeToReplica(replica, fileKey, file, opts, cb) {
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

      results.storage.store(fileKey, file, {}, cb);
    }]
  }, cb);
}
