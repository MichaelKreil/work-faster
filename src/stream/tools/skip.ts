import { Transform } from 'node:stream';
import { WFTransform } from '../classes.js';

export function skipEmptyLines(): WFTransform<string, string> {
	return new WFTransform(new Transform({
		objectMode: true,
		transform(chunk, _encoding, callback) {
			if (chunk) return callback(null, chunk);
			callback(null, null);
		}
	}));
}