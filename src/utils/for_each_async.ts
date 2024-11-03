import os from 'node:os';

export function forEachAsync<V>(
	items: Iterable<V> | AsyncIterable<V> | Iterator<V> | AsyncIterator<V>,
	callback: (item: V, index: number) => Promise<void>,
	maxParallel?: number
): Promise<void> {
	const concurrency = maxParallel ?? os.cpus().length;
	let index = 0;
	let finished = false;

	return new Promise((resolve, reject) => {
		let running = 0;
		const iterator = getIterator(items);

		async function next() {
			if (finished) return;
			if (running >= concurrency) return;

			try {
				const { done, value } = await iterator.next();
				if (done) {
					if (running === 0) {
						finished = true;
						resolve();
					}
					return;
				}

				running++;
				const currentIndex = index++;

				callback(value as V, currentIndex)
					.then(() => {
						running--;
						queueMicrotask(next);
					})
					.catch((err) => {
						finished = true;
						reject(err);
					});

				if (running < concurrency) queueMicrotask(next);
			} catch (err) {
				// If an error occurs in the iterator's next method
				finished = true;
				reject(err);
			}
		}

		queueMicrotask(next);
	});
}

function getIterator<V>(
	iterator: Iterable<V> | AsyncIterable<V> | Iterator<V> | AsyncIterator<V>
): AsyncIterator<V> | Iterator<V> {
	if (Symbol.asyncIterator in iterator) return iterator[Symbol.asyncIterator]()
	if (Symbol.iterator in iterator) return iterator[Symbol.iterator]()
	return iterator;
}
