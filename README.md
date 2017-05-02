# blobby

No, not that [Mr. Blobby](https://www.youtube.com/watch?v=NngdWbvpztk).

Blobby is an HTTP Proxy for Blob storage systems (such as S3) that automatically
shards and replicates your data. Useful for single and multi datacenter architectures,
**blobby** scales your storage and throughput requirements by way of sharding,
as well as enables fast local reads in multi datacenter replication setups.
Additionally **blobby** provides a simple CLI for analyzing your complex data
architectures by way of storage comparisons, repairs, stats, and more.

![NPM](https://raw.githubusercontent.com/asilvas/blobby/master/docs/repair-env.jpg)


## Installation

Blobby can be installed as a local dependency of your app:
```
npm i blobby --save
./node_modules/.bin/blobby
```

Or installed globally:
```
npm i blobby -g
blobby
```


## Basic Usage

Start the HTTP Proxy Server:
```
blobby server
```

Copy between storage systems:
```
blobby copy myOldStorage myNewStorage
```

See `help` for a full list of commands:
```
blobby help
```



## Options

A number of configuration formats are supported, including
JSON, [JSON5](http://json5.org/), CommonJS, and
[Secure Configurations](#Secure_Configuration).

| Option | Type | Default | Desc |
| --- | --- | --- | --- |
| config | arrayOf(string) | `[]` | One or more configuration files. If none are provided `config-env` will be used |
| config-dir | string | `"config"` | Directory of configuration files |
| config-env | string | `"NODE_ENV"` | Environment variable used to detect configuration |
| config-default | string | `"local"` | Default configuration to use if environment is not available |
| config-base | string | none | If specified will use this configuration as the base (defaults) config that will be deep merged |
| config-exts | arrayOf(string) | `['.json', '.json5', '.js']` | Supported extensions to detect for with configuration files |
| secure-config | string | none | Directory of secure configuration files |
| secure-secret | string | none | The secret required to decrypt secure configuration files |
| secure-file | string | none | File to load that holds the secret required to decrypt secure configuration files |
| mode | string | `"fast"` | Used when comparing files. For usage see [Compare Modes](#Compare_Modes) |

Example using the default `NODE_ENV` environment variable to load config data:

```
blobby server --config-dir lib/config
```



## Configuration

| Name | Type | Default | Desc |
| --- | --- | --- | --- |
| http | HttpBindings | `{ "default": { "port": 80 } }` | Collection (hash for ease of merging) of HTTP bindings |
| http.{id} | HttpBinding | (required) | HTTP Binding Object |
| http.{id}.port | number | `80` | Port to bind to |
| http.{id}.host | string | `"localhost"` | Host to bind to |
| http.{id}.ssl | Object | (required if enabling SSL) | See [Node.js TLS Options](https://nodejs.org/api/tls.html#tls_new_tls_tlssocket_socket_options) | http.{id}.ssl.pfx | Buffer or string | none | If string will attempt to load pfx from disk |
| http.{id}.ssl.key | Buffer or string | none | If string will attempt to load private key from disk |
| http.{id}.ssl.cert | Buffer or string | none | If string will attempt to load certificate from disk |
| storage | StorageBindings | (required) | Collection of storage bindings |
| storage.{id} | StorageBinding| (required) | Storage Binding Object |
| storage.{id}.driver | string | (required) | Module name/path to use as storage client |
| storage.{id}.maxUploadSize | number | none | Size in bytes allowed by uploads |
| storage.{id}.cacheControl | string | `"public,max-age=31536000"` | Default cache control headers to apply for GET's and PUT's if file does not provide it |
| storage.{id}.driver | string | (required) | Module name/path to use as storage client |
| storage.{id}.dirSplit | number | false | (future) If Number, auto-split paths every N characters to make listing of directories much faster |
| storage.{id}.auth | string | none | Required to support Uploads and Deletes, see [Secure API Operations](#Secure_API_Operations) |
| storage.{id}.replicas | arrayOf(string) | `[]` | Required to support Replication, see [File Replication](#File_Replication) |
| storage.{id}.options | Object | {} | Options provided to storage driver |

### Storage Drivers

* [blobby-s3](https://github.com/asilvas/blobby-s3) - An S3 client for Blobby, powered by Knox.


## Secure Configuration

An optional feature for sensitive credentials is to leverage the
included [Config Shield](https://github.com/godaddy/node-config-shield)
support. Any secure configuration objects will be merged into the
parent configuration object. If `secure-config` option is provided,
it's expected that for every configuration file, there will be a
corresponding secure configuration file using the same file name, but
under the **secure-config** directory.

```
blobby server --secure-config config/secure --secure-file config/secure/secret.txt
```

Example for creating a secure configuration:

```
npm i config-shield -g
cshield config/secure/local.json config/secure/secret.txt
set storage { app1: { options: { password: 'super secret!' } } }
save
exit
```

See [Config Shield](https://github.com/godaddy/node-config-shield) for
more advanced usage.


## Server

Start HTTP Server using the provided [Configuration](#Configuration).

```
blobby server
```


### Secure API Operations

As indicated in [Configuration](#Configuration), `storage.{id}.auth` is required to support uploads and deletes.

Example Config:

```
  auth: {
    mainAuth: {
      driver: './lib/my-jwt-handler',
      options: { /* options only my auth driver will understand */ }
    }
  },
  storage: {
    store1: {
      driver: '...',
      auth: 'mainAuth' // uploads to store1 require mainAuth
    }
  }
```

If you're creating your own Authorization handler, you can export a module with the following format:

```
module.exports = function(req, storageId, fileKey, authConfig, cb) {
  doSomethingAsync(function (err) => {
    if (err) return void cb(err); // fail authorization

    cb(); // authorization check passed, let them through
  });
}
```

Your handler can be synchronous or asynchronous, but `cb` must be invoked in either case.


### File Replication

As indicated in [Configuration](#Configuration), `storage.{id}.replicas` is required to enabled
replication. An array of one or more replicas can be provided, consisting of the storage identifier
and optionally the configuration if the desired storage exists in a different environment (such
as replication across data centers).

Format is `[ConfigId::]StorageId`, where `ConfigId` only needs to be specified if from a different
environment.

Example of two replicas, one from same environment, other from a different environment:

```
replicas: ['myOtherStorage', 'otherConfig::AnotherStorage']
```

***Important:*** Successful uploads (`PUT`'s) and deletes (`DELETE`'s) are only confirmed if all replica's
have been written to. This is to avoid data inconsistencies and race conditions (i.e. performing an
action on an asset before it's been written in all locations). In cases where speed is more important
than consistency, querystring param `waitForReplicas=0` can be set. There is no way to turn off
replication without removing from configuration, so this option will only return success once the
local storage is successful. The downside of this approach is that high availability is expected
for every replica, and uploads (or deletes) will fail if one of the replica's cannot be written to.



## Compare

For comparing the difference between storage bindings
and/or environments. This is a two-way comparison. Use `check`
instead if you only want to do a one-way comparison.

```
blobby compare <storage..>
```

Example of comparing two bindings:
```
blobby compare old new
```

Example of comparing one binding across 2 datacenters:
```
blobby compare app --config dc1 dc2
```

Example of comparing two bindings across 2 datacenters:
```
blobby compare old new --config dc1 dc2
```

### Compare Modes

```
blobby compare old new --mode deep
```

Available modes:

* `fast` - A simple check of file existence. Only recommended
  when you're comparing stores configured for immutable data. `Size` check will
  also be performed, if the storage driver provides it.
* `headers` (recommended) - Similar in speed to `fast`, but requires `ETag` or `LastModified`
  headers or comparison will fail. Should only be used between storage drivers
  that support at least one of these headers. NOTE: S3 should only be compared
  against other S3 storages in this mode due to their inability to overwrite these
  headers.
* `deep` - Performs an `ETag` check if available, otherwise falls back
  to loading files and performing hash checks. This option can range
  from a little slower, to much slower, depending on `ETag` availability.
  Recommended for mutable storage comparisons where caching headers are not
  available (ex: comparing a file system with S3 or vice versa).


## Repair

For repairing the difference between storage bindings
and/or environments. This is a two-way repair. Use `copy`
instead if you only want to do a one-way repair.

```
blobby repair <storage..>
```

Example of syncing data between old and new storage:
```
blobby repair old new
```

Example of syncing one storage across 2 datacenters:
```
blobby repair app --config dc1 dc2
```

Example of syncing two storage across 2 datacenters:
```
blobby repair old new --config dc1 dc2
```

For usage of `mode`, see [Compare Modes](#Compare_Modes).


## Stats

Query statistics against your storage(s).

```
blobby stats <storage..>
```

Example of querying stats for a single storage:
```
blobby stats old
```



## Initialize

Useful one-time initialization required by some storage drivers,
such as pre-creating shard buckets in S3.

```
blobby initialize <storage..>
```

Example of initializing a single storage:
```
blobby initialize new
```
