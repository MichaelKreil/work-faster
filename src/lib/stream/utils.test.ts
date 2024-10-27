// streamUtils.test.ts
import { Readable } from 'node:stream';
import { fromString, fromBuffer, fromArray, toString, toBuffer, toBufferArray, toStringArray } from './utils.js';

describe('Stream Utility Functions', () => {
	describe('fromString', () => {
		it('should create a stream from a string', async () => {
			const input = 'Hello, world!';
			const stream = fromString(input);

			const result = await toString(stream);
			expect(result).toBe(input);
		});
	});

	describe('fromBuffer', () => {
		it('should create a stream from a buffer', async () => {
			const input = Buffer.from('Hello, world!');
			const stream = fromBuffer(input);

			const result = await toBuffer(stream);
			expect(result.equals(input)).toBe(true);
		});
	});

	describe('fromArray', () => {
		it('should create a stream from an array of strings', async () => {
			const input = ['Hello, ', 'world!'];
			const stream = fromArray(input);

			const result = await toString(stream);
			expect(result).toBe('Hello, world!');
		});

		it('should create a stream from an array of buffers', async () => {
			const input = [Buffer.from('Hello, '), Buffer.from('world!')];
			const stream = fromArray(input);

			const result = await toBuffer(stream);
			expect(result.toString()).toBe('Hello, world!');
		});
	});

	describe('toString', () => {
		it('should collect data from a stream and return it as a string', async () => {
			const input = 'Hello, world!';
			const stream = Readable.from([input]);

			const result = await toString(stream);
			expect(result).toBe(input);
		});
	});

	describe('toBuffer', () => {
		it('should collect data from a stream and return it as a buffer', async () => {
			const input = Buffer.from('Hello, world!');
			const stream = Readable.from([input]);

			const result = await toBuffer(stream);
			expect(result.equals(input)).toBe(true);
		});
	});

	describe('toBufferArray', () => {
		it('should collect data chunks from a stream and return them in an array of buffers', async () => {
			const input = [Buffer.from('Hello, '), Buffer.from('world!')];
			const result = await toBufferArray(fromArray(input));
			expect(result).toHaveLength(input.length);
			expect(result[0]).toStrictEqual(input[0]);
			expect(result[1]).toStrictEqual(input[1]);
		});
	});

	describe('toStringArray', () => {
		it('should collect data chunks from a stream and return them in an array of strings', async () => {
			const input = ['Hello, ', 'world!'];
			const result = await toStringArray(fromArray(input));
			expect(result).toHaveLength(input.length);
			expect(result[0]).toStrictEqual(input[0]);
			expect(result[1]).toStrictEqual(input[1]);
		});
	});
});
