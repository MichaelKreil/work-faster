import os from 'node:os';
import { forEachAsync } from './for_each_async.js';

describe('forEachAsync', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should still process every item when os.cpus() reports no CPUs', async () => {
		// os.cpus() may return an empty array in restricted containers. A
		// concurrency of 0 would resolve without processing anything at all.
		vi.spyOn(os, 'cpus').mockReturnValue([]);
		const seen: number[] = [];

		await forEachAsync([1, 2, 3], async (item) => void seen.push(item));

		expect(seen).toEqual([1, 2, 3]);
	});

	it('should call the callback for each item in the list', async () => {
		const list = [1, 2, 3, 4];
		const callback = vi.fn(async () => {});

		await forEachAsync(list, callback);

		expect(callback).toHaveBeenCalledTimes(list.length);

		list.forEach((item, index) => {
			expect(callback).toHaveBeenCalledWith(item, index);
		});
	});

	it('should handle empty lists without error', async () => {
		const list: number[] = [];
		const callback = vi.fn(async () => {});

		await forEachAsync(list, callback);

		expect(callback).not.toHaveBeenCalled();
	});

	it('should reject when maxParallel is zero without processing any item', async () => {
		const callback = vi.fn(async () => {});

		await expect(forEachAsync([1, 2, 3, 4], callback, 0)).rejects.toThrow(RangeError);
		expect(callback).not.toHaveBeenCalled();
	});

	it('should reject when maxParallel is negative without processing any item', async () => {
		const callback = vi.fn(async () => {});

		await expect(forEachAsync([1, 2, 3, 4], callback, -1)).rejects.toThrow(RangeError);
		expect(callback).not.toHaveBeenCalled();
	});

	it('should reject when maxParallel is not an integer', async () => {
		const callback = vi.fn(async () => {});

		await expect(forEachAsync([1, 2, 3, 4], callback, 2.5)).rejects.toThrow(RangeError);
		expect(callback).not.toHaveBeenCalled();
	});

	it('should process every item when maxParallel is 1 (serial)', async () => {
		const list = [1, 2, 3, 4];
		const seen: number[] = [];

		await forEachAsync(list, async (item) => void seen.push(item), 1);

		expect(seen).toEqual(list);
	});

	it('should respect the maxParallel limit', async () => {
		const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const maxParallel = 2;
		let concurrentTasks = 0;
		let maxConcurrentTasks = 0;

		const callback = vi.fn(async () => {
			concurrentTasks++;
			maxConcurrentTasks = Math.max(maxConcurrentTasks, concurrentTasks);
			await randomWait(30);
			concurrentTasks--;
		});

		await forEachAsync(list, callback, maxParallel);

		expect(maxConcurrentTasks).toBeLessThanOrEqual(maxParallel);
	});

	it('should reject if any callback call rejects', async () => {
		const list = [1, 2, 3];
		const callback = vi.fn(async (item: number) => {
			if (item === 2) throw new Error('Test error');
		});

		await expect(forEachAsync(list, callback)).rejects.toThrow('Test error');
	});

	it('should resolve successfully when all callbacks are resolved', async () => {
		const list = [1, 2, 3];
		const callback = vi.fn(async () => await randomWait(10));

		await expect(forEachAsync(list, callback)).resolves.toBeUndefined();
	});

	it('should process a list of numbers asynchronously', async () => {
		const list = [1, 1, 2, 3, 5];

		await forEachAsync(list, async (item, index) => {
			list[index] = item + 2;
			await randomWait(10);
		});

		await forEachAsync(
			list,
			async (item, index) => {
				list[index] = item + 2;
				await randomWait(10);
			},
			3,
		);

		expect(list).toEqual([5, 5, 6, 7, 9]);
	});

	it('should process items from a synchronous generator', async () => {
		function* syncGenerator() {
			yield 1;
			yield 2;
			yield 3;
		}

		const callback = vi.fn(async () => {});
		await forEachAsync(syncGenerator(), callback);

		expect(callback).toHaveBeenCalledTimes(3);
		expect(callback).toHaveBeenNthCalledWith(1, 1, 0);
		expect(callback).toHaveBeenNthCalledWith(2, 2, 1);
		expect(callback).toHaveBeenNthCalledWith(3, 3, 2);
	});

	it('should process items from an asynchronous generator', async () => {
		async function* asyncGenerator() {
			yield 1;
			yield 2;
			yield 3;
		}

		const callback = vi.fn(async () => {});
		await forEachAsync(asyncGenerator(), callback);

		expect(callback).toHaveBeenCalledTimes(3);
		expect(callback).toHaveBeenNthCalledWith(1, 1, 0);
		expect(callback).toHaveBeenNthCalledWith(2, 2, 1);
		expect(callback).toHaveBeenNthCalledWith(3, 3, 2);
	});

	it('should process items from an iterator', async () => {
		const iterator = [1, 2, 3][Symbol.iterator]();
		const callback = vi.fn(async () => {});

		await forEachAsync(iterator, callback);

		expect(callback).toHaveBeenCalledTimes(3);
		expect(callback).toHaveBeenNthCalledWith(1, 1, 0);
		expect(callback).toHaveBeenNthCalledWith(2, 2, 1);
		expect(callback).toHaveBeenNthCalledWith(3, 3, 2);
	});

	it('should serialize calls to a non-reentrant async iterator', async () => {
		// A custom async iterator that throws if .next() is called while a
		// previous call is still pending (a strict but legal implementation).
		let inFlight = false;
		let counter = 0;
		const iter: AsyncIterator<number> = {
			async next() {
				if (inFlight) throw new Error('reentrant next() call');
				inFlight = true;
				try {
					await new Promise((r) => setTimeout(r, 1));
					if (counter >= 5) return { done: true, value: undefined as unknown as number };
					return { done: false, value: counter++ };
				} finally {
					inFlight = false;
				}
			},
		};
		const seen: number[] = [];
		await forEachAsync(
			iter,
			async (item) => {
				seen.push(item);
			},
			4,
		);
		expect(seen.sort()).toEqual([0, 1, 2, 3, 4]);
	});

	describe('after a callback rejects', () => {
		it('should stop pulling new items', async () => {
			const started: number[] = [];

			await expect(
				forEachAsync(
					[1, 2, 3, 4, 5, 6],
					async (item) => {
						started.push(item);
						if (item === 1) throw new Error('stop');
					},
					2,
				),
			).rejects.toThrow('stop');
			await randomWait(30);

			expect(started).not.toContain(6);
		});

		it('should leave callbacks that already started running to completion', async () => {
			// Documented behaviour, not an aspiration: nothing cancels or awaits
			// them, so a caller tearing down resources in a catch block races them.
			const finishedItems: number[] = [];

			await expect(
				forEachAsync(
					[1, 2],
					async (item) => {
						// Item 1 must fail only once item 2 is genuinely in flight;
						// failing synchronously would stop item 2 from ever starting.
						await new Promise((r) => setTimeout(r, 10));
						if (item === 1) throw new Error('fails first');
						await new Promise((r) => setTimeout(r, 40));
						finishedItems.push(item);
					},
					2,
				),
			).rejects.toThrow('fails first');

			expect(finishedItems).toEqual([]);
			await new Promise((r) => setTimeout(r, 100));
			expect(finishedItems).toEqual([2]);
		});

		it('should discard errors from callbacks still in flight', async () => {
			const unhandled = vi.fn();
			const secondThrew = vi.fn();
			process.on('unhandledRejection', unhandled);
			try {
				await expect(
					forEachAsync(
						[1, 2],
						async (item) => {
							await new Promise((r) => setTimeout(r, 10));
							if (item === 1) throw new Error('first');
							await new Promise((r) => setTimeout(r, 40));
							secondThrew();
							throw new Error('second');
						},
						2,
					),
				).rejects.toThrow('first');

				await new Promise((r) => setTimeout(r, 100));
				// The second callback did reach its throw, and that error went
				// nowhere: neither rethrown nor reported as an unhandled rejection.
				expect(secondThrew).toHaveBeenCalled();
				expect(unhandled).not.toHaveBeenCalled();
			} finally {
				process.off('unhandledRejection', unhandled);
			}
		});
	});

	it('should handle errors from an asynchronous generator', async () => {
		async function* asyncErrorGenerator() {
			yield 1;
			yield 2;
			throw new Error('Generator error');
		}

		const callback = vi.fn(async () => {});

		await expect(forEachAsync(asyncErrorGenerator(), callback)).rejects.toThrow('Generator error');
		expect(callback).toHaveBeenCalledTimes(2); // Should only process up to the error
	});
});

function randomWait(maxTime: number): Promise<void> {
	return new Promise((res) => setTimeout(res, Math.random() * maxTime));
}
