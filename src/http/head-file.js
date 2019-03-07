const setHeaders = require('./set-headers');

module.exports = async opts => {
  const { client, storage, fileKey, res, contentType, isAuthorized } = opts;

  const acl = !isAuthorized ? 'public' : 'private'; // if auth fails, pass as public request

  try {
    const headers = await client.headFile(storage, fileKey, { acl });

    opts.realContentType = headers.ContentType && headers.ContentType !== 'binary/octet-stream' ? headers.ContentType : contentType;
    opts.headers = headers;
    res.statusCode = 204;
    setHeaders(opts);

    if (headers.Size) { // force Content-Length on HEAD
      res.setHeader('Content-Length', headers.Size);
    }

    res.end();
  } catch (err) {
    err.statusCode = 404;
    throw err;
  }

};
