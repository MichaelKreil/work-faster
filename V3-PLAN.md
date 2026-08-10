# work-faster 3.0 — Design & Plan

**Status:** design agreed, implementation not started
**Goal:** easy, performant, type-safe stream pipelines
**Baseline:** 2.7.0 (249 tests, 15 files)

---

## 1. Why a new major version

2.x exposes Node streams through thin wrappers (`WFReadable`, `WFTransform`,
`WFWritable`). Building a pipeline means assembling stages by hand, and the
wrappers leak their internals (`.inner` is public API). The fluent, inference-
driven API below cannot be retrofitted onto that surface without leaving two
overlapping mental models in the same package, so 3.0 replaces the core.

Three concrete problems 3.0 is meant to remove, all of them real bugs found in
2.6.0 during the audit that preceded this plan:

- `pipe` returns the _destination_, so `t1.pipe(t2)` silently discards `t1` when
  written to. Identical static type to the correct form, so nothing warns.
- Stream instances are single-use, and reusing one yields an empty result with
  no error.
- Lifecycle correctness (`finish` vs `close`, error propagation across a merged
  chain) had to be fixed stage by stage because every combinator hand-rolled it.

---

## 2. Findings

All benchmarks: node v24.16.0, Apple Silicon, 14 cores. Median of 5–7 reps after
warmup, results checksum-validated against an independently computed expectation.
Scripts in `scratchpad/bench/` (not committed).

### 2.1 Substrate: what should a pipeline be made of?

1,000,000 items through three stages (map → filter → map):

| substrate                            | median | items/sec | vs floor |
| ------------------------------------ | -----: | --------: | -------: |
| plain `for` loop (floor, no streams) |   2 ms |      523M |     1.0× |
| **async generators, batched 1000**   |  14 ms |       72M |     7.3× |
| object-mode `Transform` (2.x model)  | 136 ms |      7.3M |    71.4× |
| async generators, per item           | 289 ms |      3.5M |   151.3× |
| `stream.compose` + generator stages  | 848 ms |      1.2M |   444.0× |

Three results worth stating plainly, because two of them contradict the
assumptions we started with:

- **Per-item async generators are 2× _slower_ than object-mode streams.** Every
  `yield` allocates a promise. Generators are not automatically the fast modern
  option; batching is the entire reason the approach wins.
- **The "hybrid" (generator logic inside stream lifecycle via `compose`) is the
  worst option** — 6× slower than plain object streams. It was the leading
  candidate before measurement.
- **`highWaterMark` tuning changed nothing** for object streams (136 ms at both
  16 and 1024), so stream overhead is per-chunk machinery, not buffering policy.

A third generator variant — sync generators, and using them to compose stages
lazily inside a batch — was measured and rejected; see §2.7.

### 2.2 Never `await` a non-promise

Single map stage, 200,000 items:

| variant                          | sync callback | async callback |
| -------------------------------- | ------------: | -------------: |
| generators, per item             |        4.5M/s |         5.1M/s |
| generators, batched              |       17.7M/s |        21.1M/s |
| **batched + `instanceof` check** |   **85.0M/s** |    **20.7M/s** |
| object stream                    |        6.1M/s |         6.0M/s |

Guarding the await — `const r = fn(x); out[i] = r instanceof Promise ? await r : r`
— is a **5× win** when the callback is synchronous and costs nothing when it is
not (20.7M vs 21.1M, within noise). Since most `map`/`filter` callbacks are
synchronous, this belongs in every stage from the first commit.

### 2.3 End-to-end against the real 2.x stack

118 MB / 2,000,000 NDJSON lines, read → split → parse → filter → count:

| implementation           | throughput             | vs 2.x   |
| ------------------------ | ---------------------- | -------- |
| 2.x `readDataFile` stack | 72 MB/s, 1.2M lines/s  | —        |
| batched generators       | 229 MB/s, 3.9M lines/s | **3.2×** |

Throughput held constant from a 29 MB to a 118 MB file, and both implementations
complete under a 96 MB heap cap with unchanged throughput — memory is genuinely
bounded, and earlier RSS growth was GC headroom, not retention.

### 2.4 Batch size

Throughput is a broad, flat plateau — the knee is at ~64–128 and everything up to
~8192 is within a few percent:

| batch   | in-mem sync | in-mem async | real file |
| ------- | ----------: | -----------: | --------: |
| 16      |       2.56× |        1.56× |     1.11× |
| 64      |       1.36× |        1.17× |     1.03× |
| 128     |       1.17× |        1.10× |     1.01× |
| **256** |   **1.10×** |    **1.05×** | **1.01×** |
| 512     |       1.02× |        1.01× |     1.00× |
| 4096    |       1.01× |        1.00× |     1.00× |
| 65536   |       1.25× |        1.13× |     1.04× |

