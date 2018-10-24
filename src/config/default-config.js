export default {
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
