const chai = require('chai');
chai.use(require('sinon-chai'));
const { expect } = chai;
const cleanup = require('../../util/cleanup');
const { writeFileSync, existsSync } = require('fs');

const getMocks = require('../../mocks');
const lib = require('../../../src/cmds/copy');

describe('# src/cmds/copy.js', async () => {

  let mocks;

  before(cleanup.before);
  after(cleanup.after);
  beforeEach(() => {
    mocks = getMocks();
    return cleanup.beforeEach();
  });

  it('COPY test1.txt from local to local2 storage', async () => {
    writeFileSync('test/fs/local1/tmp/test1.txt', 'test1');
    expect(existsSync('test/fs/local2/tmp/test1.txt')).to.be.false;    
    mocks.argv.storage = ['local', 'local2'];
    await lib.handler(mocks.argv);
    expect(existsSync('test/fs/local2/tmp/test1.txt')).to.be.true;    
  });

  it('COPY test2.txt from local2 to local1 storage', async () => {
    writeFileSync('test/fs/local2/tmp/test2.txt', 'test2');
    expect(existsSync('test/fs/local1/tmp/test2.txt')).to.be.false;    
    mocks.argv.storage = ['local2', 'local'];
    await lib.handler(mocks.argv);
    expect(existsSync('test/fs/local1/tmp/test2.txt')).to.be.true;    
  });
});
