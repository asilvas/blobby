import knox from 'knox';
import path from 'path';
import farmhash from 'farmhash';
import merge from 'merge';
import async from 'async';

export default class BlobbyS3 {
  constructor(opts) {
    this.options = merge({
      endpoint: 's3.amazonaws.com',
      port: 443,
      secure: true,
      style: 'path'
    }, opts);
  }

  initialize(cb) {
    const {bucketPrefix, bucketStart, bucketEnd} = this.options;

    const initBucketTasks = [];

    const $this = this;
    const getInitBucketTask = bucketIndex => {
      return cb => {
        const client = $this.getClient('', bucketIndex !== undefined ? bucketIndex : null);
        const req = client.request('PUT', '');
        req.on('response', res => cb());
        req.on('error', cb);
        req.end();
      }
    };

    const range = bucketEnd - bucketStart;
    if (!isNaN(range) && range > 0) {
      // sharded bucket mode
      for (let i = bucketStart; i <= bucketEnd; i++) {
        initBucketTasks.push(getInitBucketTask(i));
      }
    } else {
      // single bucket mode
      initBucketTasks.push(getInitBucketTask(bucketPrefix));
    }
    async.parallelLimit(initBucketTasks, 10, cb);
  }

  /*
    fileKey: unique id for storage
    opts: future
   */
  fetchInfo(fileKey, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = null;
    }
    opts = opts || {};
    const client = this.getClient(path.dirname(fileKey));

