const chai = require('chai');
chai.use(require('sinon-chai'));
const { expect } = chai;
const { parse } = require('url');

const QUERY = '?query1=value1';
const PATHNAME = '/part1-测试/part2a+part2b/part3.ext';
const PATHNAME_ENCODED = encodeURI(PATHNAME);
const PATHNAME_ENCODED_COMPONENTS = PATHNAME.split('/').map(encodeURIComponent).join('/');
const HOST = 'some.host';
const URL_RAW = `http://${HOST}${PATHNAME}?${QUERY}`;
const URL_ENCODED_URI = encodeURI(URL_RAW);
const URL_ENCODED_COMPONENTS = `http://${HOST}${PATHNAME_ENCODED_COMPONENTS}?${QUERY}`;
const URL_ENCODED_URI_AND_COMPONENTS = encodeURI(URL_ENCODED_COMPONENTS);

// These tests aren't (currently) directly executing lib code, but rather validating some behaviors
describe('decode-safe-key', () => {

  it('pathname is not encoded', () => {
    const { pathname } = parse(URL_RAW);
    expect(pathname).to.equal(PATHNAME);
  });

  it('pathname is not URI decoded', () => {
    const { pathname } = parse(URL_ENCODED_URI);
    expect(pathname).to.equal(PATHNAME_ENCODED);
  });

  it('pathname is not component decoded', () => {
    const { pathname } = parse(URL_ENCODED_COMPONENTS);
    expect(pathname).to.equal(PATHNAME_ENCODED_COMPONENTS);
  });

  it('pathname must be decoded URI & components if encoded with both', () => {
    const { pathname } = parse(URL_ENCODED_URI_AND_COMPONENTS);
    expect(pathname).to.not.equal(PATHNAME_ENCODED_COMPONENTS);
    expect(decodeURI(pathname)).to.equal(PATHNAME_ENCODED_COMPONENTS);
  });

  it('safe to decode components even if components are not encoded', () => {
    const { pathname } = parse(URL_ENCODED_URI);
    expect(decodeURI(pathname)).to.equal(PATHNAME);
    const decodedComponents = pathname.split('/').map(decodeURIComponent).join('/');
    expect(decodeURI(decodedComponents)).to.equal(PATHNAME);
  });

});