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
- **for-each-async:** reject with a `RangeError` when `maxParallel` is not a
  positive integer (`0`, negative, or fractional) instead of silently
  resolving without processing any item. Applies to `mapAsync` too.
- **stream:** `WFTransform`/`WFWritable` `write()` and `end()` now reject on
  stream errors instead of hanging forever when the underlying stream errors
  during backpressure (or is already destroyed/ended); listeners are cleaned
  up on settle.
- **parser:** `format: 'lines'` (and `readDataFile`) now preserves empty lines
  instead of silently dropping them; empty-line skipping is kept only for the
  structured `csv`/`tsv`/`ndjson` formats.
- **progress-bar:** render `100.00 %` instead of `NaN %` for a non-positive
  `total`.
- **data-file-reader:** finalize the progress bar exactly once on the source's
  `error` (with `close(false)`) as well as `end`, so a failed read no longer
  leaves a dangling terminal line.

### Types

- **stream:** `WFTransform<I,O>.write()` / `WFWritable<I>.write()` now accept
  the input type `I` instead of a hardcoded `Buffer`, so object-mode writes are
  typed correctly. Byte-consuming transforms (`split`, `spawn`, `compress`,
  `decompress`) widen their input type to `Buffer | string` (contravariant,
  non-breaking) so string sources compose without casts.

### Build / CI

- Type-check test files (added `vitest/globals` and `npm run typecheck`).
- Lock the public surface via `package.json` `exports`.
- Coverage thresholds in `vitest.config.ts` (90/85/90/90).
- `npm audit` only fails on high or critical advisories.
- Drop the dead `tags: ['!**']` filter from CI.

### Docs

- Align `readDataFile` JSDoc and the README with actual format names
  (`csv`, `ndjson`) and the synchronous `compress`/`decompress` API.
- **parser:** document that CSV/TSV parsing is a naive line/separator split
  (not RFC 4180) and does not support quoted fields, escaped quotes, or
  separators/newlines embedded in values.

## [2.6.0] - 2026-07-08

### Breaking Changes

