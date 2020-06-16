module.exports = async opts => {
  const { client, storage, fileKey, req, res, isAuthorized } = opts;
  let err;

  if (!isAuthorized) {
    err = new Error('Unauthorized to DELETE file');
    err.statusCode = 403;
    throw err;
  }

  const query = req.query || {};

  try {
    await client.deleteFile(storage, fileKey, { waitForReplicas: query.waitForReplicas !== '0' });

    res.statusCode = 204; // no body for successful deletes
    res.end();
  } catch (ex) {
    err = new Error(`DELETE ${storage.id}/${fileKey} failed with ${ex.statusCode}, err: ${ex.stack || ex}`);
    err.statusCode = ex.statusCode || 404; // default to not found if none provided
    throw err;
  }
};
