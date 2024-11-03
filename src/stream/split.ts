import { Transform } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import { WFReadable, WFTransform } from './types.js';

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
			this.push(last);
			cb();
		}
	}))
}

export async function* asLines(stream: WFReadable<Buffer | string>, matcher?: string | RegExp): AsyncIterable<string> {
	for await (const line of stream.pipe(split(matcher))) {
		yield line;
	}
}
