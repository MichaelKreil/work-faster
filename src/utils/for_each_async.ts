import os from 'node:os';

/**
 * Iterates over items in parallel, invoking a callback for each item.
 *
 * @param items - The items to iterate over (array, iterable, or async iterable)
 * @param callback - Async function called for each item with the item and its index
 * @param maxParallel - Maximum concurrent operations. Defaults to `os.cpus().length`,
 *   which is appropriate for CPU-bound work. **For I/O-bound work (HTTP requests,
 *   disk reads, database queries) the CPU count is the wrong axis - the optimal
 *   parallelism is dictated by the remote service's capacity, not local cores.
 *   Pass an explicit value (e.g. 32 or 100) in those cases.**
 */
export function forEachAsync<I>(
	items: Iterable<I> | AsyncIterable<I> | Iterator<I> | AsyncIterator<I> | IterableIterator<I>,
	callback: (item: I, index: number) => Promise<void>,
	maxParallel?: number,
): Promise<void> {
	const concurrency = maxParallel ?? os.cpus().length;
	const iterator = getIterator(items);
	let index = 0;
	let finished = false;
	// Async iterators are not required to tolerate concurrent .next() calls.
	// Serialize all pulls behind a single in-flight promise so we never call
	// next() while a previous pull is still pending.
	let pulling: Promise<unknown> = Promise.resolve();

	function pull(): Promise<IteratorResult<I>> {
		const next = pulling.then(() => Promise.resolve(iterator.next()) as Promise<IteratorResult<I>>);
		pulling = next.catch(() => undefined);
		return next;
	}

	return new Promise((resolve, reject) => {
		let active = 0;

		const fail = (err: unknown) => {
			if (finished) return;
			finished = true;
			reject(err);
		};

		async function worker() {
			while (!finished) {
				let result: IteratorResult<I>;
				try {
					result = await pull();
				} catch (err) {
					return fail(err);
				}
				if (finished) return;
				if (result.done) return;

				const currentIndex = index++;
				active++;
				try {
					await callback(result.value, currentIndex);
				} catch (err) {
					return fail(err);
				} finally {
					active--;
				}
			}
		}

		const workers: Promise<void>[] = [];
		for (let i = 0; i < concurrency; i++) workers.push(worker());

		Promise.all(workers).then(() => {
			if (!finished && active === 0) {
				finished = true;
				resolve();
			}
		}, fail);
	});
}

function getIterator<V>(
	iterator: Iterable<V> | AsyncIterable<V> | Iterator<V> | AsyncIterator<V>,
): AsyncIterator<V> | Iterator<V> {
	if (Symbol.asyncIterator in iterator) return iterator[Symbol.asyncIterator]();
	if (Symbol.iterator in iterator) return iterator[Symbol.iterator]();
	return iterator;
}
