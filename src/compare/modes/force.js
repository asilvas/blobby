module.exports = (opts, cb) => {
  setImmediate(() => cb(new Error('Forced mode prevents any match to force update')));
};
