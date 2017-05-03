import setHeaders from './set-headers';
import compressFile from './compress-file';
import crypto from 'crypto';

export default opts => {
  const { storage, fileKey, req, res, contentType, urlInfo, auth } = opts;

  if (!auth) { // auth required for get's for directory listings
    res.statusCode = 403;
    return void res.end();
  }

  auth(err => {
    if (err) {
      res.statusCode = 403;
      return void res.end();
    }

    const maxKeys = parseInt(urlInfo.query.maxKeys || 5000);
    const deepQuery = urlInfo.query.deepQuery === '1';
    storage.list(fileKey.substr(0, fileKey.length - 1), { lastKey: urlInfo.query.lastKey, maxKeys, deepQuery }, (err, files, dirs, lastKey) => {
      if (err) {
        res.statusCode = 404;
        return void res.end();
      }

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
      const isMatch = (req.headers['if-none-match'] && req.headers['if-none-match'] === etag);

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
    });
  });
}
