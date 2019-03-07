const compareModes = require('./modes');

module.exports = ({ argv, fileKey, srcHeaders, srcStorage, dstStorage, mode }, cb) => {
  const comparer = compareModes[mode];
  if (!comparer) {
    return void cb(new Error(`Compare mode ${mode} is not yet supported`));
  }

  comparer({ argv, fileKey, srcHeaders, srcStorage, dstStorage, mode }, cb);
};
