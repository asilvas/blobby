const fs = require('fs');

module.exports = function readStatsFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) || {};
  } catch (err) {
    console.warn('Error reading stats file:', filePath);
  }

  return {};
};
