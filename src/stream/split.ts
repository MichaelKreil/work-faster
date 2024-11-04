import { Transform } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import { WFReadable, WFTransform } from './types.js';

const MAX_BUFFER_SIZE = 16 * 1024 * 1024; // 16 MB

export function split(matcher: string | RegExp = /\r?\n/, format: BufferEncoding = 'utf8'): WFTransform<Buffer, string> {
	let last = '';
	const decoder = new StringDecoder(format);

	return new WFTransform(new Transform({
		autoDestroy: true,
		readableObjectMode: true,
		transform: function (chunk: string, enc: BufferEncoding, cb: () => void) {
			last += decoder.write(chunk);
			const lines = last.split(matcher);
			const lastIndex = lines.length - 1;
			for (let i = 0; i < lastIndex; i++) this.push(lines[i])
			last = lines[lastIndex];
			cb();
		},
		flush: function (cb: () => void) {
			if (last.length > 0) this.push(last);
			cb();
		}
	}))
}

export function splitLines(): WFTransform<Buffer, string> {
	let bufferChunks: Buffer[] = [];
	let accumulatedSize = 0;
	let lastChunk = Buffer.alloc(0);

	// Helper function to process a buffer, splitting it by 0x0a and pushing each part
	function processBuffer(push: (chunk: string) => void) {
		const buffer = Buffer.concat([lastChunk, ...bufferChunks]);
		let start = 0;
		let end;

		while ((end = buffer.indexOf(0x0a, start)) !== -1) {
			push(buffer.subarray(start, end).toString());
			start = end + 1;
		}

		// Return any remaining data that doesn't end in 0x0a
		lastChunk = buffer.subarray(start);
	}

	return new WFTransform(new Transform({
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
			// Push any remaining data as a final chunk
			if (lastChunk.length > 0) this.push(lastChunk.toString());
			callback();
		}
	}));
}

export async function* asLines(stream: WFReadable<Buffer | string>, matcher?: string | RegExp): AsyncIterable<string> {
	const lines: WFTransform<Buffer, string> = matcher ? split(matcher) : splitLines();
	for await (const line of stream.pipe(lines)) {
		yield line;
	}
}
