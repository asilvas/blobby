const retry = require('../../util/retry');

module.exports = ({ argv, fileKey, srcHeaders, dstStorage }, cb) => {
  const retryOpts = { min: argv.retryMin, factor: argv.retryFactor, retries: argv.retryAttempts };
  retry(dstStorage.fetchInfo.bind(dstStorage, fileKey), retryOpts, (err, dstHeaders) => {
    if (err) return void cb(err);
    if (!dstHeaders) return void cb(new Error(`File ${fileKey} not found`));

    const isMatch = (srcHeaders.Size && dstHeaders.Size)
      ? srcHeaders.Size === dstHeaders.Size // compare size, if available
      : true /* default to true in fast mode since we're intended for use with immutable storage */
    ;

    cb(null, isMatch, srcHeaders, dstHeaders);
  });
};