Item size does **not** move the optimum — across 60 B objects, 4 KB strings and
64 KB buffers, 256 stays within 1–10% of the best.

So memory decides. Count-based batching holds `batch × stages` items live:

| item size | batch 256 | batch 1024 | batch 4096 |
| --------- | --------: | ---------: | ---------: |
| 60 B      |     46 KB |     184 KB |     738 KB |
| 4 KB      |      3 MB |      12 MB |      50 MB |
| 64 KB     | **50 MB** |     201 MB | **805 MB** |

**Default 256.** Choosing 4096 would buy ~1% throughput for 16× the worst-case
footprint.

### 2.5 Slow sources need a time-based flush

A count-only batch cannot flush until full, so a slow source stalls the pipeline.
With a source yielding one item per 2 ms, first output took **584 ms**.

| flush strategy        | fast source (1M) | slow source, first output |
| --------------------- | ---------------: | ------------------------: |
| count-only            |            86 ms |                    584 ms |
| clock read per item   |           109 ms |                     23 ms |
| clock read every 16   |            90 ms |                     36 ms |
| **`setTimeout` flag** |        **87 ms** |                 **23 ms** |

A timer that sets a boolean, with the hot loop only reading it, gets full latency
protection for ~1% overhead. The per-item clock read costs 32% and is not
acceptable.

### 2.6 Type-level validation

The API was type-checked before any implementation: 33 exact-type assertions and
9 negative (`@ts-expect-error`) assertions under `strict`,
`exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`, all passing. The
suite was mutation-tested — a deliberately wrong assertion fails, and stripping
every `@ts-expect-error` surfaces a real, correctly-reasoned error at each site.

It found three design bugs that would otherwise have shipped:

1. **`Pipe<In, Out>` had a phantom type parameter.** `In` appeared only in return
   positions, so assignability ignored it — a `Pipe<Record<string,string>, X>`
   was silently accepted by `WFStream<number>.through()`. Fixed with variance
   annotations (`interface Pipe<in In, out Out>`), which also produce far better
   diagnostics than the phantom-property alternative.
2. **Type guards lost narrowing when combined with options.** The guard overload
   had no `opts` parameter, so `filter(pred, { parallel: 4 })` fell through to the
   boolean overload and silently returned the unnarrowed type.
3. **`concat` bound its type parameter to the first argument** and rejected the
   rest instead of producing a union.

### 2.7 Rejected alternative: sync generators inside a batch

Sync generators are far cheaper than async ones, which raises an obvious
question: since each batched stage allocates a fresh output array, why not
compose the stages **lazily** with sync generators inside a batch, walk it once
and allocate nothing?

1,000,000 items, three stages:

| variant                                  |   median | items/sec |
| ---------------------------------------- | -------: | --------: |
| plain `for` loop (floor)                 |   2.3 ms |    443M/s |
| **batched 256 + manual loops** (chosen)  |  14.7 ms | **68M/s** |
| batched 256 + `Array.map`/`filter`       |  18.9 ms |     53M/s |
| batched 256 + sync-generator composition |  46.7 ms |     21M/s |
| sync generators, per item                |  54.7 ms |     18M/s |
| async generators, per item               | 290.2 ms |    3.4M/s |

Sync generators are **~5.3× faster than async** (18.3M vs 3.4M/s) — no promise
allocation, no microtask tick. Working back from the numbers, a sync `yield`
costs ~17 ns against ~96 ns for an async one.

But they are still **~24× slower than a plain loop**. A sync `yield` drives a
generator state machine and allocates a `{value, done}` object per element. The
real cost is therefore **per-element iterator protocol overhead**, whether sync
or async; async merely multiplies it.

So the lazy-composition idea loses: **46.7 ms vs 14.7 ms, 3.2× slower**. Avoiding
the intermediate arrays does not pay, because 3M sync yields (~51 ms) cost far
more than V8 spends allocating small, short-lived arrays. Even idiomatic
`Array.map`/`filter` loses to manual loops by 29%.

**Rule: generators for coarse transport, plain loops for fine iteration.** Sync
generators have no role in the hot path — they cannot `await`, so they cannot be
the transport, and they are slower than plain loops for the inner iteration.

---

## 3. Architecture

**Batched async generators.** Async iterators are the user-facing model and the
composition mechanism. Arrays of ~256 items move between stages internally; the
per-item API is preserved on the outside. Node streams appear **only at the I/O
edges** (`fs`, `http`, `zlib`, `child_process`), never as the composition layer.

Core constants:

| constant            | value | rationale                        |
| ------------------- | ----- | -------------------------------- |
| `BATCH_SIZE`        | 256   | §2.4 — near-peak, bounded memory |
| `FLUSH_INTERVAL_MS` | 20    | §2.5 — latency for slow sources  |

