import {handler as RepairHandler} from './repair';

export const command = 'copy <storage..>';
export const desc = 'One-way copy of files between storage bindings and/or environments';
export const builder = {
  storage: {
    describe: 'Provide two or more storage bindings you wish to synchronize',
    type: 'array'
  }
};

export const handler = argv => {
  argv.oneWay = true;

  RepairHandler(argv);
}
