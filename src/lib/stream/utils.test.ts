import { flatten, fromValue, fromArray, toString, toBuffer, toArray } from './utils.js';
import { WFReadable } from './types.js';

describe('Utils Module', () => {

	describe('fromValue', () => {
		it('should create a WFReadable from a single value', async () => {
			const input = 'test value';
			const readable = fromValue(input);
			expect(readable).toBeInstanceOf(WFReadable);
			expect(await toString(readable)).toBe(input);
		});

		it('should handle buffer inputs correctly', async () => {
			const input = Buffer.from('buffer value');
			const readable = fromValue(input);
			expect(readable).toBeInstanceOf(WFReadable);
			expect(await toBuffer(readable)).toEqual(input);
		});
	});

	describe('fromArray', () => {
		it('should create a WFReadable from an array of strings', async () => {
			const input = ['value1', 'value2', 'value3'];
			const readable = fromArray(input);
			expect(readable).toBeInstanceOf(WFReadable);
			expect(await toArray(readable)).toEqual(input);
		});

		it('should create a WFReadable from an array of buffers', async () => {
			const input = [Buffer.from('buffer1'), Buffer.from('buffer2')];
			const readable = fromArray(input);
			expect(readable).toBeInstanceOf(WFReadable);
			expect(await toArray(readable)).toEqual(input);
		});
	});

	describe('toString', () => {
		it('should convert a WFReadable stream to a string', async () => {
			const input = 'stream to string';
			const readable = fromValue(input);
			expect(await toString(readable)).toBe(input);
		});

		it('should concatenate multiple chunks into a single string', async () => {
			const input = ['chunk1', 'chunk2', 'chunk3'];
			const readable = fromArray(input);
			expect(await toString(readable)).toBe(input.join(''));
		});
	});

	describe('toBuffer', () => {
		it('should convert a WFReadable stream to a Buffer', async () => {
			const input = 'convert to buffer';
			const readable = fromValue(Buffer.from(input));
			expect(await toBuffer(readable)).toEqual(Buffer.from(input));
		});

		it('should concatenate multiple buffer chunks into a single Buffer', async () => {
			const input = [Buffer.from('part1'), Buffer.from('part2'), Buffer.from('part3')];
			const readable = fromArray(input);
			expect(await toBuffer(readable)).toEqual(Buffer.concat(input));
		});
	});

	describe('toArray', () => {
		it('should convert a WFReadable stream to an array of chunks', async () => {
			const input = ['array element1', 'array element2'];
			const readable = fromArray(input);
			expect(await toArray(readable)).toEqual(input);
		});

		it('should handle streams with mixed data types', async () => {
			const input = [Buffer.from('buffer1'), 'string element', Buffer.from('buffer2')];
			const readable = fromArray(input);
			expect(await toArray(readable)).toEqual(input);
		});
	});

	describe('flatten', () => {
		it('should flatten a stream of arrays of objects into individual objects', async () => {
			const input = [[{ id: 1 }, { id: 2 }], [{ id: 3 }, { id: 4 }]];
			const readable = fromArray(input);
			const flattened = readable.pipe(flatten());

			const result = await toArray(flattened);
			expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
		});

		it('should handle multiple arrays in a stream', async () => {
			const input = [[{ id: 1 }], [{ id: 2 }, { id: 3 }], [{ id: 4 }]];
			const readable = fromArray(input);
			const flattened = readable.pipe(flatten());

			const result = await toArray(flattened);
			expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
		});

		it('should handle empty arrays without emitting any objects', async () => {
			const input = [[{ id: 1 }], [], [{ id: 2 }, { id: 3 }], []];
			const readable = fromArray(input);
			const flattened = readable.pipe(flatten());

			const result = await toArray(flattened);
			expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
		});
	});

	describe('Integration Tests', () => {
		it('should correctly handle conversion between different utility functions', async () => {
			const input = 'integration test data';
			const readable = fromValue(input);

			// Convert to buffer and back to string
			expect((await toBuffer(readable)).toString()).toBe(input);

			// Convert back to readable and to array
			expect(await toArray(fromArray([input]))).toEqual([input]);
		});

		it('should correctly handle a large array of data', async () => {
			const input = Array.from({ length: 1000 }, (_, i) => `data${i}`);
			expect(await toArray(fromArray(input))).toEqual(input);
			expect(await toString(fromArray(input))).toBe(input.join(''));
		});
	});
});
