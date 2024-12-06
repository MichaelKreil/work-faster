import { PassThrough, Readable, Transform } from 'node:stream';
import { WFReadable, WFTransform } from './classes.js';
import { wrapTransform } from './wrapper.js';

/**
 * Creates a readable stream from a single value.
 * 
 * @template T - The type of the input value.
 * @param input - The value to convert to a stream.
 * @returns A `WFReadable` stream containing the input value.
 * 
 * @example
 * const stream = fromValue('hello');
 * for await (const chunk of stream) {
 *   console.log(chunk); // 'hello'
 * }
 */
export function fromValue<T>(input: T): WFReadable<T> {
	return new WFReadable(Readable.from([input]));
}

/**
 * Creates a readable stream from an array of values.
 * 
 * @template T - The type of elements in the input array.
 * @param input - The array of values to convert to a stream.
 * @returns A `WFReadable` stream containing the array elements.
 * 
 * @example
 * const stream = fromArray([1, 2, 3]);
 * for await (const chunk of stream) {
 *   console.log(chunk); // 1, then 2, then 3
 * }
 */
export function fromArray<T>(input: T[]): WFReadable<T> {
	return new WFReadable(Readable.from(input));
}

/**
 * Converts a stream of `Buffer` or `string` data into a single concatenated string.
 * 
 * @template I - The type of input data chunks in the stream.
 * @param stream - A `WFReadable` or `WFTransform` stream to collect data from.
 * @returns A promise that resolves to the concatenated string.
 * 
 * @example
 * const data = await toString(stream);
 * console.log(data); // The concatenated string from the stream
 */
export async function toString<I>(stream: WFReadable<Buffer | string> | WFTransform<I, Buffer | string>): Promise<string> {
	return (await toBuffer(stream)).toString();
}

/**
 * Collects all data from a stream and concatenates it into a single `Buffer`.
 * 
 * @template I - The type of input data chunks in the stream.
 * @param stream - A `WFReadable` or `WFTransform` stream to collect data from.
 * @returns A promise that resolves to a `Buffer` containing the concatenated data.
 * 
 * @example
 * const buffer = await toBuffer(stream);
 * console.log(buffer.toString()); // The content of the stream as a string
 */
export async function toBuffer<I>(stream: WFReadable<Buffer | string> | WFTransform<I, Buffer | string>): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) chunks.push(Buffer.from(chunk));
	return Buffer.concat(chunks);
}

/**
 * Collects all chunks of data from a stream into an array.
 * 
 * @template I - The type of input data chunks in the stream.
 * @template O - The type of output data chunks in the stream.
 * @param stream - A `WFReadable` or `WFTransform` stream to collect data from.
 * @returns A promise that resolves to an array of the data chunks.
 * 
 * @example
 * const chunks = await toArray(stream);
 * console.log(chunks); // [chunk1, chunk2, ...]
 */
export async function toArray<I, O>(stream: WFReadable<O> | WFTransform<I, O>): Promise<O[]> {
	const chunks: O[] = [];
	for await (const chunk of stream) chunks.push(chunk);
	return chunks;
}

/**
 * Collects all elements from an `AsyncIterable` and returns them as an array.
 * 
 * @template T - The type of elements in the async iterable.
 * @param iter - An `AsyncIterable` to collect data from.
 * @returns A promise that resolves to an array of elements from the iterable.
 * 
 * @example
 * const array = await arrayFromAsync(asyncIterable);
 * console.log(array); // [item1, item2, ...]
 */
export async function arrayFromAsync<T>(iter: AsyncIterable<T>): Promise<T[]> {
	const array = [];
	for await (const item of iter) array.push(item);
	return array;
}

/**
 * Creates a transformation stream that flattens arrays of values into individual elements.
 * 
 * @template T - The type of elements in the input arrays.
 * @returns A `WFTransform` stream that emits individual elements from input arrays.
 * 
 * @example
 * const stream = flatten<number>();
 * stream.write([1, 2, 3]);
 * stream.end();
 * for await (const item of stream) {
 *   console.log(item); // 1, 2, 3
 * }
 */
export function flatten<T>(): WFTransform<T[], T> {
	return wrapTransform(new Transform({
		objectMode: true,
		transform(chunk: T[], _encoding, callback) {
			if (Array.isArray(chunk)) {
				for (const obj of chunk) this.push(obj);
			}
			callback();
		}
	}));
}

/**
 * Creates a pass-through transformation stream that forwards data unchanged.
 * 
 * @template T - The type of elements in the stream.
 * @returns A `WFTransform` stream that passes data through without modification.
 * 
 * @example
 * const stream = passThrough<number>();
 * stream.write(1);
 * stream.write(2);
 * stream.end();
 * for await (const item of stream) {
 *   console.log(item); // 1, 2
 * }
 */
export function passThrough<T>(): WFTransform<T, T> {
	return wrapTransform(new PassThrough({ objectMode: true }));
}
