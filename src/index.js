import yargs from 'yargs';
import path from 'path';
import pkg from '../package.json';

yargs
  .commandDir(path.resolve(__dirname, '..', 'lib', 'cmds'))
  .option('config', {
    describe: 'One or more configuration files (with or without extension)',
    type: 'array',
    default: []
  })
  .option('config-dir', {
    describe: 'Directory of configuration files',
    type: 'string',
    default: 'config'
  })
  .option('config-env', {
    describe: 'Environment variable used to detect configuration filename (ex: "development", "dc1", etc)',
    type: 'string',
    default: 'NODE_ENV'
  })
  .option('config-default', {
    describe: 'Default configuration to use if environment is not available (ex: "local")',
    type: 'string',
    default: 'local'
  })
  .option('config-base', {
    describe: 'Configuration to use as defaults for all environment configurations (ex: "defaults")',
    type: 'string'
  })
  .option('config-exts', {
    describe: 'Supported extensions to detect for with configuration files',
    type: 'array',
    default: ['.json', '.json5', '.js']
  })
  .option('secure-config', {
    alias: 'secure-dir',
    describe: 'Directory of secure configuration files',
    type: 'string'
  })
  /*.option('secure-secret', {
    describe: 'The secret (or secrets if different per configuration) required to decrypt secure configuration files',
    type: 'string'
  })*/
  .option('secure-file', {
    describe: 'File (or files if different per configuration) to load that holds the secret required to decrypt secure configuration files',
    type: 'string'
  })
  .option('mode', {
    describe: 'Select level of comparison required to verify storage integrity',
    default: 'headers',
    choices: ['fast', 'headers', 'deep', 'force']
  })
  .option('acl', {
    describe: 'ACL\'s to apply when writing objects',
    default: 'public-read',
    type: 'string'
  })
  .option('concurrency', {
    describe: 'Number of concurrent I/O operations allowed by operations that support it',
    default: 20,
    type: 'number'
  })
  .option('recursive', {
    describe: 'Enable deep query (recursive subdirectories) for operations that support it',
    default: true,
    type: 'boolean'
  })
  .option('removeGhosts', {
    describe: 'For `repair`\'s if `true`, will remove missing file instances instead of copying to missing storage',
    default: false,
    type: 'boolean'
  })
  .option('retry-min', {
    describe: 'Minimum timeout (in ms) for first retry, where retries are applicable',
    default: 1000,
    type: 'number'
  })
  .option('retry-factor', {
    describe: 'Multiple in time applied to retry attempts, where retries are applicable',
    default: 2,
    type: 'number'
  })
  .option('retry-attempts', {
    describe: 'Maximum retry attempts before failure is reported, where retries are applicable',
    default: 3,
    type: 'number'
  })
  .option('no-color', {
    describe: 'If color isn\'t desired or support, this flag can be set to turn off all color',
    default: false,
    type: 'boolean'
  })
  .demandCommand()
  .help()
  .epilogue(`Blobby v${pkg.version}`)
  .argv
;