Both overridable per stage.

Invariants every stage must uphold:

- Guard the await (`instanceof Promise`) — §2.2.
- Generators carry batches; **inside** a batch use a plain indexed `for` loop,
  never a generator or `Array.map`/`filter` — §2.7.
- Flush a partial batch on early termination (`take`, `break`, error).
- `unref()` the flush timer so it never holds the process open.

---

## 4. API

Validated signatures, condensed. Full sketch in `scratchpad/api-sketch/`.

```ts
interface StageOptions {
	parallel?: number | 'cpus'; // concurrent invocations of this stage
	unordered?: boolean; // emit in completion order; default false
	retry?: { times: number; backoff?: 'fixed' | 'exponential' };
}

interface WFStream<T> extends AsyncIterable<T> {
	// element-preserving
	filter<S extends T>(fn: (item: T, i: number) => item is S, opts?: StageOptions): WFStream<S>;
	filter(fn: (item: T, i: number) => Awaitable<boolean>, opts?: StageOptions): WFStream<T>;
	tap(fn: (item: T, i: number) => Awaitable<void>, opts?: StageOptions): WFStream<T>;
	take(n: number): WFStream<T>;
	drop(n: number): WFStream<T>;
	progress(label?: string): WFStream<T>;
	onError(policy: 'fail'): WFStream<T>;
	onError(policy: 'skip', handler?: (error: unknown, item: T) => void): WFStream<T>;

	// element-changing
	map<R>(fn: (item: T, i: number) => Awaitable<R>, opts?: StageOptions): WFStream<R>;
	flatMap<R>(fn: (item: T, i: number) => Awaitable<Iterable<R> | AsyncIterable<R>>, opts?: StageOptions): WFStream<R>;
	batch(size: number | { size: number; maxWaitMs?: number }): WFStream<T[]>;
	through<R>(recipe: Pipe<T, R>): WFStream<R>;
	as<R>(): WFStream<R>; // compile-time assertion
	validate<R>(schema: Schema<R>): WFStream<R>; // runtime-checked

	// terminals
	toArray(): Promise<T[]>;
	count(): Promise<number>;
	drain(): Promise<void>;
	forEach(fn: (item: T, i: number) => Awaitable<void>, opts?: StageOptions): Promise<void>;
	reduce<A>(fn: (acc: A, item: T, i: number) => Awaitable<A>, initial: A): Promise<A>;
	toFile<P extends string>(path: T extends WritableAs<FormatOf<P>> ? P : never): Promise<void>;
}

// Reusable recipe. `in`/`out` are load-bearing — see §2.6.
interface Pipe<in In, out Out> {
	/* same stages, returning Pipe<In, …> */
}
declare function pipe<T>(): Pipe<T, T>;

declare const from: {
	file<P extends string>(path: P, options?: FileOptions): WFStream<ElementOf<FormatOf<P>>>;
	file<F extends Format>(path: string, options: FileOptions & { format: F }): WFStream<ElementOf<F>>;
	url<P extends string>(url: P, options?: FileOptions): WFStream<ElementOf<FormatOf<P>>>;
	array<T>(items: readonly T[]): WFStream<T>;
	iterable<T>(items: Iterable<T> | AsyncIterable<T>): WFStream<T>;
	glob<P extends string>(pattern: P, options?: FileOptions): WFStream<ElementOf<FormatOf<P>>>;
	concat<S extends readonly WFStream<unknown>[]>(...s: S): WFStream<StreamElement<S[number]>>;
};
```

Element types are derived from the filename, stripping compression suffixes
recursively:

```ts
from.file('users.csv'); // WFStream<Record<string, string>>
from.file('events.ndjson.gz'); // WFStream<unknown>
from.file('events.jsonl.zst'); // WFStream<unknown>
from.file('notes.txt'); // WFStream<string>
from.file('x.dat', { format: 'ndjson' }); // explicit wins
```

`unknown` rather than `any` is deliberate: parsing a file cannot know its shape,
so the API says so and makes you choose `as<T>()` or `validate(schema)`.

### Usage

```ts
// The common case is one expression.
await from
	.file('events.ndjson.gz')
	.as<Event>()
	.filter((e) => e.type === 'purchase')
	.map((e) => ({ id: e.id, total: sum(e.items.map((i) => i.price)) }))
	.toFile('purchases.csv');

// Concurrency belongs to the stage that needs it.
const users = await from
	.array(userIds)
	.map(fetchUser, { parallel: 64 }) // I/O-bound
	.map(scoreUser, { parallel: 'cpus' }) // CPU-bound
	.toArray(); // input order preserved

// Pipelines are values: describe once, instantiate per run.
const cleanUsers = pipe<RawRow>()
	.filter((r) => r.id !== '')
	.map((r) => ({ id: Number(r.id), name: r.name.trim() }));

await from.file('a.csv').through(cleanUsers).toFile('a.ndjson');
await from.file('b.csv').through(cleanUsers).toFile('b.ndjson');
```

