import { wrap, wrapRead, wrapTransform, wrapWrite } from './wrapper.js';
import { WFReadable, WFTransform, WFWritable } from '../classes.js';
import { Readable, Writable, Transform } from 'node:stream';
import { fromArray, toArray, toString } from './utils.js';

describe('Stream Wrapper Functions', () => {
	// Test data
	const testData = Buffer.from('test data');

	describe('wrap function', () => {
		it('should wrap a Readable stream', () => {
			expect(wrap(new Readable())).toBeInstanceOf(WFReadable);
		});

		it('should wrap a Writable stream', () => {
			expect(wrap(new Writable())).toBeInstanceOf(WFWritable);
		});

		it('should wrap a Transform stream', () => {
			expect(wrap(new Transform())).toBeInstanceOf(WFTransform);
		});

		it('should wrap an async iterable', () => {
			async function* gen() {
				yield 1;
			}
			expect(wrap(gen())).toBeInstanceOf(WFReadable);
		});

		it('should wrap a sync iterable', () => {
			expect(wrap([1, 2, 3])).toBeInstanceOf(WFReadable);
		});

		it('should wrap a function', () => {
			expect(wrap((x: number) => x * 2)).toBeInstanceOf(WFTransform);
		});

		it('should throw for unknown stream types', () => {
			expect(() => wrap({} as Readable)).toThrow('unknown stream');
		});
	});

	describe('wrapRead function', () => {
		it('should wrap a Readable into WFReadable', () => {
			expect(wrapRead(new Readable())).toBeInstanceOf(WFReadable);
		});

		it('should return the same WFReadable if already wrapped', () => {
			const wfReadable = new WFReadable(new Readable());
			expect(wrapRead(wfReadable)).toBe(wfReadable);
		});

		it('should wrap an async iterable', async () => {
			async function* gen() {
				yield 'a';
				yield 'b';
			}
			const wrapped = wrapRead(gen());
			expect(wrapped).toBeInstanceOf(WFReadable);
			expect(await toArray(wrapped)).toEqual(['a', 'b']);
		});

		it('should wrap a sync iterable', async () => {
			const wrapped = wrapRead(['x', 'y', 'z']);
			expect(wrapped).toBeInstanceOf(WFReadable);
			expect(await toArray(wrapped)).toEqual(['x', 'y', 'z']);
		});

		it('should throw for unknown readable types', () => {
			expect(() => wrapRead({} as Readable)).toThrow('unknown readable');
		});
	});

	describe('wrapTransform function', () => {
		it('should wrap a Transform into WFTransform', () => {
			expect(wrapTransform(new Transform())).toBeInstanceOf(WFTransform);
		});

		it('should wrap a function into WFTransform', async () => {
			const wrappedFuncTransform = wrapTransform((data: string) => data.toString().toUpperCase());
			expect(wrappedFuncTransform).toBeInstanceOf(WFTransform);
			expect(await toArray(fromArray(['TestData']).pipe(wrappedFuncTransform))).toEqual(['TESTDATA']);
		});

		it('should return the same WFTransform if already wrapped', () => {
			const wfTransform = new WFTransform(new Transform());
			expect(wrapTransform(wfTransform)).toBe(wfTransform);
		});

		it('should handle errors thrown in transform function', async () => {
			const errorTransform = wrapTransform(() => {
				throw new Error('Transform error');
			});
			const readable = fromArray(['test']);
			readable.pipe(errorTransform);

			await expect(toArray(errorTransform)).rejects.toThrow('Transform error');
		});

		it('should handle non-Error throws in transform function', async () => {
			const errorTransform = wrapTransform(() => {
				throw 'string error';
			});
			const readable = fromArray(['test']);
			readable.pipe(errorTransform);

			await expect(toArray(errorTransform)).rejects.toThrow('string error');
		});

		it('should throw for unknown transform types', () => {
			expect(() => wrapTransform({} as Transform)).toThrow('unknown transform');
		});
	});

	describe('wrapWrite function', () => {
		it('should wrap a Writable into WFWritable', () => {
			expect(wrapWrite(new Writable())).toBeInstanceOf(WFWritable);
		});

		it('should wrap a function into WFWritable', () =>
			new Promise<void>((done) => {
				const writeFunc = vi.fn();
				const wrappedFuncWrite = wrapWrite(writeFunc);
				expect(wrappedFuncWrite).toBeInstanceOf(WFWritable);
				wrappedFuncWrite.inner.write(testData, () => {
					expect(writeFunc).toHaveBeenCalledWith(testData);
					done();
				});
			}));

		it('should return the same WFWritable if already wrapped', () => {
			const wfWritable = new WFWritable(new Writable());
			expect(wrapWrite(wfWritable)).toBe(wfWritable);
		});

		it('should handle errors thrown in write function', async () => {
			const errorWrite = wrapWrite(async () => {
				throw new Error('Write error');
			});

			await expect(
				new Promise((_, reject) => {
					errorWrite.inner.on('error', reject);
					errorWrite.inner.write('test');
				}),
			).rejects.toThrow('Write error');
		});

		it('should handle non-Error throws in write function', async () => {
			const errorWrite = wrapWrite(async () => {
				throw 'string error';
			});

			await expect(
				new Promise((_, reject) => {
					errorWrite.inner.on('error', reject);
					errorWrite.inner.write('test');
				}),
			).rejects.toThrow('string error');
		});

		it('should throw for unknown writable types', () => {
			expect(() => wrapWrite({} as Writable)).toThrow('unknown writable');
		});
	});

	describe('WFReadable Class', () => {
		it('should allow piping to a WFTransform', async () => {
			const wfReadable = fromArray(['a', 'b', 'c']);
			const wfTransform = wrapTransform((c: string) => c.toUpperCase());
			wfReadable.pipe(wfTransform);
			expect(await toString(wfTransform)).toEqual('ABC');
		});

		it('should allow piping to a Duplex directly', async () => {
			const wfReadable = fromArray(['x', 'y', 'z']);
			const transform = new Transform({
				objectMode: true,
				transform(chunk, _enc, cb) {
					cb(null, chunk.toUpperCase());
				},
			});
			const result = wfReadable.pipe(transform as unknown as WFTransform<string, string>);
			expect(result).toBeInstanceOf(WFTransform);
		});

		it('should be async iterable', async () => {
			const wfReadable = fromArray([1, 2, 3]);
			const result: number[] = [];
			for await (const item of wfReadable) {
				result.push(item);
			}
			expect(result).toEqual([1, 2, 3]);
		});
	});

	describe('WFTransform Class', () => {
		it('should transform data as expected', async () => {
			const wfReadable = fromArray(['1', '2', '3']);
			const wfTransform = wrapTransform((c: string) => parseFloat(c) * 3);
			wfReadable.pipe(wfTransform);
			expect(await toArray(wfTransform)).toEqual([3, 6, 9]);
		});

		it('should respect backpressure in write method', async () => {
			// Simulates backpressure
			const wfTransform = wrapTransform((chunk) => new Promise((r) => setTimeout(() => r(chunk), 10)));
			for (let i = 0; i < wfTransform.inner.writableHighWaterMark; i++) wfTransform.write(testData);
			expect(wfTransform.inner.write(testData)).toBe(false); // write returns false, indicating backpressure
		});

		it('should complete the stream with end method', async () => {
			const mockDuplex = new Transform();
			const wfTransform = new WFTransform(mockDuplex);

			const endPromise = wfTransform.end();
			mockDuplex.emit('finish'); // Simulate stream finishing
			await endPromise; // waits for finish
		});

		it('should allow piping to a Duplex directly', async () => {
			const wfTransform1 = wrapTransform((x: number) => x * 2);
			const transform = new Transform({
				objectMode: true,
				transform(chunk, _enc, cb) {
					cb(null, chunk + 1);
				},
			});
			const result = wfTransform1.pipe(transform);
			expect(result).toBeInstanceOf(WFTransform);
		});

		it('should be async iterable', async () => {
			const wfReadable = fromArray([1, 2, 3]);
			const wfTransform = wrapTransform((x: number) => x * 10);
			wfReadable.pipe(wfTransform);

			const result: number[] = [];
			for await (const item of wfTransform) {
				result.push(item);
			}
			expect(result).toEqual([10, 20, 30]);
		});
	});

	describe('WFWritable Class', () => {
		it('should write data as expected', () =>
			new Promise<void>((done) => {
				const writeFunc = vi.fn();
				const wfWritable = wrapWrite(writeFunc);

				wfWritable.inner.write(testData, () => {
					expect(writeFunc).toHaveBeenCalledWith(testData);
					done();
				});
			}));

		it('should respect backpressure in write method', async () => {
			// Simulates backpressure
			const wfWritable = wrapWrite(() => new Promise((r) => setTimeout(() => r(), 10)));
			for (let i = 0; i < wfWritable.inner.writableHighWaterMark; i++) wfWritable.write(testData);
			expect(wfWritable.inner.write(testData)).toBe(false); // write returns false, indicating backpressure
		});

		it('should complete the stream with end method', async () => {
			const mockWritable = new Writable();
			const wfWritable = new WFWritable(mockWritable);
			const endPromise = wfWritable.end();
			mockWritable.emit('finish'); // Simulate stream finishing
			await endPromise; // waits for finish
		});
	});
});
