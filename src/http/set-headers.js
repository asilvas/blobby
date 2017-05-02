export default ({ storage, fileKey, urlInfo, res, headers, realContentType }) => {
  // always available
  res.setHeader('Content-Type', realContentType);

  if (headers.ETag) {
    res.setHeader('ETag', headers.ETag);
  }
  if (headers.LastModified) {
    res.setHeader('Last-Modified', headers.LastModified);
  }
  if (headers.CacheControl) { // object caching takes priority
    res.setHeader('Cache-Control', headers.CacheControl);
  } else if (storage.config.cacheControl) { // default to storage cache control
    res.setHeader('Cache-Control', storage.config.cacheControl);
  }

  if (urlInfo.query.download) {
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(fileKey)}"`);
  }
}
