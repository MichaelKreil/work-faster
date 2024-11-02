import { Readable } from 'node:stream';
import { WFReadable } from './types.js';

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
export async function toString(stream: WFReadable<Buffer | string>): Promise<string> {
	return (await toBuffer(stream)).toString();
}

/**
 * Collects all data from a stream and returns it as a single Buffer.
 * @param stream A readable stream to collect data from.
 * @returns A promise that resolves with the stream data as a Buffer.
 */
export async function toBuffer(stream: WFReadable<Buffer | string>): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) chunks.push(Buffer.from(chunk));
	return Buffer.concat(chunks);
}

/**
 * Collects all data chunks from a stream and returns them in an array.
 * @param stream A readable stream to collect data from.
 * @returns A promise that resolves with an array of the stream data chunks.
 */
export async function toArray<T>(stream: WFReadable<T>): Promise<T[]> {
	const chunks: T[] = [];
	for await (const chunk of stream) chunks.push(chunk);
	return chunks;
}
