import { getConfigs } from '../config';
import {handler as CompareHandler} from './compare';

export const command = 'checkdir <dir> <storage..>';
export const desc = 'One-Way shallow directory compare between storage bindings and/or environments';
export const builder = {
  dir: {
    describe: 'Directory to compare',
    type: 'string'
  },
  storage: {
    describe: 'Provide one or more storage bindings you wish to compare',
    type: 'array'
  }
};

export const handler = argv => {
  argv.oneWay = true;

  CompareHandler(argv);
};
