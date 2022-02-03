const setHeaders = require('./set-headers');

module.exports = async opts => {
  const { res } = opts;

  try {
    res.statusCode = 204;
    opts.headers = {};
    setHeaders(opts);

    res.setHeader('Allow', 'GET,HEAD,PUT,OPTIONS,DELETE');

    res.end();
  } catch (err) {
    err.statusCode = 404;
    throw err;
  }

};
