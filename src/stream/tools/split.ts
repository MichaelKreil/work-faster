import { Transform } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import { WFReadable, WFTransform } from '../classes.js';

// Buffer size threshold before processing accumulated chunks.
// 16 MB balances memory usage with processing efficiency.
const MAX_BUFFER_SIZE = 16 * 1024 * 1024;

export function split(
	delimiter: number | string | RegExp = '\n',
	format: BufferEncoding = 'utf8',
): WFTransform<Buffer, string> {
	if (delimiter == null) return splitFast(10, format);
	if (typeof delimiter == 'string' && delimiter.length == 1 && delimiter.charCodeAt(0) < 127) {
		return splitFast(delimiter.charCodeAt(0), format);
	}
	if (typeof delimiter == 'number') {
		if (delimiter >= 127) throw new Error('numeric matcher must be < 127');
		return splitFast(delimiter, format);
	}
	return splitSlow(delimiter, format);
}

function splitSlow(matcher: string | RegExp = '\n', format: BufferEncoding = 'utf8'): WFTransform<Buffer, string> {
	let last = '';
	const decoder = new StringDecoder(format);

	return new WFTransform(
		new Transform({
			autoDestroy: true,
			readableObjectMode: true,
			transform: function (chunk: string, enc: BufferEncoding, cb: () => void) {
				last += decoder.write(chunk);
				const lines = last.split(matcher);
				const lastIndex = lines.length - 1;
				for (let i = 0; i < lastIndex; i++) this.push(lines[i]);
				last = lines[lastIndex];
				cb();
			},
			flush: function (cb: () => void) {
				if (last.length > 0) this.push(last);
				cb();
			},
		}),
	);
}

export function splitFast(code: number = 10, format: BufferEncoding = 'utf8'): WFTransform<Buffer, string> {
	let bufferChunks: Buffer[] = [];
	let accumulatedSize = 0;
	let lastChunk = Buffer.alloc(0);
	const decoder = new StringDecoder(format);

	// Helper function to process a buffer, splitting it by `code` and pushing each part.
	// StringDecoder gracefully handles truncated multi-byte sequences at the tail.
	function processBuffer(push: (chunk: string) => void) {
		const buffer = Buffer.concat([lastChunk, ...bufferChunks]);
		let start = 0;
		let end;

		while ((end = buffer.indexOf(code, start)) !== -1) {
			push(decoder.write(buffer.subarray(start, end)));
			start = end + 1;
		}

		// Return any remaining data that doesn't end in `code`
		lastChunk = buffer.subarray(start);
	}

	return new WFTransform(
		new Transform({
			autoDestroy: true,
			readableObjectMode: true,
			transform(chunk: Buffer, _encoding: BufferEncoding, callback: () => void) {
				// Accumulate chunks until we reach the threshold
				bufferChunks.push(chunk);
				accumulatedSize += chunk.length;

				if (accumulatedSize >= MAX_BUFFER_SIZE) {
					// Process the concatenated buffer and store any remaining data
					processBuffer(this.push.bind(this));
					bufferChunks = [];
					accumulatedSize = 0;
				}

				callback();
			},
			flush(callback: () => void) {
				// Process any remaining data in the buffer chunks
				if (bufferChunks.length > 0 || lastChunk.length > 0) {
					processBuffer(this.push.bind(this));
				}
				// Flush the decoder so any trailing partial sequence is finalized.
				if (lastChunk.length > 0) this.push(decoder.write(lastChunk));
				const tail = decoder.end();
				if (tail.length > 0) this.push(tail);
				callback();
			},
		}),
	);
}

export async function* asLines(
	stream: WFReadable<Buffer | string>,
	delimiter?: string | RegExp | number,
	format: BufferEncoding = 'utf8',
): AsyncGenerator<string> {
	let splitter: WFTransform<Buffer, string>;
	if (delimiter == null) {
		splitter = splitFast(10, format);
	} else if (typeof delimiter == 'string' && delimiter.length == 1 && delimiter.charCodeAt(0) < 127) {
		splitter = splitFast(delimiter.charCodeAt(0), format);
	} else if (typeof delimiter == 'number') {
		if (delimiter >= 127) throw new Error('numeric matcher must be < 127');
		splitter = splitFast(delimiter, format);
	} else {
		splitter = split(delimiter, format);
	}

	for await (const line of stream.pipe(splitter)) {
		yield line;
	}
}
