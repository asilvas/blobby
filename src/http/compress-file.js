import zlib from 'zlib';

export default ({req, res, realContentType, headers, data}) => {
  const accept = req.headers['accept-encoding'] || '';
  if (!/gzip/i.test(accept)) {
    // all browsers support gzip, use it or nothing at all
    return false;
  }
  const shouldGzip = !/^image|^binary/i.test(realContentType) && headers.Size >= 200; // gzipping below this size can make files bigger
  if (!shouldGzip) return false;

  zlib.gzip(data, function (err, gzipBuffer) {
    if (err) {
      // if compression fails, log it and move on. no need to fail request
      return void res.end(data);
    }

    res.setHeader('Content-Encoding', 'gzip');
    res.end(gzipBuffer);
  });

  return true;
}
