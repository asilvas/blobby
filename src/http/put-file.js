const setHeaders = require('./set-headers');

module.exports = async opts => {
  const { client, storage, fileKey, req, res, isAuthorized } = opts;
  let err;

  if (!isAuthorized) {
    err = new Error('Unauthorized to PUT file');
    err.statusCode = 403;
    throw err;
  }

  try {
    const fileData = await getUploadData(req, storage);
    const headers = await client.putFile(storage, fileKey, { buffer: fileData }, opts);
    opts.realContentType = headers.ContentType;
    opts.headers = headers;
    res.statusCode = 204;
    setHeaders(opts);
    res.end();
  } catch (ex) {
    err = new Error(`PUT ${storage.id}/${fileKey} failed with ${ex.statusCode}, err: ${ex.stack || ex}`);
    err.statusCode = ex.statusCode || 400;
    throw err;
  }
};

function getUploadData(req, storage) {
  return new Promise((resolve, reject) => {
    const bufs = [];
    req.on('data', function (chunk) {
      bufs.push(chunk);
    });

    req.on('end', function () {
      const buffer = Buffer.concat(bufs);
      if (storage.config.maxUploadSize && buffer.length > storage.config.maxUploadSize) {
        const maxUploadMsg = `Max upload size of ${storage.config.maxUploadSize}B exceeded`;
        const maxUploadErr = new Error(maxUploadMsg);
        maxUploadErr.statusCode = 413;
        maxUploadErr.statusMessage = maxUploadMsg;
        return void reject(maxUploadErr);
      }

      resolve(buffer);
    });

    req.on('error', err => reject(err));
  });
}
