[![NPM Version](https://img.shields.io/npm/v/work-faster)](https://www.npmjs.com/package/work-faster)
[![NPM Downloads](https://img.shields.io/npm/d18m/work-faster)](https://www.npmjs.com/package/work-faster)
[![Code Coverage](https://codecov.io/gh/michaelkreil/work-faster/branch/main/graph/badge.svg?token=IDHAI13M0K)](https://codecov.io/gh/michaelkreil/work-faster)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/michaelkreil/work-faster/ci.yml)](https://github.com/michaelkreil/work-faster/actions/workflows/ci.yml)

- [Overview](#overview)
- [Main Components](#main-components)
  - [class: `ProgressBar`](#class-progressbar)
  - [function: `forEachAsync`](#function-foreachasync)
  - [function: `mapAsync`](#function-mapasync)
- [Stream Namespace](#stream-namespace)
  - [class: `WFReadable`](#class-wfreadable)
  - [class: `WFTransform`](#class-wftransform)
  - [class: `WFWritable`](#class-wfwritable)
  - [function: `compress`](#function-compress)
  - [function: `decompress`](#function-decompress)
  - [functions: Utilities](#functions-utilities)
  - [functions: Stream Processing](#functions-stream-processing)
  - [functions: File and Line Utilities](#functions-file-and-line-utilities)
  - [functions: Parsing](#functions-parsing)
  - [functions: Wrapping](#functions-wrapping)
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
  - `close(success?)`: Closes and finalizes the progress bar display. Defaults to
    `true`, which snaps the bar to 100%. Pass `false` when the underlying work
    failed, to keep the actual progress value instead.

Output goes to `stderr`. On a terminal the bar is a single line rewritten in
place; when `stderr` is redirected (a log file, a CI job) it emits plain
newline-terminated lines instead, so no cursor-control escapes end up in the
captured output.

## function: `forEachAsync`

Executes an asynchronous callback function over items with an optional parallel limit.

- **Parameters**:
  - `items`: Iterable or async iterable items to process.
  - `callback(item, index)`: Async function executed for each item.
  - `maxParallel` (optional): Maximum parallel tasks.
- **Returns**: A promise resolving when all items are processed.

**On failure, callbacks already running are neither cancelled nor awaited.** The
returned promise rejects with the first error and no further items are pulled,
but callbacks that had already started keep running to completion in the
background — so tearing down a resource they use in a `catch`/`finally` can race
them. Errors thrown by those still-running callbacks are discarded.

## function: `mapAsync`

Like `forEachAsync`, but collects what each callback returns.

- **Parameters**:
  - `items`: Iterable or async iterable items to process.
  - `callback(item, index)`: Async function returning the mapped value.
  - `maxParallel` (optional): Maximum parallel tasks.
- **Returns**: A promise resolving to an array of results, in the same order as
  the input items (not in completion order).

```javascript
import { mapAsync } from 'work-faster';

// Results keep the input order even though item 'a' finishes last.
const lengths = await mapAsync(['aaa', 'bb', 'c'], async (s) => s.length, 3);
console.log(lengths); // [3, 2, 1]
```

Shares `forEachAsync`'s failure behaviour described above.

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

- **Constructor**: `new WFWritable(inner: Writable, tail?: Writable)`
  - `inner`: The writable stream.
  - `tail` (optional): The last stream of the chain, when `inner` is only its
    head — this is what `merge` passes. Defaults to `inner`.
- **Methods**:
  - `write(content)`: Writes a chunk, honoring backpressure.
  - `end()`: Ends the stream and resolves once the whole chain has finished,
    including `tail`. It rejects if any stage of the chain fails.

## function: `compress`

Compresses data based on the specified type and options.

- **Parameters**:
  - `type`: Compression type (`'gzip'`, `'brotli'`, `'lz4'`, `'zstd'`, or `'none'`).
  - `options`: Compression options (e.g., `{ level }`).
- **Returns**: A `WFTransform` stream for compression.

Valid levels, and the default when omitted: `gzip` 0–9 (5), `brotli` 0–11 (5),
`lz4` 1–12 (1), `zstd` 1–22 (3). An out-of-range level throws.

## function: `decompress`

Decompresses data based on the specified type.

- **Parameters**:
  - `type`: Decompression type (`'gzip'`, `'brotli'`, `'lz4'`, `'zstd'`, or `'none'`).
- **Returns**: A `WFTransform` stream for decompression.

**External dependencies:** `gzip` and `brotli` always use Node's built-in
`zlib`. `zstd` uses `zlib` too on Node >= 22.15, and otherwise falls back to
spawning the `zstd` CLI. `lz4` always requires the `lz4` CLI on `PATH`; without
it, the stream fails at runtime rather than at construction.

## functions: Utilities

- **fromValue**: Wraps a single value as a readable stream. Note that Node reads
  `null`/`undefined` as end-of-stream, so `fromValue(null)` yields no chunks.
- **fromArray**: Converts an array of items into a readable stream.
- **toBuffer**: Collects data from a stream into a `Buffer`.
- **toString**: Collects data from a stream into a `string`.
- **toArray**: Collects all data chunks from a stream into an array.
- **arrayFromAsync**: Collects any `AsyncIterable` into an array.
- **flatten**: Transform that emits each element of an incoming array
  individually. Shallow — nested arrays are passed through as-is.
- **passThrough**: Object-mode transform that forwards data unchanged.
- **skipEmptyLines**: Transform that drops empty chunks.
- **spawn**: Pipes a stream through an external command's stdin/stdout, as a
  `WFTransform`. A non-zero exit or a terminating signal fails the stream, with
  the tail of the child's stderr included in the error message.

## functions: Stream Processing

- **pipeline**: Combines a series of readable, transform, and writable streams
  into a unified pipeline. The returned promise resolves once the destination is
  fully closed — not merely finished — so it is safe to read, rename or unlink an
  output file immediately afterwards. If any stage errors, every surviving stage
  is destroyed and the promise rejects.
- **merge**: Merges two streams (readable/transform or writable) into one.

## functions: File and Line Utilities

- **read**: Reads a file from the filesystem or a URL as a readable stream,
  returning `{ stream, size }`.
  - `options.httpTimeoutMs` (default `30000`, `0` disables): idle timeout applied
    both to connection setup and to gaps between bytes.
  - `options.maxRedirects` (default `5`, `0` rejects on the first 3xx): HTTP and
    HTTPS URLs follow redirects, including ones that switch protocol. Relative
    `location` values are resolved against the redirecting URL.
  - `size` comes from the final response's `content-length`, so it is `0` for
    chunked responses.
- **readDataFile**: Reads, optionally decompresses, and parses a data file in one
  call. Takes `{ compression, format, progress }` and returns a `WFReadable` of
  parsed records. `progress` displays a `ProgressBar` and requires a known size.
- **asBuffer**: Converts a string or buffer-based stream into a buffer stream.
- **asLines**: Splits a stream by lines or regex pattern.
- **split** / **splitFast**: Transforms that split a byte stream into lines.
  `split` accepts a string, single byte code, or `RegExp` delimiter (default
  `'\n'`) and dispatches to the fast byte-scanning path when it can. Both cap a
  single delimiter-free line at 256 MB by default and error beyond it, so a
  malformed input cannot grow unboundedly.

## functions: Parsing

- **parser**: Returns a transform for a given format — `'csv'`, `'tsv'`,
  `'ndjson'`, or `'lines'`. Empty lines are dropped for the structured formats
  and preserved for `'lines'`.

**CSV/TSV parsing is a naive split, not RFC 4180.** Each physical line is split
verbatim on the separator, with the first line taken as the header. Quoted
fields (`"a,b"`), escaped quotes (`""`), and separators or newlines inside values
are **not** supported; extra columns beyond the header are dropped and missing
ones become `undefined`. For `'csv'` the separator is auto-detected from `,`,
`;`, or tab, by whichever yields the most columns in the header. Use a dedicated
CSV parser if your data uses quoting or escaping.

## functions: Wrapping

Adapters that lift plain values, functions, and Node streams into the `WF*`
wrappers. Each returns its input unchanged if it is already wrapped.

- **wrap**: Dispatches to one of the below based on what it is given.
- **wrapRead**: `Readable`, iterable, or async iterable → `WFReadable`.
- **wrapTransform**: `Duplex`, or a sync/async `(item) => result` function →
  `WFTransform`.
- **wrapFilterTransform**: Like `wrapTransform`, but a callback returning `null`
  drops the item instead of emitting it.
- **wrapWrite**: `Writable`, or a sync/async `(item) => void` function →
  `WFWritable`.

---

# Installation

```bash
npm install work-faster
```

# Usage Examples

**Using `forEachAsync` for Parallel Processing**

```javascript
import { forEachAsync } from 'work-faster';

await forEachAsync([1, 2, 3], async (item) => console.log(item), 2);
```

> **Pick `maxParallel` for the work, not the machine.** The default is
> `os.cpus().length`, which is right for CPU-bound callbacks. For
> I/O-bound work (HTTP, disk, databases) the right value is whatever
> the remote service can handle - typically much higher than the CPU
> count. Pass an explicit number in those cases.

**Compressing and Decompressing Data**

```javascript
import { Stream } from 'work-faster';

const compressedStream = Stream.compress('gzip');
const decompressedStream = Stream.decompress('gzip');
```
