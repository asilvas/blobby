import setHeaders from './set-headers';
import compressFile from './compress-file';

export default opts => {
  const { storage, fileKey, req, res, contentType, auth } = opts;
  auth(err => {
    const acl = err && !auth.skip ? 'public' : 'private'; // if auth fails, pass as public request

    storage.fetch(fileKey, { acl }, (err, headers, data) => {
      if (err) {
        res.statusCode = 404;
        return void res.end();
      }

      opts.realContentType = headers.ContentType && headers.ContentType !== 'binary/octet-stream' ? headers.ContentType : contentType;

      // if etag or last-modified suffice, respond with 304
      const isMatch = (req.headers['if-none-match'] && headers.ETag && req.headers['if-none-match'] === headers.ETag) || 
        (req.headers['if-last-modified'] && headers.LastModified && new Date(req.headers['if-last-modified']) >= headers.LastModified)
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
    });
  });

}
