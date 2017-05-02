# blobby-s3

An S3 client for [Blobby](https://github.com/asilvas/blobby), powered
by [Knox](https://github.com/Automattic/knox). Does NOT require S3 from
Amazon AWS, and is designed to work across other storage systems that
are compatible with the S3 interface.



## Options

```
# config/local.json5
{
  storage: {
    app: {
      options: {
        endpoint: 's3.amazonaws.com',
        port: 443,
        secure: true,
        key: 'myAccessKey',
        secret: 'mySecretKey',
        style: 'path',
        bucketPrefix: 'myBucket', // myBucket1-100
        bucketStart: 1,
        bucketEnd: 100
      }
    }
  }
}
```

| Option | Type | Default | Desc |
| --- | --- |
| endpoint | string | `"s3.amazonaws.com"` | Endpoint of S3-compatible service |
| port | number | `443` | Directory of configuration files |
| secure | boolean | `true` | Environment variable used to detect configuration |
| key | string | (required) | Access key |
| secret | string | (required) | Secret |
| style | string | `"path"` | May use `"virtualHosted"` if bucket is not in path |
| bucketPrefix | string | (required) | Prefix of the final bucket name |
| bucketStart | number | `false` | If valid number, files will be sharded across buckets ranging from bucketStart to bucketEnd |
| bucketEnd | number | `false` | If valid number, files will be sharded across buckets ranging from bucketStart to bucketEnd |


### Secrets

Recommended to store your `secret` in blobby's **Secure Configuration**.

### Sharding

Your needs may vary, but leveraging `bucketStart` and `bucketEnd` to shard
your directories across multiple buckets is recommended to avoid scaling
limitations, be it storage, throughput, or otherwise. Even Amazon AWS S3
has per-bucket limitations.
