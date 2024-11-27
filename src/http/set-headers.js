const path = require('path');
const { formatDate } = require('../util/http-date');

module.exports = ({ storage, req, fileKey, urlInfo, res, headers, realContentType, config: { cors } }) => {
  // always available
  if (realContentType) res.setHeader('Content-Type', realContentType);

  if (headers.ETag) {
    res.setHeader('ETag', headers.ETag);
  }
  if (headers.LastModified) {
    res.setHeader('Last-Modified', formatDate(headers.LastModified));
  }
  if (headers.CacheControl) { // object caching takes priority
    res.setHeader('Cache-Control', headers.CacheControl);
  } else if (storage.config.cacheControl) { // default to storage cache control
    res.setHeader('Cache-Control', storage.config.cacheControl);
  }

  if (headers.CustomHeaders) { // custom headers may be stored on the object
    Object.keys(headers.CustomHeaders).forEach(k => {
      const v = headers.CustomHeaders[k];
      res.setHeader(`x-${k}`, v); // all custom headers are always forcefully prefixed
    });
  }

  if (urlInfo.query.download) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURI(path.basename(fileKey))}"`);
  }

  if (typeof cors === 'object') {
    // apply cors headers
    Object.keys(cors).forEach(key => res.setHeader(key, cors[key]));
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    res.setHeader('Accept-Ranges', 'bytes');
  }
};
