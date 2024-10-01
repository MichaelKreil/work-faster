import { streamFileData, forEachAsync } from './index.js';

describe('Utility Functions', () => {

	describe('forEachAsync', () => {
		it('should process a list of numbers asynchronously', async () => {
			const list = [1, 1, 2, 3, 5];

			// First synchronous forEach
			list.forEach((item, index) => {
				list[index] = item + 2;
			});

			// First forEachAsync with default concurrency
			await forEachAsync(list, async (item, index) => {
				list[index] = item + 2;
				await new Promise(res => setTimeout(res, 1));
			});

			// Second forEachAsync with concurrency of 3
			await forEachAsync(list, async (item, index) => {
				list[index] = item + 2;
				await new Promise(res => setTimeout(res, 1));
			}, 3);

			// Verify the expected list values
			expect(list).toEqual([7, 7, 8, 9, 11]);
		});
	});

	describe('streamFileData', () => {
		it('should stream file data without errors', async () => {
			const file = 'test/test.csv.br';
			const stream = await streamFileData(file, { progress: true, fast: true });

			for await (const _line of stream) {
				// Here we would normally verify the contents of the line, but for now, we just iterate.
			}

			// Add an assertion to ensure the stream operation completed
			expect(stream).toBeDefined();
		});
	});
});
