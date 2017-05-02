import setHeaders from './set-headers';

export default opts => {
  const { storage, fileKey, req, res, contentType } = opts;

  storage.fetchInfo(fileKey, (err, headers) => {
    if (err) {
      res.statusCode = 404;
      return void res.end();
    }

    opts.realContentType = headers.ContentType && headers.ContentType !== 'binary/octet-stream' ? headers.ContentType : contentType;
    opts.headers = headers;
    res.statusCode = 204;
    setHeaders(opts);
    res.end();
  });
}
