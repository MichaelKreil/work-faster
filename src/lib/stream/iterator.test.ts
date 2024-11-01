// streamUtils.test.ts
import { Readable } from 'node:stream';
import { fromIter, toIter } from './iterator.js';

describe('fromIter', () => {
	it('should create a readable stream from an async iterable', async () => {
		async function* asyncGenerator() {
			yield 'chunk 1';
			yield 'chunk 2';
			yield 'chunk 3';
		}

		const readable = fromIter(asyncGenerator());

		const result: string[] = [];
		for await (const chunk of readable) {
			result.push(chunk.toString());
		}

		expect(result).toEqual(['chunk 1', 'chunk 2', 'chunk 3']);
	});
});

describe('toIter', () => {
	it('should create an async iterable from a readable stream', async () => {
		const readable = Readable.from(['chunk A', 'chunk B', 'chunk C']);
		const iterator = toIter(readable);

		const result: string[] = [];
		for await (const chunk of iterator) {
			result.push(String(chunk));
		}

		expect(result).toEqual(['chunk A', 'chunk B', 'chunk C']);
	});

	it('should handle an empty readable stream', async () => {
		const readable = Readable.from([]);
		const iterator = toIter(readable);

		const result: string[] = [];
		for await (const chunk of iterator) {
			result.push(String(chunk));
		}

		expect(result).toEqual([]);
	});
});
