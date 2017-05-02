import { getConfigs } from '../config';
import {handler as CompareHandler} from './compare';

export const command = 'check <storage..>';
export const desc = 'One-Way compare files between storage bindings and/or environments';
export const builder = {
  storage: {
    describe: 'Provide one or more storage bindings you wish to compare',
    type: 'array'
  }
};

export const handler = argv => {
  argv.oneWay = true;

  CompareHandler(argv);
};
