[![NPM Version](https://img.shields.io/npm/v/work-faster)](https://www.npmjs.com/package/work-faster)
[![NPM Downloads](https://img.shields.io/npm/d18m/work-faster)](https://www.npmjs.com/package/work-faster)
[![Code Coverage](https://codecov.io/gh/michaelkreil/work-faster/branch/main/graph/badge.svg?token=IDHAI13M0K)](https://codecov.io/gh/michaelkreil/work-faster)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/michaelkreil/work-faster/ci.yml)](https://github.com/michaelkreil/work-faster/actions/workflows/ci.yml)

- [Overview](#overview)
- [Main Components](#main-components)
	- [class: `ProgressBar`](#class-progressbar)
	- [function: `forEachAsync`](#function-foreachasync)
- [Stream Namespace](#stream-namespace)
	- [class: `WFReadable`](#class-wfreadable)
	- [class: `WFTransform`](#class-wftransform)
	- [class: `WFWritable`](#class-wfwritable)
	- [function: `compress`](#function-compress)
	- [function: `decompress`](#function-decompress)
	- [functions: Utilities](#functions-utilities)
	- [functions: Stream Processing](#functions-stream-processing)
	- [functions: File and Line Utilities](#functions-file-and-line-utilities)
- [Installation](#installation)
- [Usage Examples](#usage-examples)


# Overview

**work-faster** is an NPM package providing utilities for working with asynchronous streams, parallel processing, and data compression in Node.js. It includes classes and functions that enhance readability and modularity for handling streams, processing data asynchronously, and performing common file and stream-based operations efficiently.

---

# Main Components

## class: `ProgressBar`
A progress indicator for tracking and displaying task completion over time.

- **Constructor**: `new ProgressBar(total, timeStep?)`
  - `total` (required): The total steps for the progress bar.
  - `timeStep` (optional, default: `1000` ms): Refresh rate of the progress bar.
- **Methods**:
  - `increment(value?)`: Advances the progress by `value` (default: 1).
  - `update(value)`: Updates the progress directly to a specific `value`.
  - `close()`: Closes and finalizes the progress bar display.


## function: `forEachAsync`
Executes an asynchronous callback function over items with an optional parallel limit.

- **Parameters**:
  - `items`: Iterable or async iterable items to process.
  - `callback(item, index)`: Async function executed for each item.
  - `maxParallel` (optional): Maximum parallel tasks.
- **Returns**: A promise resolving when all items are processed.

# Stream Namespace

## class: `WFReadable`
A custom readable stream wrapper.

- **Constructor**: `new WFReadable(inner: Readable)`
  - `inner`: The original readable stream.
- **Methods**:
  - `pipe(destination)`: Pipes data to another transform or writable stream.
  - `merge(destination)`: Merges data from another transform stream.
  - `[Symbol.asyncIterator]`: Iterates over the stream asynchronously.

## class: `WFTransform`
A custom duplex transform stream wrapper.

- **Constructor**: `new WFTransform(inner: Duplex)`
  - `inner`: The duplex stream.
- **Methods**:
  - `pipe(destination)`: Pipes data to another transform or writable stream.
  - `merge(destination)`: Merges data from another transform stream.

## class: `WFWritable`
A custom writable stream wrapper.

- **Constructor**: `new WFWritable(inner: Writable)`
  - `inner`: The writable stream.

## function: `compress`
Compresses data based on the specified type and options.

- **Parameters**:
  - `type`: Compression type (`'gzip'`, `'brotli'`, `'lz4'`, or `'zstd'`).
  - `options`: Compression options (e.g., level).
- **Returns**: A `WFTransform` stream for compression.

## function: `decompress`
Decompresses data based on the specified type.

- **Parameters**:
  - `type`: Decompression type (`'gzip'`, `'brotli'`, `'lz4'`, or `'zstd'`).
- **Returns**: A `WFTransform` stream for decompression.

## functions: Utilities

- **fromValue**: Wraps a single value as a readable stream.
- **fromArray**: Converts an array of items into a readable stream.
- **toBuffer**: Collects data from a stream into a `Buffer`.
- **toString**: Collects data from a stream into a `string`.
- **toArray**: Collects all data chunks from a stream into an array.

## functions: Stream Processing

- **pipeline**: Combines a series of readable, transform, and writable streams into a unified pipeline.
- **merge**: Merges two streams (readable/transform or writable) into one.

## functions: File and Line Utilities

- **read**: Reads a file from the filesystem or a URL as a readable stream.
- **asBuffer**: Converts a string or buffer-based stream into a buffer stream.
- **asLines**: Splits a stream by lines or regex pattern.

---

# Installation

```bash
npm install work-faster
```

# Usage Examples

**Using `forEachAsync` for Parallel Processing**

```javascript
import { forEachAsync } from 'work-faster';

await forEachAsync([1, 2, 3], async (item) => {
  console.log(item);
}, 2);
```

**Compressing and Decompressing Data**

```javascript
import { compress, decompress } from 'work-faster';

const compressedStream = await compress('gzip');
const decompressedStream = await decompress('gzip');
```
