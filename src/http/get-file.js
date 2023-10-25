const setHeaders = require('./set-headers');
const compressFile = require('./compress-file');
const { parseDate } = require('../util/http-date');

module.exports = async opts => {
  const { client, storage, fileKey, res, contentType, isAuthorized } = opts;

  const acl = !isAuthorized ? 'public' : 'private'; // if auth fails, pass as public request
  let result;
  try {
    result = await client.getFile(storage, fileKey, { acl });
  } catch (err) {
    err.statusCode ||= 404;
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

  if (!compressFile(opts)) {
    // if not compressed, handle uncompressed response
    res.end(data);
  }

};
