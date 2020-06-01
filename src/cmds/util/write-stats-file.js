const fs = require('fs');

module.exports = function readStatsFile(filePath, info) {
  fs.writeFileSync(filePath, JSON.stringify(info, null, 2));
}