- require Node 22+ ([b1d8838](https://github.com/MichaelKreil/work-faster/commit/b1d88381fa3a369115f90f0ee425e23b480aacae))

### Features

- **progress-bar:** add success flag to close() ([80ac7d3](https://github.com/MichaelKreil/work-faster/commit/80ac7d3d65a636fc9fe78e74b8a53e30a6a0037e))
- enhance write and end methods to handle stream errors and backpressure ([3db1d40](https://github.com/MichaelKreil/work-faster/commit/3db1d4055c500d69e052ec22a96225084d92c44b))
- update WFTransform and WFWritable to accept generic input types, enhancing flexibility in stream processing ([35bd3be](https://github.com/MichaelKreil/work-faster/commit/35bd3beb4d881dd31a56dff98a4135d9db750a81))
- preserve empty lines in 'lines' format for readDataFile and parser functions ([26947f2](https://github.com/MichaelKreil/work-faster/commit/26947f2c87a33cfe193d99280656bc08ea62e59f))
- handle zero total in ProgressBar to prevent NaN and ensure correct logging ([49e2f83](https://github.com/MichaelKreil/work-faster/commit/49e2f83da0839caf1932e9087fd4ba62cc74180d))
- enhance CSV/TSV parser documentation to clarify limitations on quoted fields and separator handling ([6199152](https://github.com/MichaelKreil/work-faster/commit/6199152298417b5a9b975f623fe6b338b19a0034))
- finalize progress bar on stream error to maintain accurate progress reporting ([e47feb3](https://github.com/MichaelKreil/work-faster/commit/e47feb368661d719458c8d66472b9f75161acfcf))
- update changelog with new features and bug fixes for for-each-async, stream handling, parser improvements, and progress bar finalization ([f5a580a](https://github.com/MichaelKreil/work-faster/commit/f5a580ab82d4463521c76a68e6ed668ecc023e43))

### Bug Fixes

- **read:** handle HTTP errors and non-2xx responses ([653965d](https://github.com/MichaelKreil/work-faster/commit/653965dc453518429522f6244ce7264e307e0beb))
- **spawn:** honor backpressure and only fail on non-zero exit ([8a5cd9a](https://github.com/MichaelKreil/work-faster/commit/8a5cd9acbef2170f18c289cf3733c197f761ff81))
- **merge:** propagate destroy to inner streams in DuplexWrapper ([1fe1a65](https://github.com/MichaelKreil/work-faster/commit/1fe1a65aff517949d59c56af7947cbc23df1fe9d))
- **progress-bar:** avoid Infinity speed when updates share a millisecond ([2d05756](https://github.com/MichaelKreil/work-faster/commit/2d0575672f274730e42b95a412095917eed4c64b))
- **split:** plumb encoding through splitFast and use StringDecoder ([3bc5cae](https://github.com/MichaelKreil/work-faster/commit/3bc5caee648026fb263181c33d31264d3d0ba955))
- **pipeline:** reject when an intermediate stream errors ([4f07a95](https://github.com/MichaelKreil/work-faster/commit/4f07a95df598dda752affde017ac0c24622dfeb9))
- **read:** add idle timeout for HTTP requests ([1b5a8c4](https://github.com/MichaelKreil/work-faster/commit/1b5a8c4c423555e17cff47a15f776f064457c1b8))
- **split:** cap unbounded line size in splitFast ([3a5241b](https://github.com/MichaelKreil/work-faster/commit/3a5241bd1ec5cbbd9a364c8e123441ba2df6680f))
- **progress-bar:** anchor next update on now, not last target ([1d43256](https://github.com/MichaelKreil/work-faster/commit/1d43256855303f185aa15d82e0799cb7505ef12f))
- **progress-bar:** don't write to stderr from the constructor ([fd5466b](https://github.com/MichaelKreil/work-faster/commit/fd5466bd63386bb941157720d28830f810373be9))
- **split:** tear down asLines splitter when consumer breaks early ([9c11a9b](https://github.com/MichaelKreil/work-faster/commit/9c11a9b657cedbf95b85eb67e71b088885f8e7c4))
- **compress:** use byte-mode passthrough for 'none' ([55b6d8c](https://github.com/MichaelKreil/work-faster/commit/55b6d8c47d2d51aadd765b6df7d341705d36cca4))
- **spawn:** treat signal-killed children as failures ([a5c0144](https://github.com/MichaelKreil/work-faster/commit/a5c0144f80a6d37325daa2cb12fe4b5e45ccde8b))
- **merge:** honor backpressure in DuplexWrapper._read ([549e41d](https://github.com/MichaelKreil/work-faster/commit/549e41d4aa30e5f4612b30a5c699246b7843283b))
- **split:** apply maxLineSize cap to splitSlow as well ([3c0262a](https://github.com/MichaelKreil/work-faster/commit/3c0262a80883479d1755a100ed9afa01028aaff6))
- **forEachAsync:** serialize iterator pulls ([136e61b](https://github.com/MichaelKreil/work-faster/commit/136e61b22d3890524346287dec8795258a3c8fbe))
- **pipeline:** destroy surviving stages on first error ([dfb5f7d](https://github.com/MichaelKreil/work-faster/commit/dfb5f7d28efd6f512308fe49bb063a994aff184f))
- **compress:** validate level against per-algorithm range ([db7c24e](https://github.com/MichaelKreil/work-faster/commit/db7c24ebd9cd9644ddccc12bbbebb6ab08a57f71))
- **spawn:** swallow EPIPE on stdin write so early exits succeed ([6f36e14](https://github.com/MichaelKreil/work-faster/commit/6f36e1473a15ebbf3bf6149adbe55941c6b47113))
- correct script names for formatting in package.json ([b14b40f](https://github.com/MichaelKreil/work-faster/commit/b14b40ffc2895f665295c3df78ed5123202fc3ad))

### Code Refactoring

- update release and upgrade scripts in package.json ([27248af](https://github.com/MichaelKreil/work-faster/commit/27248afc54c58007ddf6058560e5b908b2de1e51))
- drop spurious awaits on compress/decompress ([c738f55](https://github.com/MichaelKreil/work-faster/commit/c738f55b7d7ff67dff35709c394b0406106559f1))
- simplify type definition for WFTransformSource ([fa45130](https://github.com/MichaelKreil/work-faster/commit/fa451308632ec26ab9241efbf8853d48c7680f5a))

### Documentation

- align data_file_reader and README with actual API ([9c10ab2](https://github.com/MichaelKreil/work-faster/commit/9c10ab21f6ba2931e34907471e013570a0177b40))
- **changelog:** add Unreleased section for the recent fix batches ([07a42d4](https://github.com/MichaelKreil/work-faster/commit/07a42d42f8ad92b98f86e18018712285ed07c307))
- warn that os.cpus() default is for CPU-bound work only ([922b1e3](https://github.com/MichaelKreil/work-faster/commit/922b1e3f8d85fdbfe21782c539dff8f7472ceeee))
- **fromValue:** note that null/undefined yields an empty stream ([70f6800](https://github.com/MichaelKreil/work-faster/commit/70f68006881aebcdfa242820116f9037d59edc16))
- **flatten:** label as shallow ([88ec7db](https://github.com/MichaelKreil/work-faster/commit/88ec7db70a87d28cca97ed3128fbf2e926032c0d))
- **readme:** note that forEachAsync default is for CPU-bound work ([adef864](https://github.com/MichaelKreil/work-faster/commit/adef8647af9e84d22f91784057faf7400a51fa8c))

### Tests

- gate coverage on minimum thresholds ([fb524c3](https://github.com/MichaelKreil/work-faster/commit/fb524c373ab1d415b4ca754e43fa1c8ed20257fd))
- **split:** cover MAX_BUFFER_SIZE carryover path ([49a060f](https://github.com/MichaelKreil/work-faster/commit/49a060fd872a1ff115fcbabce828ca9d40e1758a))
- add validation for maxParallel in forEachAsync and mapAsync functions ([76cef1c](https://github.com/MichaelKreil/work-faster/commit/76cef1c00ebfe004ac78e1cc34ff4e06f6539605))
- add comprehensive tests for WFWritable and WFTransform stream behaviors ([6be0c74](https://github.com/MichaelKreil/work-faster/commit/6be0c742ffbd0683205940eade91b2d0b6908bb1))

### Build System

- **deps-dev:** bump the npm group with 11 updates ([6a18a0a](https://github.com/MichaelKreil/work-faster/commit/6a18a0a76fcc15614ca7eaae83ed725f66b8a250))
- type-check tests via vitest globals ([49039f9](https://github.com/MichaelKreil/work-faster/commit/49039f9549d40935b4bfb527acc0cf0c2b053375))
- lock public surface with package.json exports ([366ad60](https://github.com/MichaelKreil/work-faster/commit/366ad6037772e4b5d41d1c4df59388e0fd6196e6))
- **deps-dev:** bump the npm group with 9 updates ([9899238](https://github.com/MichaelKreil/work-faster/commit/9899238e8654559922e2a6091cb497c48f06dc43))
- **deps:** bump the github-action group with 3 updates ([3b2c864](https://github.com/MichaelKreil/work-faster/commit/3b2c864aacb9cac1e997aa0ae4ebf6160dbb316f))

### CI/CD

- only fail npm audit on high or critical advisories ([de88f9f](https://github.com/MichaelKreil/work-faster/commit/de88f9fc034d6484394550abcf03608c88fc2da0))
- drop dead negative tags filter ([158c900](https://github.com/MichaelKreil/work-faster/commit/158c900c601e929ddd6740b20fac51186ac98944))

### Chores

- update npm-check-updates and vitest to latest versions ([4cfa848](https://github.com/MichaelKreil/work-faster/commit/4cfa8480cd7ab1290f4949f4f170aa8090df0e4f))
- add *.code-workspace to .gitignore ([9a126e7](https://github.com/MichaelKreil/work-faster/commit/9a126e71e5ffbd6bb5351c1c749627ce6078d308))
- ignore .DS_Store, drop stale eslint and mocks entries ([044abf7](https://github.com/MichaelKreil/work-faster/commit/044abf7a57d5cddb1ae5e705f5a76270a3d75a64))
- drop vestigial mock.test.ts exclude from vitest config ([23a6ca1](https://github.com/MichaelKreil/work-faster/commit/23a6ca15a59a6bd53ec746fac0584731b7031e61))
- update devDependencies to latest versions for improved stability and features ([16de706](https://github.com/MichaelKreil/work-faster/commit/16de706c5d6a8cb13915f0a6ab7321ce01f187ab))

### Styles

- re-flow long lines flagged by prettier ([a63b672](https://github.com/MichaelKreil/work-faster/commit/a63b672b33c3ecd5dbf304ae5737d8090cac429b))

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
