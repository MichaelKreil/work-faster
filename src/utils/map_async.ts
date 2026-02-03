import { forEachAsync } from './for_each_async.js';

/**
 * Maps items in parallel, invoking a callback for each item and collecting results.
 * @param items - The items to iterate over (array, iterable, or async iterable)
 * @param callback - Async function called for each item, returning the mapped value
 * @param maxParallel - Maximum concurrent operations (defaults to CPU count)
 * @returns Array of mapped results in the same order as input items
 */
export async function mapAsync<I, O>(
	items: Iterable<I> | AsyncIterable<I> | Iterator<I> | AsyncIterator<I> | IterableIterator<I>,
	callback: (item: I, index: number) => Promise<O>,
	maxParallel?: number,
): Promise<O[]> {
	const result: O[] = [];
	await forEachAsync(
		items,
		async (item, index) => {
			result[index] = await callback(item, index);
		},
		maxParallel,
	);
	return result;
}
