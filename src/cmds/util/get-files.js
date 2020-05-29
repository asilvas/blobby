let gIsRunning;
let gPreviousKey;
let gLastKey;
let gFiles;
let gNextFiles;
let gResolve;
let gReject;

module.exports = function getFiles({ argv, srcConfig, srcStorage, dstConfig, dstStorage, statInfo }) {
  const { dir } = argv;
  const dateMin = argv.dateMin && new Date(argv.dateMin);
  const dateMax = argv.dateMax && new Date(argv.dateMax);

  function pullMoreFiles() {
    if (gIsRunning || gFiles.length >= 5000 || gLastKey === null) return; // do not queue more than 5k files at a time

    gIsRunning = true;

    srcStorage.list(dir || '', { deepQuery: argv.recursive, maxKeys: 5000, lastKey: gLastKey || argv.resumeKey }, processFiles);
  }

  function processFiles(err, files, dirs, lastKey) {
    gIsRunning = false;

    if (err) return void console.error('list failed:', err.stack || err);

    if (!gPreviousKey) {
      // first key is only set once per capture
      gPreviousKey = lastKey;
    }
    gLastKey = lastKey;

    const filteredFiles = files.filter(f => {
      return (!dateMin || f.LastModified >= dateMin) && (!dateMax || f.LastModified <= dateMax);
    });

    gFiles = gFiles.concat(filteredFiles);

    if (gNextFiles && gFiles.length) {
      // if caller is waiting, resolve it
      getNextFiles();
    }

    pullMoreFiles();
  }

  pullMoreFiles();

  const getNextFiles = function () {
    let files, lastKey;
    if (gNextFiles) {
      if (gFiles.length) { // if data avail, auto-resolve
        files = gFiles;
        lastKey = gPreviousKey; // return the previous key so caller does not resume before the results were processed
        gFiles = []; // reset
        gPreviousKey = gLastKey; // reset

        pullMoreFiles();

        gNextFiles = null; // reset

        gResolve({
          lastKey,
          files
        });
      }
      return gNextFiles;
    }

    if (!gIsRunning && !gFiles.length) {
      gNextFiles = Promise.resolve(); // finished
      return gNextFiles;
    }

    if (!gFiles.length) {
      // pending result if nothing available yet
      gNextFiles = new Promise((resolve, reject) => {
        gResolve = resolve;
        gReject = reject;
      });
      return gNextFiles;
    }

    files = gFiles;
    lastKey = gPreviousKey; // return the previous key so caller does not resume before the results were processed
    gFiles = []; // reset
    gPreviousKey = gLastKey; // reset

    pullMoreFiles();

    return Promise.resolve({
      lastKey,
      files
    });
  };

  return getNextFiles;
};

// hack for tests that share instance...
module.exports.reset = function() {
  gIsRunning = false;

  gPreviousKey = '';
  gLastKey = '';
  gFiles = [];
  gNextFiles = undefined;
  gResolve = undefined;
  gReject = undefined;
}

module.exports.reset();
