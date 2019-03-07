const compressFile = require('./compress-file');
const crypto = require('crypto');

module.exports = async opts => {
  const { client, storage, fileKey, res, urlInfo, isAuthorized, headers } = opts;

  if (!isAuthorized) {
    const err = new Error('Unauthorized to GET directory listings');
    err.statusCode = 403;
    throw err;
  }

  try {
    const maxKeys = parseInt(urlInfo.query.maxKeys || 5000, 10);
    const deepQuery = urlInfo.query.deepQuery === '1';
    const [files, dirs, lastKey] = await client.getFiles(storage, fileKey.substr(0, fileKey.length - 1), { lastKey: urlInfo.query.lastKey, maxKeys, deepQuery });

    const fileList = {
      fileKey,
      maxKeys,
      lastKey,
      deepQuery,
      files
    };

    const json = JSON.stringify(fileList);
    const etag = crypto.createHash('md5').update(json).digest('hex');

    res.setHeader('ETag', etag);

    // if etag or last-modified suffice, respond with 304
    const isMatch = (headers['if-none-match'] && headers['if-none-match'] === etag);

    if (isMatch) {
      // forward headers (again) as precaution
      res.statusCode = 304;
      return void res.end();
    }

    opts.realContentType = 'application/json';
    opts.headers = { Size: Buffer.byteLength(json) };
    opts.data = json;
    if (!compressFile(opts)) {
      // if not compressed, handle uncompressed response
      res.setHeader('Content-Type', 'application/json');
      res.end(json);
    }
  } catch (err) {
    err.statusCode = 404;
    throw err;
  }

};
