import { merge } from './merge.js';
import { pipeline } from './pipeline.js';
import { wrapTransform, wrapWrite } from './wrapper.js';
import { fromArray, fromValue, toArray } from './utils.js';

describe('merge function', () => {
	function createWritable<T>() {
		const array: T[] = [];
		const writable = wrapWrite((item: T) => array.push(item));
		return { writable, array };
	};

	it('Readable + Transform = Readable', async () => {
		const readable = fromArray([1, 2, 3]);
		const transform = wrapTransform((data: number) => (data * 2).toFixed());

		const mergedReadable = merge(readable, transform);

		expect(await toArray(mergedReadable)).toEqual(['2', '4', '6']);
	});

	it('Transform + Writable = Writable', async () => {
		const transform = wrapTransform((data: number) => (data + 10).toFixed());
		const { writable, array } = createWritable<string>();

		const mergedWritable = merge(transform, writable);
		await pipeline(fromArray([1, 2, 3]), mergedWritable)

		expect(array).toEqual(['11', '12', '13']);
	});

	it('Transform + Transforms = Transform', async () => {
		const transform1 = wrapTransform((data: string) => parseInt(data, 10) * 3);
		const transform2 = wrapTransform((data: number) => (data + 5).toFixed());

		const mergedTransform = merge(transform1, transform2);
		const mergedRead = merge(fromArray(['1', '2', '3']), mergedTransform);

		expect(await toArray(mergedRead)).toEqual(['8', '11', '14']);
	});

	it('should handle errors in WFReadable to WFTransform merge', async () => {
		const readable = fromArray([1, 2, 3]);
		const transform = wrapTransform(() => {
			throw new Error('Test error');
		});

		const mergedReadable = merge(readable, transform);

		await expect(async () => {
			for await (const _ of mergedReadable) {
				// Do nothing
			}
		}).rejects.toThrow('Test error');
	});

	it('should handle errors in WFTransform to WFWritable merge', async () => {
		const transform = wrapTransform(() => {
			throw new Error('Test error');
		});
		const { writable } = createWritable();

		const mergedWritable = merge(transform, writable);
		fromValue(10).pipe(mergedWritable);

		await expect(
			new Promise((_, reject) => mergedWritable.inner.on('error', reject))
		).rejects.toThrow('Test error');
	});
});
