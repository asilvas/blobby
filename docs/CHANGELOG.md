# CHANGELOG

## v0.10

* (EXPERIMENTAL FEATURE) - Support for native COPY for efficient copying of data between compatible storage systems via
  `PUT /{storageId}/{filePath}` with `x-amz-copy-source` header. For storage drivers without native support
  a default GET & PUT will be performed instead as a convenience.
