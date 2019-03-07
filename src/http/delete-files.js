const compressFile = require('./compress-file');

module.exports = async opts => {
  const { client, storage, req, res, isAuthorized } = opts;
  const fileKey = opts.fileKey.substr(0, opts.fileKey.length - 1);
  let err;

  if (!isAuthorized) {
    err = new Error('Unauthorized to DELETE files');
    err.statusCode = 403;
    throw err;
  }

  const query = req.query || {};

  try {
    const filesDeleted = await client.deleteFiles(storage, fileKey, { waitForReplicas: query.waitForReplicas !== '0' });
    const fileList = {
      fileKey,
      filesDeleted
    };

    const json = JSON.stringify(fileList);

    opts.realContentType = 'application/json';
    opts.headers = { Size: Buffer.byteLength(json) };
    opts.data = json;
    if (!compressFile(opts)) {
      // if not compressed, handle uncompressed response
      res.setHeader('Content-Type', 'application/json');
      res.end(json);
    }
  } catch (ex) {
    err = new Error(`DELETE ${storage.id}/${fileKey} failed with ${ex.statusCode}, err: ${ex.message || ex}`);
    err.statusCode = ex.statusCode || 404; // default to not found if none provided
    throw err;
  }
};
