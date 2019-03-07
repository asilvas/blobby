const chai = require('chai');
chai.use(require('sinon-chai'));
const { expect } = chai;
const cleanup = require('../../util/cleanup');
const { writeFileSync, existsSync } = require('fs');

const getMocks = require('../../mocks');
const lib = require('../../../src/cmds/rm-dir');

describe('# src/cmds/rm-dir.js', async () => {

  let mocks;

  before(cleanup.before);
  after(cleanup.after);
  beforeEach(() => {
    mocks = getMocks();
    return cleanup.beforeEach();
  });

  it('REMOVE test1.txt from local storage', async () => {
    writeFileSync('test/fs/local1/tmp/test1.txt', 'test1');
    expect(existsSync('test/fs/local1/tmp/test1.txt')).to.be.true;
    mocks.argv.dir = 'tmp';
    mocks.argv.storage = ['local'];
    await lib.handler(mocks.argv);
    expect(existsSync('test/fs/local1/tmp/test1.txt')).to.be.false;    
  });
});
