# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### BREAKING CHANGES

- **engines:** require Node.js `>=22`. Node 20 reaches end-of-life in
  April 2026; the CI matrix and the `engines` field have both been
  bumped accordingly. Bumping to `>=22` is a breaking change and the
  next release should be cut as a major version.

### Bug Fixes

- **read:** HTTP/HTTPS requests no longer hang on connection errors, non-2xx
  responses, or stalled responses (new `httpTimeoutMs` option, default 30s).
- **spawn:** honor backpressure on stdin/stdout, buffer stderr instead of
  treating it as an error, surface stderr only on non-zero exit, and kill
  the child on transform destroy.
- **merge:** propagate destroy to inner streams in `DuplexWrapper` so
  teardown no longer leaks file handles or child processes.
- **pipeline:** errors in intermediate transforms now reject the returned
  promise instead of hanging forever.
- **split:** plumb the `format` argument through `splitFast`, decode via
  `StringDecoder`, and cap a single line at 256 MB (configurable) to
  prevent OOM on delimiter-free input.
- **split:** `asLines` tears down the splitter (and source) when the
  consumer breaks out of `for await` early.
- **progress-bar:** guard against divide-by-zero when updates share a
  millisecond, anchor the next update on `now` so a long pause does not
  produce a stderr burst, and stop writing from the constructor.
- **compress:** `compress('none')` now uses a byte-mode passthrough so it
  composes with byte-mode peers.

### Build / CI

- Type-check test files (added `vitest/globals` and `npm run typecheck`).
- Lock the public surface via `package.json` `exports`.
- Coverage thresholds in `vitest.config.ts` (90/85/90/90).
- `npm audit` only fails on high or critical advisories.
- Drop the dead `tags: ['!**']` filter from CI.

### Docs

- Align `readDataFile` JSDoc and the README with actual format names
  (`csv`, `ndjson`) and the synchronous `compress`/`decompress` API.

## [2.5.7] - 2026-04-02

### Build System

- **deps:** bump codecov/codecov-action in the github-action group

### Chores

- remove unnecessary newline in CHANGELOG.md
- update devDependencies to latest versions
- add rootDir and types to compilerOptions in tsconfig.json

## [2.5.6] - 2026-03-01

### Chores

- update devDependencies to latest versions
