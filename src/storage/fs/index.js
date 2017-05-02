import path from 'path';
import fs from 'fs';
import merge from 'merge';
import mkdirp from 'mkdirp';
import crypto from 'crypto';

export default class BlobbyFS {
  constructor(opts) {
    this.options = opts || {};
    if (!this.options.path) throw new Error('BlobbyFS requires `path` option');
  }

  fetchInfo(fileKey, cb) {
    const absPath = path.resolve(path.join(this.options.path, fileKey));
    fs.stat(absPath, (err, stats) => {
      if (err) return void cb(err);

      if (!stats.isFile()) return void cb(new Error('Requested path is not a file'));

      cb(null, { LastModified: stats.mtime, Size: stats.size });
    });
  }

  /*
    fileKey: unique id for storage
    opts: future
   */
  fetch(fileKey, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = null;
    }
    opts = opts || { };

    const absPath = path.resolve(path.join(this.options.path, fileKey));
    fs.readFile(absPath, { encoding: null }, (err, data) => {
      if (err) return void cb(err);

      // compute etag
      const ETag = crypto.createHash('md5').update(data).digest('hex');

      const stats = fs.statSync(absPath);
      cb(null, { ETag, LastModified: stats.mtime, Size: stats.size }, data);
    });
  }

  /*
   fileKey: unique id for storage
   file: file object
   file.buffer: Buffer containing file data
   file.headers: A collection of header values
   file.headers.LastModified: If specified, will force this value on newly written files
   opts: future
   */
  store(fileKey, file, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = null;
    }
    opts = opts || {};

    const { buffer, headers } = file;
    const absPath = path.resolve(path.join(this.options.path, fileKey));
    const $this = this;
    fs.writeFile(absPath, buffer, {}, err => {
      if (err) {
        if (err.code === 'ENOENT') {
          // attempt to create directory (recursively)
          return void mkdirp(path.dirname(absPath), err => {
            if (err) return void cb(err); // dir creation failed

            // success, so lets try to store again
            $this.store(fileKey, file, opts, cb);
          });
        }

        return void cb(err);
      }

      if (headers && typeof headers.LastModified === 'object') {
        // if LastModified is set, apply to target object for proper syncing
        fs.utimes(absPath,
          Date.now() / 1000 /* atime: Access Time */,
          headers.LastModified.getTime() / 1000 /* mtime: Modified Time */
          , cb
        );
      } else {
        // otherwise return success now
        cb();
      }
    });
  }

  /*
   fileKey: unique id for storage
   */
  remove(fileKey, cb) {
    const absPath = path.resolve(path.join(this.options.path, fileKey));
    const $this = this;
    fs.unlink(absPath, err => {
      if (err) {
        return void cb(err);
      }

      cb();
    });
  }

  /* supported options:
   dir: Directory (prefix) to query
   opts: Options object
   opts.lastKey: if requesting beyond maxKeys (paging)
   opts.maxKeys: ignored for this storage client
   opts.deepQuery: not supported for this storage client
   cb(err, files, dirs, lastKey) - Callback fn
   cb.err: Error if any
   cb.files: An array of files: { Key, LastModified, ETag, Size, ... }
   cb.dirs: An array of dirs: [ 'a', 'b', 'c' ]
   cb.lastKey: An identifier to permit retrieval of next page of results, ala: 'abc'
  */
  list(dir, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = null;
    }
    opts = opts || {};

    if (!opts.deepQuery) {
      // simple mode, query current directory

      const simpleDir = path.resolve(path.join(this.options.path, dir));

      return void query(this.options.path, dir, cb);
    }

    // otherwise use deep query logic for use with querying entire tree
    deepQuery(this.options.path, dir, opts.lastKey, cb);
  }
}

function query(root, currentDir, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts;
    opts = null;
  }
  opts = opts || {};
  opts.lastDir = opts.lastDir || '';
  const absPath = path.join(root, currentDir);
  fs.readdir(absPath, (err, dirContents) => {
    if (err) return void cb(err);

    const dirs = [];
    const files = [];
    dirContents.forEach(name => {
      const Key = path.join(currentDir, name);
      if (name <= opts.lastDir) {
        // Ignore/filter anything less than or equal to lastDir.
        // This is not only an optimization, but is a required pattern
        // to avoid returning the same file more than once.
        return;
      }
      const stats = fs.statSync(path.join(root, Key));
      if (stats.isDirectory()) {
        dirs.push({Key});
        return;
      }

      if (!opts.ignoreFiles) {
        files.push({Key, LastModified: stats.mtime, Size: stats.size });
      }
    });

    cb(null, files.sort(sortByKey), dirs.sort(sortByKey));
  });
}

function sortByKey(a, b) {
  if (a.Key > b.Key) return 1; // greater than
  else if (a.Key < b.Key) return -1; // less than
  return 0; // equal
}

/*
  lastKey = the next directory to query, in lexical order

  // example structure:
  a/b/c/d
  a/b/x
  a/b/y
  a/e
  a/f

  # lastKey format: (+right, -left){lastDir}:{nextDir}
  +:a
  +a:a/b
  +a/b:/a/b/c
  +a/b/c:a/b/c/d
  -a/b/c/d:a/b/c
  -a/b/x:a/b
  -a/b/y:a/b
  -a/e:a
  -a/f:a
  -a:.
  (eof, no more dirs after `a`)
*/
function deepQuery(root, currentDir, lastKey, cb) {
  if (!lastKey) {
    // initial query
    return void query(root, currentDir, (err, files, dirs) => {
      if (err) return void cb(err);

      const lastKey = dirs.length > 0 ? buildLastKeyRight(currentDir, path.join(currentDir, dirs[0].Key)) : null;
      cb(null, files, [], lastKey);
    });
  }

  // resume query via lastKey
  const keyInfo = getLastKeyInfo(lastKey);
  const lastDir = keyInfo.leftToRight === false ? path.basename(keyInfo.lastDir) : null;
  const ignoreFiles = !keyInfo.leftToRight; // ignore files in nextDir if going backwards
  //console.log(`querying ${keyInfo.nextDir}, leftToRight:${keyInfo.leftToRight}, lastDir:${lastDir}, ignoreFiles:${ignoreFiles}...`)
  query(root, keyInfo.nextDir, {lastDir, ignoreFiles}, (err, files, dirs) => {
    if (err) return void cb(err); // we're done, bail

    if (dirs.length === 0) {
      // no directories to continue down, go back
      cb(null, files, [], buildLastKeyLeft(keyInfo.nextDir));
    } else {
      // contains directories, so continue searching
      cb(null, files, [], buildLastKeyRight(keyInfo.nextDir, dirs[0].Key));
    }
  });
}

function getLastKeyInfo(lastKey) {
  const leftToRight = lastKey[0] === '+';
  const split = lastKey.substr(1).split(':');
  const lastDir = split[0];
  const nextDir = split[1];
  return {
    leftToRight,
    lastDir,
    nextDir
  };
}

function buildLastKeyRight(currentDir, nextDir) {
  return `+${currentDir}:${nextDir}`;
}

function buildLastKeyLeft(currentDir) {
  const nextDir = path.join(currentDir, '..');
  if (nextDir === '..') return null; // no key if in root and we go back again
  return `-${currentDir}:${nextDir}`;
}
