import { Readable, Transform } from 'node:stream';
import { WFReadable, WFTransform, wrapTransform } from './types.js';

export function fromValue<T>(input: T): WFReadable<T> {
	return new WFReadable(Readable.from([input]));
}

/**
 * Converts an array of strings or buffers into a readable stream.
 * @param input The array of strings or buffers to convert to a stream.
 * @returns A readable stream containing the array data.
 */
export function fromArray<T>(input: T[]): WFReadable<T> {
	return new WFReadable(Readable.from(input));
}

/**
 * Collects all data from a stream and returns it as a single string.
 * @param stream A readable stream to collect data from.
 * @returns A promise that resolves with the stream data as a string.
 */
export async function toString<I>(stream: WFReadable<Buffer | string> | WFTransform<I, Buffer | string>): Promise<string> {
	return (await toBuffer(stream)).toString();
}

/**
 * Collects all data from a stream and returns it as a single Buffer.
 * @param stream A readable stream to collect data from.
 * @returns A promise that resolves with the stream data as a Buffer.
 */
export async function toBuffer<I>(stream: WFReadable<Buffer | string> | WFTransform<I, Buffer | string>): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) chunks.push(Buffer.from(chunk));
	return Buffer.concat(chunks);
}

/**
 * Collects all data chunks from a stream and returns them in an array.
 * @param stream A readable stream to collect data from.
 * @returns A promise that resolves with an array of the stream data chunks.
 */
export async function toArray<I, O>(stream: WFReadable<O> | WFTransform<I, O>): Promise<O[]> {
	const chunks: O[] = [];
	for await (const chunk of stream) chunks.push(chunk);
	return chunks;
}

export async function arrayFromAsync<T>(iter: AsyncIterable<T>): Promise<T[]> {
	const array = [];
	for await (const item of iter) array.push(item);
	return array;
}

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
