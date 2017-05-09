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

    storage.removeDirectory(fileKey.substr(0, fileKey.length - 1), (err, filesDeleted) => {
      if (err) {
        res.statusCode = 404;
        return void res.end();
      }

      const fileList = {
        fileKey,
        filesDeleted
      };

      const json = JSON.stringify(fileList);

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
