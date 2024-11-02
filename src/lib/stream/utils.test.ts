import { fromArray, toString, toBuffer, fromValue, toArray } from './utils.js';

describe('Stream Utility Functions', () => {
	describe('fromValue', () => {
		it('should create a stream from a string', async () => {
			const input = 'Hello, world!';
			expect(await toArray(fromValue(input))).toEqual([input]);
		});
		
		it('should create a stream from a buffer', async () => {
			const input = Buffer.from('Hello, world!');
			expect(await toArray(fromValue(input))).toEqual([input]);
		});
	});

	describe('fromArray', () => {
		it('should create a stream from an array of strings', async () => {
			const input = ['Hello, ', 'world!'];
			expect(await toArray(fromArray(input))).toEqual(input);
		});

		it('should create a stream from an array of buffers', async () => {
			const input = [Buffer.from('Hello, '), Buffer.from('world!')];
			expect(await toArray(fromArray(input))).toEqual(input);
		});
	});

	describe('toString', () => {
		it('should collect data from a stream and return it as a string', async () => {
			const input = 'Hello, world!';
			expect(await toString(fromValue(input))).toEqual(input);
		});
	});

	describe('toBuffer', () => {
		it('should collect data from a stream and return it as a buffer', async () => {
			const input = Buffer.from('Hello, world!');
			expect(await toBuffer(fromValue(input))).toEqual(input);
		});
	});

	describe('toArray', () => {
		it('should collect buffers', async () => {
			const input = [Buffer.from('Hello, '), Buffer.from('world!')];
			expect(await toArray(fromArray(input))).toEqual(input);
		});
		
		it('should collect strings', async () => {
			const input = ['Hello, ', 'world!'];
			expect(await toArray(fromArray(input))).toEqual(input);
		});
	});
});
