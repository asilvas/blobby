const crypto = require('crypto');
const async = require('async');
const retry = require('../../util/retry');

module.exports = ({ argv, fileKey, srcHeaders, srcStorage, dstStorage }, cb) => {
  const retryOpts = { min: argv.retryMin, factor: argv.retryFactor, retries: argv.retryAttempts };
  retry(dstStorage.fetchInfo.bind(dstStorage, fileKey), retryOpts, (err, dstHeaders) => {
    if (err) return void cb(err);
    if (!dstHeaders) return void cb(new Error(`File ${fileKey} not found`));

    const etagMatch = (srcHeaders.ETag && dstHeaders.ETag)
      ? srcHeaders.ETag === dstHeaders.ETag
      : null
    ;
    const lastModifiedMatch = (!etagMatch && srcHeaders.LastModified && dstHeaders.LastModified)
      ? srcHeaders.LastModified.getTime() === dstHeaders.LastModified.getTime()
      : null
    ;
    let isMatch = (etagMatch || lastModifiedMatch) || null;

    if (srcHeaders.Size && dstHeaders.Size && srcHeaders.Size !== dstHeaders.Size) {
      // if Size differs, there's no reason to attempt hash
      isMatch = false;
    }

    // return now if we already know the answer (similar performance to fast mode)
    if (isMatch !== null) return void cb(null, isMatch, srcHeaders, dstHeaders);

    // if we get this far, we're having to a do a deep content hash analysis, which can be very slow

    async.parallel([
      cb => retry(srcStorage.fetch.bind(srcStorage, fileKey, {}), retryOpts, cb),
      cb => retry(dstStorage.fetch.bind(dstStorage, fileKey, {}), retryOpts, cb)
    ], (err, results) => {
      if (err) return void cb(err); // failed to fetch src & dst

      // md5 hash is sufficient for content compare
      const srcHash = crypto.createHash('md5').update(results[0].buffer).digest('hex');
      const dstHash = crypto.createHash('md5').update(results[1].buffer).digest('hex');

      // may as well pass the available computed etag's now that they're available
      // NOTE: ETag's may be determined a number of ways, this is only one method
      //       for sake of having the data available.
      srcHeaders.ETag = srcHash;
      dstHeaders.ETag = dstHash;

      cb(null, srcHash === dstHash, srcHeaders, dstHeaders);
    });
  });
};
