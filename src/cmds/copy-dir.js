import {handler as RepairHandler} from './repair';

export const command = 'copydir <dir> <storage..>';
export const desc = 'One-way shallow directory copy between storage bindings and/or environments';
export const builder = {
  dir: {
    describe: 'Directory to copy',
    type: 'string'
  },
  storage: {
    describe: 'Provide two or more storage bindings you wish to synchronize',
    type: 'array'
  }
};

export const handler = argv => {
  argv.oneWay = true;

  RepairHandler(argv);
}
