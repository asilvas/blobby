const zlib = require('zlib');

module.exports = ({ req, res, realContentType, headers, data }) => {
  const accept = req.headers['accept-encoding'] || '';
  const supportGzip = /\bgzip\b/.test(accept);
  const supportBrotli = /\bbr\b/.test(accept);
  const shouldCompress = 
    (supportGzip || supportBrotli)
    && !/^image|^binary/i.test(realContentType) && headers.Size >= 200 // gzipping below this size can make files bigger
  ;
  if (!shouldCompress) return false;

  let compressor, compressorOpts, contentEncoding;
  if (supportBrotli) {
    compressor = zlib.brotliCompress;
    contentEncoding = 'br';
    compressorOpts = {
      chunkSize: 32 * 1024,
      params: {
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length
      }
    }
  } else {
    compressor = zlib.gzip;
    contentEncoding = 'gzip';
    compressorOpts = null;
  }
  compressor(data, compressorOpts, function (err, compressBuffer) {
    if (err) {
      // if compression fails, log it and move on. no need to fail request
      return void res.end(data);
    }

    res.setHeader('Content-Encoding', contentEncoding);
    res.end(compressBuffer);
  });

  return true;
};
