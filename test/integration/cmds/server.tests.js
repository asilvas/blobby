const chai = require('chai');
chai.use(require('sinon-chai'));
const { expect } = chai;
const cleanup = require('../../util/cleanup');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const axios = require('axios');

const getMocks = require('../../mocks');
const lib = require('../../../src/cmds/server');

describe('# src/cmds/server.js', async () => {

  let mocks, servers;

  before(() => {
    return Promise.all([
      cleanup.before(),
      lib.handler(getMocks().argv).then(s => {
        servers = s;
        return s;
      })
    ]);
  });
  after(() => {
    return Promise.all([
      cleanup.after(),
      ...servers.map(s => s.close())
    ]);
  });
  beforeEach(() => {
    mocks = getMocks();
    return cleanup.beforeEach();
  });

  it('HEAD test1.txt from local storage', async () => {
    writeFileSync('test/fs/local1/tmp/test1.txt', 'test1');
    const { status, headers } = await axios.head('http://localhost:4080/local/tmp/test1.txt');
    expect(status).to.equal(204);
    expect(headers['content-type']).to.equal('text/plain');
    expect(headers['content-length']).to.equal('5');
    expect(headers['access-control-allow-origin']).to.equal('*');
  });

  it('GET test1.txt from local storage', async () => {
    writeFileSync('test/fs/local1/tmp/test1.txt', 'test1');
    const { data, status, headers } = await axios.get('http://localhost:4080/local/tmp/test1.txt');
    expect(status).to.equal(200);
    expect(headers['content-type']).to.equal('text/plain');
    expect(data).to.equal('test1');
  });

  it('GET (with auth) test1.txt from local storage', async () => {
    writeFileSync('test/fs/local1/tmp/test1.txt', 'test1');
    const { data, status, headers } = await axios.get('http://localhost:4080/local/tmp/test1.txt', {
      headers: { ...mocks.authHeaders }
    });
    expect(status).to.equal(200);
    expect(headers['content-type']).to.equal('text/plain');
    expect(data).to.equal('test1');
  });

  it('GET static/myFile.txt from disk', async () => {
    const { data, status, headers } = await axios.get('http://localhost:4080/static/myFile.txt');
    expect(status).to.equal(200);
    expect(headers['content-type']).to.equal('text/plain');
    expect(data).to.equal('my static file');
  });

  it('GET tmp folder from local storage', async () => {
    writeFileSync('test/fs/local1/tmp/test1.txt', 'test1');
    writeFileSync('test/fs/local1/tmp/test2.txt', 'test2');
    const { data, status, headers } = await axios.get('http://localhost:4080/local/tmp/', {
      headers: { ...mocks.authHeaders }
    });
    expect(status).to.equal(200);
    expect(headers['content-type']).to.equal('application/json');
    expect(data.fileKey).to.equal('tmp/');
    expect(data.files.length).to.equal(2);
    expect(data.files[0].Key).to.equal('tmp/test1.txt');
    expect(data.files[1].Key).to.equal('tmp/test2.txt');
  });

  it('PUT test1.txt to local storage', async () => {
    expect(existsSync('test/fs/local1/tmp/test1.txt')).to.be.false;
    const { data, status, headers } = await axios.put('http://localhost:4080/local/tmp/test1.txt', 'test1', {
      headers: { ...mocks.authHeaders, ETag: '123' }
    });
    expect(status).to.equal(204);
    expect(headers.etag).to.not.equal('123');
    expect(headers['content-type']).to.equal('text/plain');
    expect(existsSync('test/fs/local1/tmp/test1.txt')).to.be.true;
  });

  it('PUT (COPY) source.txt to test1.txt', async () => {
    writeFileSync('test/fs/local1/tmp/source.txt', 'source');
    expect(existsSync('test/fs/local1/tmp/test1.txt')).to.be.false;
    const { data, status, headers } = await axios.put('http://localhost:4080/local/tmp/test1.txt', '', {
      headers: { ...mocks.authHeaders, 'x-amz-copy-source': 'local:tmp/source.txt', ETag: '123' }
    });
    expect(status).to.equal(204);
    expect(headers.etag).to.not.equal('123');
    expect(headers['content-type']).to.equal('text/plain');
    expect(existsSync('test/fs/local1/tmp/test1.txt')).to.be.true;
    expect(readFileSync('test/fs/local1/tmp/test1.txt', 'utf8')).to.equal('source');
  });

  it('PUT (COPY) tmp1/filename+with+plus.txt to tmp2/filename+with+plus.txt', async () => {
    writeFileSync('test/fs/local1/tmp1/filename+with+plus.txt', 'source');
    expect(existsSync('test/fs/local1/tmp2/filename+with+plus.txt')).to.be.false;
    const { data, status, headers } = await axios.put(`http://localhost:4080/local/tmp2/${encodeURIComponent('filename+with+plus')}.txt`, '', {
      headers: { ...mocks.authHeaders, 'x-amz-copy-source': `local:tmp1/${encodeURIComponent('filename+with+plus')}.txt`, ETag: '123' }
    });
    expect(status).to.equal(204);
    expect(headers.etag).to.not.equal('123');
    expect(headers['content-type']).to.equal('text/plain');
    expect(existsSync('test/fs/local1/tmp2/filename+with+plus.txt')).to.be.true;
    expect(readFileSync('test/fs/local1/tmp2/filename+with+plus.txt', 'utf8')).to.equal('source');
  });

  it('PUT test1.txt (w/o) is restricted', async () => {
    expect(existsSync('test/fs/local1/tmp/test1.txt')).to.be.false;
    const { status } = await axios.put('http://localhost:4080/local/tmp/test1.txt', 'test1', {
      validateStatus: status => true
    });
    expect(status).to.equal(403);
    expect(existsSync('test/fs/local1/tmp/test1.txt')).to.be.false;
  });

  it('DELETE test1.txt from local storage', async () => {
    writeFileSync('test/fs/local1/tmp/test1.txt', 'test1');
    expect(existsSync('test/fs/local1/tmp/test1.txt')).to.be.true;
    const { status } = await axios.delete('http://localhost:4080/local/tmp/test1.txt', {
      headers: { ...mocks.authHeaders }
    });
    expect(status).to.equal(204);
    expect(existsSync('test/fs/local1/tmp/test1.txt')).to.be.false;
  });

  it('DELETE test1.txt (w/o auth) is restricted', async () => {
    writeFileSync('test/fs/local1/tmp/test1.txt', 'test1');
    expect(existsSync('test/fs/local1/tmp/test1.txt')).to.be.true;
    const { status } = await axios.delete('http://localhost:4080/local/tmp/test1.txt', {
      validateStatus: status => true
    });
    expect(status).to.equal(403);
    expect(existsSync('test/fs/local1/tmp/test1.txt')).to.be.true;
  });

  it('DELETE tmp dir from local storage', async () => {
    writeFileSync('test/fs/local1/tmp/test1.txt', 'test1');
    expect(existsSync('test/fs/local1/tmp/test1.txt')).to.be.true;
    const { status } = await axios.delete('http://localhost:4080/local/tmp/', {
      headers: { ...mocks.authHeaders }
    });
    expect(status).to.equal(200);
    mkdirSync('test/fs/local1/tmp');
    expect(existsSync('test/fs/local1/tmp/test1.txt')).to.be.false;
  });

  it('DELETE tmp dir (w/o auth) is restricted', async () => {
    writeFileSync('test/fs/local1/tmp/test1.txt', 'test1');
    expect(existsSync('test/fs/local1/tmp/test1.txt')).to.be.true;
    const { status } = await axios.delete('http://localhost:4080/local/tmp/', {
      validateStatus: status => true
    });
    expect(status).to.equal(403);
    expect(existsSync('test/fs/local1/tmp/test1.txt')).to.be.true;
  });
});
