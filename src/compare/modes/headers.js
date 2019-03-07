const retry = require('../../util/retry');

module.exports = ({ argv, fileKey, srcHeaders, dstStorage }, cb) => {
  const retryOpts = { min: argv.retryMin, factor: argv.retryFactor, retries: argv.retryAttempts };

  retry(dstStorage.fetchInfo.bind(dstStorage, fileKey), retryOpts, (err, dstHeaders) => {
    if (err) return void cb(err);
    if (!dstHeaders) return void cb(new Error(`File ${fileKey} not found`));

    const etagMatch = (srcHeaders.ETag && dstHeaders.ETag)
      ? srcHeaders.ETag === dstHeaders.ETag
      : false
    ;
    const lastModifiedMatch = (!etagMatch && srcHeaders.LastModified && dstHeaders.LastModified)
      ? srcHeaders.LastModified.getTime() === dstHeaders.LastModified.getTime()
      : false
    ;
    let isMatch = etagMatch || lastModifiedMatch;
    if (srcHeaders.Size && dstHeaders.Size && srcHeaders.Size !== dstHeaders.Size) {
      // if Size differs, there's no reason to attempt hash
      isMatch = false;
    }

    cb(null, isMatch, srcHeaders, dstHeaders);
  });
};
