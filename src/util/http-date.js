/**
 * Formats a `Date` object according to RFC 7231 (used for Last-Modified header)
 *
 * @param {Date} dt   - The Date to format
 * @returns {String}  - The formatted string
 */
function formatDate(dt) {
  return dt.toUTCString();
}

/**
 * Parses an RFC 7231 date/time string
 *
 * @param {string} str  - The string to parse
 * @returns {Date}      - The parsed date
 */
function parseDate(str) {
  // JavaScript seems to be able to handle all three supported formats fine,
  // except for the asctime() format, in which it is not assuming UTC. A hack
  // for this will be to append "GMT" if it's not already there.
  str = str.endsWith('GMT') ? str : `${str} GMT`;
  return new Date(str);
}

function zeroPad2(num) {
  return `0${num}`.substr(-2);
}

module.exports = { formatDate, parseDate };
