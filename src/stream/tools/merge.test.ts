import { PassThrough } from 'node:stream';
import { merge } from './merge.js';
import { pipeline } from './pipeline.js';
import { wrapTransform, wrapWrite } from './wrapper.js';
import { fromArray, fromValue, toArray } from './utils.js';

describe('merge function', () => {
	function createWritable<T>() {
		const array: T[] = [];
		const writable = wrapWrite((item: T) => array.push(item));
		return { writable, array };
	}

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
		await pipeline(fromArray([1, 2, 3]), mergedWritable);

		expect(array).toEqual(['11', '12', '13']);
	});

	it('should not resolve end() before the destination has processed everything', async () => {
		const received: string[] = [];
		const transform = wrapTransform((data: number) => (data + 10).toFixed());
		const writable = wrapWrite(async (item: string) => {
			await new Promise((r) => setTimeout(r, 20));
			received.push(item);
		});

		const mergedWritable = merge(transform, writable);
		await mergedWritable.write(1);
		await mergedWritable.write(2);
		await mergedWritable.end();

		expect(received).toEqual(['11', '12']);
	});

	it('should not resolve end() before the tail of a longer chain has finished', async () => {
		const received: string[] = [];
		const transform1 = wrapTransform<number, number>(async (data) => {
			await new Promise((r) => setTimeout(r, 10));
			return data * 2;
		});
		const transform2 = wrapTransform((data: number) => data.toFixed());
		const writable = wrapWrite(async (item: string) => {
			await new Promise((r) => setTimeout(r, 10));
			received.push(item);
		});

		const merged = merge(merge(transform1, transform2), writable);
		await merged.write(1);
		await merged.write(2);
		await merged.end();

		expect(received).toEqual(['2', '4']);
	});

	it('should reject end() when the destination fails instead of crashing', async () => {
		// `pipe` does not forward the destination's error to the transform, so
		// without an explicit listener this is an unhandled 'error' event.
		const transform = wrapTransform((data: number) => data);
		const writable = wrapWrite(async () => {
			throw new Error('destination failed');
		});

		const merged = merge(transform, writable);
		await merged.write(1);

		await expect(merged.end()).rejects.toThrow('destination failed');
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

	it('should destroy the inner streams when the wrapper is destroyed', async () => {
		const inner1 = new PassThrough();
		const inner2 = new PassThrough();
		const merged = merge(wrapTransform(inner1), wrapTransform(inner2));

		merged.inner.destroy();
		await new Promise((r) => setImmediate(r));

		expect(inner1.destroyed).toBe(true);
		expect(inner2.destroyed).toBe(true);
	});

	it('should handle errors in WFTransform to WFWritable merge', async () => {
		const transform = wrapTransform(() => {
			throw new Error('Test error');
		});
		const { writable } = createWritable();

		const mergedWritable = merge(transform, writable);
		fromValue(10).pipe(mergedWritable);

		await expect(new Promise((_, reject) => mergedWritable.inner.on('error', reject))).rejects.toThrow('Test error');
	});
});
