export default {
  httpAgent: {
    keepAlive: true, // default: false
    keepAliveMsecs: 1000, // default: 1000
    maxSockets: Infinity, // default: Infinity
    maxFreeSockets: 256, // default: 256
    timeout: undefined // default: undefined
  },
  retry: {
    min: 500,
    factor: 2,
    retries: 3
  },
  cors: {
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET',
    'access-control-allow-origin': '*',
    'access-control-max-age': '86400'
  }
};
