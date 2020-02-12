const { expect } = require('chai');
const { formatDate, parseDate } = require('../../src/util/http-date');

// Preferred format from https://tools.ietf.org/html/rfc7231#section-7.1.1.1
const preferredRegex = (function () {
  const dayName = `(Mon|Tue|Wed|Thu|Fri|Sat|Sun)`;
  const TWO_DIGIT = `(\\d\\d)`;
  const day = TWO_DIGIT;
  const month = `(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)`;
  const year = `(\\d\\d\\d\\d)`;
  const date1 = `(${day} ${month} ${year})`;
  const hour = TWO_DIGIT;
  const minute = TWO_DIGIT;
  const second = TWO_DIGIT;
  const timeOfDay = `(${hour}:${minute}:${second})`;
  const imfFixdate = `(${dayName}, ${date1} ${timeOfDay} GMT)`;
  return new RegExp(imfFixdate);
}());


describe('http-date', () => {
  describe('formatDate', () => {
    it('produces a string in the RFC5322 date/time format', () => {
      expect(formatDate(new Date())).to.match(preferredRegex);
    });
  });

  describe('parseDate', () => {
    it('parses dates of the format we produce', () => {
      const date = new Date();
      const timestamp = date.getTime();
      const timestampWithoutMS = timestamp - (timestamp % 1000);
      const formatted = formatDate(date);
      const parsed = parseDate(formatted);

      expect(parsed.getTime()).to.equal(timestampWithoutMS);
    });

    it('handles RFC850 dates', () => {
      const str = `Wednesday, 12-Feb-20 09:40:47 GMT`;
      const parsed = parseDate(str);
      const expectedDate = new Date('2020-02-12T09:40:47.000Z');

      expect(parsed.getTime()).to.equal(expectedDate.getTime());
    });

    it('handles asctime() two-digit dates', () => {
      const str = `Wed Feb 12 09:40:47 2020`;
      const parsed = parseDate(str);
      const expectedDate = new Date('2020-02-12T09:40:47.000Z');

      expect(parsed.getTime()).to.equal(expectedDate.getTime());
    });

    it('handles asctime() one-digit dates', () => {
      const str = `Wed Feb  2 09:40:47 2020`;
      const parsed = parseDate(str);
      const expectedDate = new Date('2020-02-02T09:40:47.000Z');

      expect(parsed.getTime()).to.equal(expectedDate.getTime());
    });
  });
});
