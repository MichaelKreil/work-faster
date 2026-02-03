import { mapAsync } from './map_async.js';

describe('mapAsync', () => {
	it('should map over an array and return results in order', async () => {
		const list = [1, 2, 3, 4];
		const result = await mapAsync(list, async (item) => item * 2);
		expect(result).toEqual([2, 4, 6, 8]);
	});

	it('should handle empty arrays', async () => {
		const list: number[] = [];
		const result = await mapAsync(list, async (item) => item * 2);
		expect(result).toEqual([]);
	});

	it('should pass index to callback', async () => {
		const list = ['a', 'b', 'c'];
		const result = await mapAsync(list, async (item, index) => `${item}${index}`);
		expect(result).toEqual(['a0', 'b1', 'c2']);
	});

	it('should respect maxParallel limit', async () => {
		const list = [1, 2, 3, 4, 5];
		const maxParallel = 2;
		let concurrentTasks = 0;
		let maxConcurrentTasks = 0;

		const result = await mapAsync(
			list,
			async (item) => {
				concurrentTasks++;
				maxConcurrentTasks = Math.max(maxConcurrentTasks, concurrentTasks);
				await new Promise((r) => setTimeout(r, 10));
				concurrentTasks--;
				return item * 2;
			},
			maxParallel,
		);

		expect(result).toEqual([2, 4, 6, 8, 10]);
		expect(maxConcurrentTasks).toBeLessThanOrEqual(maxParallel);
	});

	it('should work with async generators', async () => {
		async function* asyncGenerator() {
			yield 1;
			yield 2;
			yield 3;
		}

		const result = await mapAsync(asyncGenerator(), async (item) => item * 3);
		expect(result).toEqual([3, 6, 9]);
	});

	it('should work with sync generators', async () => {
		function* syncGenerator() {
			yield 10;
			yield 20;
			yield 30;
		}

		const result = await mapAsync(syncGenerator(), async (item) => item + 1);
		expect(result).toEqual([11, 21, 31]);
	});

	it('should reject if callback throws', async () => {
		const list = [1, 2, 3];
		await expect(
			mapAsync(list, async (item) => {
				if (item === 2) throw new Error('Test error');
				return item;
			}),
		).rejects.toThrow('Test error');
	});

	it('should maintain result order even with varying async durations', async () => {
		const list = [1, 2, 3, 4, 5];
		const result = await mapAsync(
			list,
			async (item) => {
				// Reverse delay - higher items finish first
				await new Promise((r) => setTimeout(r, (6 - item) * 5));
				return item * 10;
			},
			5,
		);
		expect(result).toEqual([10, 20, 30, 40, 50]);
	});
});
