import Table from 'tty-table';
import chalk from 'chalk';
import {terminal} from 'terminal-kit';
import bytes from 'bytes';

export default class Stats {
  constructor() {
    this.configs = {};
    this.storageIds = {};
    this.storages = {};
    this.stats = {};
  }

  getStats(srcConfig, srcStorage, dstConfig, dstStorage) {
    dstConfig = dstConfig || srcConfig;
    dstStorage = dstStorage || srcStorage;
    const id = StatInfo.generateId(srcConfig, srcStorage, dstConfig, dstStorage);

    let info = this.stats[id];
    if (info) return info;

    info = this.stats[id] = new StatInfo(srcConfig, srcStorage, dstConfig, dstStorage);
    // track configs
    this.configs[srcConfig.id] = srcConfig;
    this.configs[dstConfig.id] = dstConfig;
    // track storages
    this.storageIds[srcStorage.id] = true;
    this.storageIds[dstStorage.id] = true;
    this.storages[`${srcConfig.id}.${srcStorage.id}`] = srcStorage;
    this.storages[`${dstConfig.id}.${dstStorage.id}`] = dstStorage;

    return info;
  }

  getStatsById(id) {
    return this.stats[id];
  }

  toString() {
    const header = [
      {
        value: 'Config.Storage',
        headerColor: 'white',
        color: 'cyan',
        align: 'center'
      }
    ];
    const configIds = Object.keys(this.configs).map(k => this.configs[k].id);
    const storageIds = Object.keys(this.storageIds);

    const configStoragePairs = [];
    configIds.forEach(configId => {
      storageIds.forEach(storageId => {
        const pairId = `${configId}.${storageId}`;
        configStoragePairs.push(pairId);
        header.push({
          value: `${pairId} (dest)`,
          headerColor: 'cyan',
          color: 'white',
          align: 'center',
          formatter: stats => {
            const info = stats && stats.info;
            const strs = [];
            if (info) {
              const active = info.state === 'running' ? chalk.bold.underline : chalk;
              if (info.state === 'initialized') {
                return chalk.bgWhite.black(`waiting...`);
              }
              else if (info.srcFiles === 0) {
                return active.bgGreen.black(`empty source`);
              }
              else if (info.srcFiles === info.matches) {
                return active.bgGreen.black(`All ${info.srcFiles} match (${bytes(info.matchSize)})`);
              }
              else if (info.repairs > 0) {
                return active.bgYellow.red(`${info.diffs} diffs (${bytes(info.diffSize)}), ${info.repairs} repairs, ${info.matches} matches (${bytes(info.matchSize)}), ${info.srcFiles} files`);
              }
              else {
                return active.bgRed.yellow(`${info.diffs} diffs (${bytes(info.diffSize)}), ${info.matches} matches (${bytes(info.matchSize)}), ${info.srcFiles} files`);
              }
            } else if (stats && typeof stats === 'string') {
              return chalk.gray(stats); // push as-is
            } else {
              return chalk.bgBlack.gray('Skipping');
            }
          }
        });
      });
    });
    let errors = [];
    const $this = this;
    const rows = configStoragePairs.map(xPair => {
      const row = [`${xPair} (src)`] // y header
        .concat(configStoragePairs.map(yPair => {
          if (configStoragePairs.length > 1 && xPair === yPair) return 'n/a'; // we don't test itself

          const pairId = `${xPair}.${yPair}`;
          const statInfo = $this.getStatsById(pairId);
          if (statInfo) {
            errors = errors.concat(statInfo.info.errors.map(err => {
              return { pairId, err };
            }));
          }

          return statInfo || ''; // empty string required if no stats
        })
      );
      return row;
    });

    const footer = [

    ];

    const table = Table(header, rows, footer, {
      borderStyle : 1,
      borderColor : 'grey',
      paddingLeft: 1,
      paddingRight: 1,
      headerAlign : 'center',
      width: 200, // use max width, whatever is allowed by terminal
      align : 'center',
      color : 'white'
    });

    let output = table.render();
    if (errors.length > 0) {
      const errTable = Table([ // header
          {
            value: 'Src -> Dest',
            headerColor: 'cyan',
            color: 'yellow',
            align: 'center'
          },
          {
            value: 'Top Errors',
            headerColor: 'cyan',
            color: 'red',
            align: 'center'
          }
        ],
        errors.slice(0, 5).map(e => { // rows
          const split = e.pairId.split('.');
          return [`${split[0]}.${split[1]} -> ${split[2]}.${split[3]}`, e.err];
        }),
        [], // footer
        { // options
          borderStyle: 1,
          borderColor: 'grey',
          paddingBottom: 0,
          headerAlign: 'center',
          width: 200, // use max width, whatever is allowed by terminal
          align: 'center',
          color: 'red'
        }
      );

      output += errTable.render();
    }

    terminal.clear(); // required to clear screen in some terminals due to lack of cursor support
    //console.log('');
    /*if (this.hasCursor) {
      terminal.restoreCursor();
    } else {
      this.hasCursor = true;
      terminal.saveCursor();
    }*/
    return output;
  }
}

class StatInfo {
  constructor(srcConfig, srcStorage, dstConfig, dstStorage) {
    this.id = StatInfo.generateId(srcConfig, srcStorage, dstConfig, dstStorage);
    this.srcConfig = srcConfig;
    this.srcStorage = srcStorage;
    this.dstConfig = dstConfig;
    this.dstStorage = dstStorage;
    this.info = {
      state: 'initialized',
      srcFiles: 0,
      matches: 0,
      matchSize: 0,
      diffs: 0,
      diffSize: 0,
      repairs: 0,
      errors: []
    };
  }

  match(size) {
    this.info.srcFiles++;
    this.info.matches++;
    if (size) this.info.matchSize += size;
  }

  diff(size) {
    this.info.srcFiles++;
    this.info.diffs++;
    if (size) this.info.diffSize += size;
  }

  error(err) {
    this.info.errors.push(err);
  }

  repair() {
    this.info.repairs++;
  }

  running() {
    this.info.state = 'running';
  }

  complete() {
    this.info.state = 'complete';
  }

  static generateId(srcConfig, srcStorage, dstConfig, dstStorage) {
    return `${srcConfig.id}.${srcStorage.id}.${dstConfig.id}.${dstStorage.id}`;
  }
}