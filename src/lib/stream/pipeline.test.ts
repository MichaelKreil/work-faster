// pipeline.test.ts
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from './pipeline.js';
import { wrapWrite } from './types.js';

describe('pipeline', () => {
	it('should handle a pipeline with readable, transform, and writable streams', async () => {
		const readable = Readable.from(['chunk1', 'chunk2', 'chunk3']);

		const transform = new Transform({
			objectMode: true,
			transform(chunk, _encoding, callback) {
				callback(null, chunk.toString().toUpperCase());
			},
		});

		const output: string[] = [];
		const writable = new Writable({
			objectMode: true,
			write(chunk, _encoding, callback) {
				output.push(chunk.toString());
				callback();
			},
		});

		await pipeline(readable, transform, writable);

		expect(output).toEqual(['CHUNK1', 'CHUNK2', 'CHUNK3']);
	});

	it('should handle a pipeline with async function as transform', async () => {
		const readable = Readable.from(['chunk1', 'chunk2', 'chunk3']);

		const asyncTransform = async (chunk: string): Promise<string> => {
			return chunk.toUpperCase();
		};

		const output: string[] = [];
		const writable = new Writable({
			objectMode: true,
			write(chunk: string, _encoding, callback) {
				output.push(chunk);
				callback();
			},
		});

		await pipeline(readable, asyncTransform, writable);

		expect(output).toEqual(['CHUNK1', 'CHUNK2', 'CHUNK3']);
	});

	it('should handle a pipeline with async function as writable', async () => {
		const readable = Readable.from(['chunk1', 'chunk2', 'chunk3']);

		const asyncWritable = async (chunk: unknown) => {
			expect(String(chunk)).toMatch(/CHUNK[123]/);
		};

		await pipeline(readable, async (chunk) => chunk.toString().toUpperCase(), asyncWritable);
	});

	it('should process an async iterable as readable input', async () => {
		async function* asyncGenerator() {
			yield 'async1';
			yield 'async2';
			yield 'async3';
		}

		const output: string[] = [];
		const writable = wrapWrite((chunk: string) => output.push(chunk));
		await pipeline(asyncGenerator(), (chunk) => chunk.toString().toUpperCase(), writable);

		expect(output).toEqual(['ASYNC1', 'ASYNC2', 'ASYNC3']);
	});

	it('should handle a pipeline with synchronous iterable as readable input', async () => {
		const iterable = ['iterable1', 'iterable2', 'iterable3'];

		const output: string[] = [];
		const writable = new Writable({
			objectMode: true,
			write(chunk, _encoding, callback) {
				output.push(chunk.toString());
				callback();
			},
		});

		await pipeline(iterable, (chunk) => chunk.toString().toUpperCase(), writable);

		expect(output).toEqual(['ITERABLE1', 'ITERABLE2', 'ITERABLE3']);
	});
});
