import retry from '../../util/retry';

export default (argv, fileKey, srcHeaders, srcClient, dstClient, mode, cb) => {
  const retryOpts = { min: argv.retryMin, factor: argv.retryFactor, retries: argv.retryAttempts };
  retry(dstClient.fetchInfo.bind(dstClient, fileKey), retryOpts, (err, dstHeaders) => {
    if (err) return void cb(err);
    if (!dstHeaders) return void cb(new Error(`File ${fileKey} not found`));

    const isMatch = (srcHeaders.Size && dstHeaders.Size)
      ? srcHeaders.Size === dstHeaders.Size // compare size, if available
      : true /* default to true in fast mode since we're intended for use with immutable storage */
    ;

    cb(null, isMatch, srcHeaders, dstHeaders);
  });
}
