import { forEachAsync } from './for_each_async.js';

export async function mapAsync<I, O>(
	items: Iterable<I> | AsyncIterable<I> | Iterator<I> | AsyncIterator<I>,
	callback: (item: I, index: number) => Promise<O>,
	maxParallel?: number
): Promise<O[]> {
	const result: O[] = [];
	await forEachAsync(items, async (item, index) => {
		result[index] = await callback(item, index);
	}, maxParallel)
	return result;
}
