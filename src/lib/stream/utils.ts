import { Readable } from 'node:stream';

/**
 * Converts a string into a readable stream.
 * @param input The string to convert to a stream.
 * @returns A readable stream containing the string data.
 */
export function fromString(input: string): Readable {
	return Readable.from([input], { encoding: 'utf-8' });
}

/**
 * Converts a buffer into a readable stream.
 * @param input The buffer to convert to a stream.
 * @returns A readable stream containing the buffer data.
 */
export function fromBuffer(input: Buffer): Readable {
	return Readable.from([input]);
}

/**
 * Converts an array of strings or buffers into a readable stream.
 * @param input The array of strings or buffers to convert to a stream.
 * @returns A readable stream containing the array data.
 */
export function fromArray(input: (Buffer | string)[]): Readable {
	return Readable.from(input);
}

/**
 * Collects all data from a stream and returns it as a single string.
 * @param stream A readable stream to collect data from.
 * @returns A promise that resolves with the stream data as a string.
 */
export async function toString(stream: Readable): Promise<string> {
	return (await toBuffer(stream)).toString('utf-8');
}

/**
 * Collects all data from a stream and returns it as a single Buffer.
 * @param stream A readable stream to collect data from.
 * @returns A promise that resolves with the stream data as a Buffer.
 */
export async function toBuffer(stream: Readable): Promise<Buffer> {
	return Buffer.concat(await toBufferArray(stream));
}

/**
 * Collects all data chunks from a stream and returns them in an array.
 * @param stream A readable stream to collect data from.
 * @returns A promise that resolves with an array of the stream data chunks.
 */
export async function toBufferArray(stream: Readable): Promise<Buffer[]> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return chunks;
}


/**
 * Collects all data chunks from a stream and returns them in an array.
 * @param stream A readable stream to collect data from.
 * @returns A promise that resolves with an array of the stream data chunks.
 */
export async function toStringArray(stream: Readable): Promise<string[]> {
	const chunks: string[] = [];
	for await (const chunk of stream) {
		if (typeof chunk == 'string') {
			chunks.push(chunk);
		} else if (Buffer.isBuffer(chunk)) {
			chunks.push(chunk.toString('utf8'));
		} else {
			chunk.push(String(chunk));
		}
	}
	return chunks;
}