    client.headFile(fileKey, function (err, res) {
      if (err) {
        return void cb(err);
      }

      if (res.statusCode !== 200) {
        return void cb(new Error('storage.s3.fetch.error: '
          + res.statusCode + ' for ' + (client.urlBase + '/' + fileKey))
        );
      }

      cb(null, getInfoHeaders(res.headers));
    });
  }

  /*
    fileKey: unique id for storage
    opts: future
   */
  fetch(fileKey, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = null;
    }
    opts = opts || {};
    const client = this.getClient(path.dirname(fileKey));

    const bufs = [];
    client.getFile(fileKey, function (err, res) {
      if (err) {
        return void cb(err);
      }

      res.on('data', function (chunk) {
        bufs.push(chunk);
      });

      res.on('end', function () {
        if (res.statusCode !== 200) {
          return void cb(new Error('storage.s3.fetch.error: '
            + res.statusCode + ' for ' + (client.urlBase + '/' + fileKey))
          );
        }

        cb(null, getInfoHeaders(res.headers), Buffer.concat(bufs));
      });
    });
  }

  /*
   fileKey: unique id for storage
   file: file object
   file.buffer: Buffer containing file data
   file.headers: Any HTTP headers to supply to object
   opts: future
   */
  store(fileKey, file, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = null;
    }
    opts = opts || {};
    const client = this.getClient(path.dirname(fileKey));

    // NOTICE: unfortunately there is no known way of forcing S3 to persist the SOURCE ETag or LastModified, so comparing
    // between foreign sourges (S3 and FS) S3 will always report the file as different...

    client.putBuffer(file.buffer, fileKey, getHeadersFromInfo(file.headers), function (err, res) {
      if (err) {
        return void cb(err);
      }

      if (res.statusCode !== 200) {
        return void cb(new Error('storage.s3.store.error: '
          + res.statusCode + ' for ' + (client.urlBase + '/' + fileKey))
        );
      }

      cb();
    });
  }

  /*
   fileKey: unique id for storage
   */
  remove(fileKey, cb) {
    const client = this.getClient(path.dirname(fileKey));

    client.deleteFile(fileKey, function (err, res) {
      if (err) {
        return void cb(err);
      }

      if (res.statusCode !== 200 && res.statusCode !== 204) {
        return void cb(new Error(`S3.remove executed 2xx for ${fileKey} but got ${res.statusCode}`));
      }

      cb();
    });
  }

  /* supported options:
   dir: Directory (prefix) to query
   opts: Options object
   opts.lastKey: if requesting beyond maxKeys (paging)
   opts.maxKeys: the max keys to return in one request
   opts.deepQuery: true if you wish to query the world, not just the current directory
   cb(err, files, dirs, lastKey) - Callback fn
   cb.err: Error if any
   cb.files: An array of files: { Key, LastModified, ETag, Size, ... }
   cb.dirs: An array of dirs: [ 'a', 'b', 'c' ]
   cb.lastKey: An identifier to permit retrieval of next page of results, ala: 'abc'
  */
  list(dir, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = null;
    }
    opts = opts || {};

    const params = {
      prefix: dir,
      delimiter: opts.deepQuery ? '' : '/'
    };
    let forcedBucketIndex;
    const { bucketStart, bucketEnd } = this.options;
    if (opts.lastKey) {
      const lastKeySplit = opts.lastKey.split(':');
      forcedBucketIndex = parseInt(lastKeySplit[0]);
      if (lastKeySplit.length > 1) { // only set a (resume) marker if one was provided
        params.marker = lastKeySplit.slice(1).join(':'); // rebuild marker after removing index
      }
    } else if (typeof bucketStart === 'number' && typeof bucketEnd === 'number') {
      // if no key provided, default forcedBucketIndex
      forcedBucketIndex = bucketStart;
    }
    if (opts.maxKeys) params['max-keys'] = opts.maxKeys;

    const client = this.getClient(dir, forcedBucketIndex);    
    client.list(params, (err, data, data2) => {
      if (err) return cb(err);
      if (data.Code) return cb(new Error(data.Code));

      const files = data.Contents || [];
      // remove S3's tail delimiter
      const dirs = (data.CommonPrefixes || []).map(dir => dir.Prefix.substr(0, dir.Prefix.length - 1));

      let lastKey = data.IsTruncated ? (data.NextMarker || data.Contents[data.Contents.length - 1].Key) : null;
      if (!lastKey && typeof forcedBucketIndex === 'number' && forcedBucketIndex < bucketEnd) {
        // if out of keys, but not out of buckets, increment to next bucket
        lastKey = `${forcedBucketIndex + 1}:`;
      } else if (lastKey) {
        // prefix with bucket
        lastKey = `${forcedBucketIndex || ''}:${lastKey}`;
      }

      cb(null, files, dirs, lastKey);
    });
  }

  /*
   This is not a persisted client, so it's OK to create
   one instance per request.
  */
  getClient(dir, forcedIndex) {
    const {bucketPrefix, bucketStart, bucketEnd} = this.options;
    let bucket = bucketPrefix;
    const range = bucketEnd - bucketStart;
    if (!isNaN(range) && range > 0) {
      if (typeof forcedIndex === 'number' && forcedIndex >= bucketStart && forcedIndex <= bucketEnd) {
        // if forced index is provided, use that instead
        bucket += forcedIndex;
      } else { // compute bucket by dir hash
        // hash only needs to span directory structure, and is OK to be consistent
        // across environments for predictability and ease of maintenance
        const hash = farmhash.hash32(dir);
        const bucketIndex = hash % (range + 1); // 0-N
        bucket += (bucketStart + bucketIndex);
      }
    }

    return knox.createClient(merge({}, this.options, { bucket }));
  }
}

const gValidHeaders = {
  'last-modified': 'LastModified',
  'content-length': 'Size',
  'etag': 'ETag',
  'content-type': 'ContentType'
};
const gReverseHeaders = {
  ContentType: 'Content-Type'
}

function getInfoHeaders(reqHeaders) {
  const info = {};
  Object.keys(reqHeaders).forEach(k => {
    const kLower = k.toLowerCase();
    const validHeader = gValidHeaders[kLower];
    if (!validHeader) return;
    info[validHeader] = validHeader === 'LastModified' ? new Date(reqHeaders[k]) : reqHeaders[k]; // map the values
    if (validHeader === 'Size') info[validHeader] = parseInt(info[validHeader]); // number required for Size
  });

  return info;
}

function getHeadersFromInfo(info) {
  const headers = {};
  Object.keys(info).forEach(k => {
    const validHeader = gReverseHeaders[k];
    if (!validHeader) return;
    headers[validHeader] = info[k]; // map the values
  });

  return headers;
}