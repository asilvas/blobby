const setHeaders = require('./set-headers');
const compressFile = require('./compress-file');
const { parseDate } = require('../util/http-date');
const rangeParser = require('range-parser');

module.exports = async opts => {
  const { client, storage, fileKey, res, req, contentType, isAuthorized } = opts;

  const acl = !isAuthorized ? 'public' : 'private'; // if auth fails, pass as public request
  let result;
  try {
    result = await client.getFile(storage, fileKey, { acl });
  } catch (err) {
    err.statusCode = err.statusCode || 404;
    throw err;
  }

  const [headers, data] = result;

  opts.realContentType = headers.ContentType && headers.ContentType !== 'binary/octet-stream' ? headers.ContentType : contentType;

  // if etag or last-modified suffice, respond with 304
  const isMatch = (opts.headers['if-none-match'] && headers.ETag && opts.headers['if-none-match'] === headers.ETag) ||
    (opts.headers['if-last-modified'] && headers.LastModified && parseDate(opts.headers['if-last-modified']) >= headers.LastModified)
  ;

  opts.headers = headers;
  opts.data = data;

  setHeaders(opts);

  if (isMatch) {
    // forward headers (again) as precaution
    res.statusCode = 304;
    return void res.end();
  }

  if (req.headers.range) {
    const ranges = rangeParser(data.length, req.headers.range);

    if (ranges === -1 || ranges === -2) {
      res.statusCode = 206;
      res.setHeader('Content-Length', 0);
      return void res.end();
    }

    const range = ranges[0];
    const byteOffset = range.start;
    const byteLength = range.end - range.start + 1;

    res.statusCode = 206;
    res.setHeader('Content-Range', 'bytes ' + range.start + '-' + range.end + '/' + data.length);
    res.setHeader('Content-Length', byteLength);
    return void res.end(data.subarray(byteOffset, byteOffset + byteLength));
  }

  if (!compressFile(opts)) {
    // if not compressed, handle uncompressed response
    res.end(data);
  }

};
