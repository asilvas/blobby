export default (argv, fileKey, srcHeaders, srcClient, dstClient, mode, cb) => {
  setImmediate(() => cb(new Error('Forced mode prevents any match to force update')));
}
