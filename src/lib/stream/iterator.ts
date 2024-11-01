import { Readable } from 'node:stream';

export function fromIter(generator: AsyncIterable<unknown>): Readable {
	return Readable.from(generator);
}

export function toIter(readable: Readable): AsyncIterable<unknown> {
	return {
		[Symbol.asyncIterator]() {
			return readable[Symbol.asyncIterator]();
		}
	};
}
