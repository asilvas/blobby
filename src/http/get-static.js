const fs = require('fs');
const compressFile = require('./compress-file');
const crypto = require('crypto');
const path = require('path');

/* Static `files` is an experimental (read: undocumented)
   feature and should not be used at this time.
*/

let gCompiledTests;

module.exports = (argv, config, opts) => {
  const { req, res, urlInfo, contentType } = opts;
  const { staticFiles } = config;
  if (!staticFiles) return false; // disabled
  gCompiledTests = gCompiledTests || getCompiledTests(argv, staticFiles);
  for (let i = 0; i < gCompiledTests.length; i++) {
    const t = gCompiledTests[i];
    const result = t.test.exec(urlInfo.pathname);
    const filename = result && result[1];
    if (!filename) continue;

    processFile(t, filename, opts);

    return true; // route match, process static request
  }

  return false; // no matches, continue
};

function getCompiledTests(argv, staticFiles) {
  return Object.keys(staticFiles).map(k => {
    const t = staticFiles[k];
    const test = typeof t.test === 'string' ? new RegExp(t.test) : t.test; // convert string to expression, otherwise use as-is
    const absPath = path.resolve(t.path); // resolve file once

    return { test, path: absPath };
  });
}

function processFile(test, filename, opts) {
  const { headers, res, urlInfo, contentType, client } = opts;

  getFileData(test, filename, (err, headers, data) => {
    if (err) {
      client.emit('error', { status: 404, message: `Static route error: ${urlInfo.pathname}`, stack: err.stack || err });
      res.statusCode = 404;
      return void res.end();
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('ETag', headers.ETag);

    // if etag match, respond with 304
    const isMatch = (headers['if-none-match'] && headers.ETag && headers['if-none-match'] === headers.ETag);
    if (isMatch) {
      res.statusCode = 304;
      return void res.end();
    }

    opts.headers = headers;
    opts.realContentType = contentType;
    opts.data = data;
    if (!compressFile(opts)) {
      // if not compressed, handle uncompressed response
      res.end(data);
    }
  });
}

function getFileData(test, filename, cb) {
  const fullPath = path.join(test.path, filename);
  fs.readFile(fullPath, (err, data) => {
    if (err) return void cb(err);

    // compute etag
    const ETag = crypto.createHash('md5').update(data).digest('hex');
    const Size = typeof data === 'string' ? Buffer.byteLength(data) : data.length;

    cb(null, { ETag, Size }, data);
  });
}
