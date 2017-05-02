import crypto from 'crypto';
import async from 'async';

export default (fileKey, srcHeaders, srcClient, dstClient, mode, cb) => {
  dstClient.fetchInfo(fileKey, (err, dstHeaders) => {
    if (err) return void cb(err);
    if (!dstHeaders) return void cb(new Error(`File ${fileKey} not found`));

    let isMatch = (
      (srcHeaders.ETag && dstHeaders.ETag) ? // use etag first if avail
      srcHeaders.ETag === dstHeaders.ETag :
      (srcHeaders.LastModified && dstHeaders.LastModified) ? // use last-modified 2nd if avail
      srcHeaders.LastModified.getTime() === dstHeaders.LastModified.getTime()
      : null /* default to unknown in deep mode if necessary headers not available */
    );

    if (srcHeaders.Size && dstHeaders.Size && srcHeaders.Size !== dstHeaders.Size) {
      // if Size differs, there's no reason to attempt hash
      isMatch = false;
    }

    // return now if we already know the answer (similar performance to fast mode)
    if (isMatch !== null) return void cb(null, isMatch, srcHeaders, dstHeaders);

    // if we get this far, we're having to a do a deep content hash analysis, which can be very slow

    async.parallel([
      cb => srcClient.fetch(fileKey, {}, cb),
      cb => dstClient.fetch(fileKey, {}, cb)
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
}
