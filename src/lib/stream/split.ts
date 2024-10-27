import { Transform } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';

export function split(matcher: string | RegExp = /\r?\n/, format: BufferEncoding = 'utf8'): Transform {
	let last = '';
	const decoder = new StringDecoder(format);

	return new Transform({
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
	})
}