---

## 5. Scope

**In 3.0.0:** `map`, `filter`, `flatMap`, `batch`, `tap`, `take`, `drop`,
`through`/`pipe`; sources `array`, `iterable`, `file`, `url`; sinks `toArray`,
`forEach`, `reduce`, `count`, `toFile`, `drain`; `parallel` and error policy;
compression and format handling ported from 2.x.

**Deferred:** `glob`, `validate`, `retry`, `partitionBy`, web-stream interop,
`progress`. Each is additive, so nothing is foreclosed.

### What happens to the 2.x code

Of ~1,700 lines:

| category                                                    | lines | action                                                 |
| ----------------------------------------------------------- | ----: | ------------------------------------------------------ |
| Plumbing — `classes`, `merge`, `pipeline`, `wrapper`        |   532 | **Delete.** Replaced by the core; source of most bugs. |
| Logic — `split`, `parser`, `progress_bar`, `for_each_async` |  ~470 | **Port the logic**, drop the `Transform` wrapper.      |
| Edge I/O — `read`, `compress`, `spawn`                      |  ~340 | **Keep nearly as-is**, wrap at the boundary.           |

The 249 tests are the most valuable asset here, not the code. Roughly 196 encode
portable behaviour; ~53 tied to `wrapper`/`merge`/`pipeline` retire with the
plumbing.

---

## 6. Plan

1. ~~Outline + API definition~~ — done, type-validated (§2.6, §4).
2. ~~Benchmark the substrate and tune the batch~~ — done (§2.1–2.5).
3. **Port the test suite** as an executable spec against the 3.0 API, failing.
4. **Vertical slice** — `from.array().map().filter().toArray()` and
   `from.file().map().toFile()`. Prove backpressure, ordered-parallel and error
   propagation on one thin path before adding breadth.
5. **Port operations** per the three-way split above.
6. **Migration guide + release.**

---

## 7. TODOs

### Phase 3 — test suite as spec

- [ ] Port ~196 behavioural tests to the 3.0 API; retire the ~53 plumbing tests.
- [ ] Add cases for behaviour that only exists in the new core:
  - [ ] partial batch flushed on `take(n)` / early `break`
  - [ ] flush timer is `unref()`ed (process exits cleanly)
  - [ ] slow source emits within `FLUSH_INTERVAL_MS`
  - [ ] sync callback never hits an `await` (guard against regressing §2.2)
- [ ] Keep the type-level suite in CI (`tsc --noEmit` over the assertions).

### Phase 4 — core

- [ ] Batched async-iterator engine: source → stage → sink.
- [ ] Ordered parallel `map` with a **bounded** reorder window; decide and
      document the policy when the window fills (§8).
- [ ] Error propagation: first error wins, upstream cancelled, partial batches
      released.
- [ ] `pipe()` recipe builder producing fresh instances per `through()`.

### Phase 5 — operations

- [ ] Port line splitting from `split.ts` as a batched generator (keep the
      truncated-UTF-8-tail behaviour and its tests).
- [ ] Port CSV/TSV/NDJSON parsing from `parser.ts` (keep the documented
      non-RFC-4180 limitations).
- [ ] Wrap `read.ts` (redirects, timeouts), `compress.ts` (native zstd + CLI
      fallback), `spawn.ts` (stderr cap, EPIPE, signals) at the edge.
- [ ] Re-add `progress` on top of the new source metadata.

### Phase 6 — release

- [ ] Migration guide: 2.x → 3.0 mapping table.
- [ ] Decide compat strategy — clean break vs `work-faster/v2` entry point.
- [ ] Update `description` in `package.json` ("same as array.forEach, but in
      parallel" no longer describes the package).
- [ ] README rewrite around the fluent API.

---

## 8. Open questions

- **Ordered-parallel back-pressure policy.** `{ parallel: 64 }` with input
  ordering needs a reorder buffer that can grow if one item is slow. Bounded
  window is agreed; the behaviour when it fills (block vs error vs spill) is not.
- **Compat strategy** — clean break, or ship a 2.x entry point? Package has real
  download volume; this is a product decision, not a technical one.
- **Byte-aware batching.** `BATCH_SIZE` is count-based. If very large items prove
  common in practice, a byte cap may be worth adding; deferred until there is
  evidence.
- **`concat` for sources** did not exist in 2.x and is in the 3.0 API. Confirm it
  covers the "read many files as one stream" case that `glob` also targets.
