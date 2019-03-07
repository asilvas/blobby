const retryFn = require('retry-fn');

function getTimeoutFn(min, factor) {
  return attempt => Math.max(min, (attempt - 1) * factor * min);
}

module.exports = function getRetryFn(fn, options, cb) {
  const { min = 1000, factor = 2, retries = 3 } = options;
  const timeout = getTimeoutFn(min, factor);

  const retry = retryFn.bind(null, { retries, timeout });

  retry(fn, cb);
};
