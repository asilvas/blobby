import setHeaders from './set-headers';

export default opts => {
  const { storage, fileKey, req, res, contentType, auth } = opts;

  auth(err => {
    const acl = err ? 'public' : 'private'; // if auth fails, pass as public request

    storage.fetchInfo(fileKey, { acl }, (err, headers) => {
      if (err) {
        res.statusCode = 404;
        return void res.end();
      }

      opts.realContentType = headers.ContentType && headers.ContentType !== 'binary/octet-stream' ? headers.ContentType : contentType;
      opts.headers = headers;
      res.statusCode = 204;
      setHeaders(opts);

      if (headers.Size) { // force Content-Length on HEAD
        res.setHeader('Content-Length', headers.Size);
      }

      res.end();
    });
  });
}
