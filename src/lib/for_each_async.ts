import os from 'node:os';

export function forEachAsync<V>(list: V[], callback: (item: V, index: number) => Promise<void>, maxParallel?: number): Promise<void> {
	const concurrency = (maxParallel == null) ? os.cpus().length : maxParallel;

	return new Promise((resolve, reject) => {
		let running = 0, index = 0, finished = false;

		queueMicrotask(next);

		function next() {
			if (finished) return;
			if (running >= concurrency) return;
			if (index >= list.length) {
				if (running === 0) {
					finished = true;
					resolve();
					return
				}
				return
			}

			running++;
			const currentIndex = index++;

			callback(list[currentIndex], currentIndex)
				.then(() => {
					running--;
					queueMicrotask(next)
				})
				.catch(err => {
					finished = true;
					reject(err);
				})

			if (running < concurrency) queueMicrotask(next);
		}
	})
}