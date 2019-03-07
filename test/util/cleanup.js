const {promisify} = require('es6-promisify');
const fs = require('fs');
const mkdir = promisify(fs.mkdir);
const rimraf = promisify(require('rimraf'));

module.exports = {
  before,
  beforeEach,
  after
};

function before() {
  return Promise.all([
    mkdir('test/fs/local1/tmp').catch(() => null),
    mkdir('test/fs/local2/tmp').catch(() => null),
  ]);
}

function beforeEach() {
  return Promise.all([
    rimraf('test/fs/local1/tmp/*'),
    rimraf('test/fs/local2/tmp/*')
  ]);
}

function after() {
  return Promise.all([
    rimraf('test/fs/local1/tmp/*'),
    rimraf('test/fs/local2/tmp/*')
  ]);
}
