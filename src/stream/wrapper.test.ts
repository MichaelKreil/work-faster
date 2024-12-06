import { wrap, wrapRead, wrapTransform, wrapWrite } from './wrapper.js';
import { WFReadable, WFTransform, WFWritable } from './classes.js';
import { Readable, Writable, Transform } from 'node:stream';
import { fromArray, toArray, toString } from './utils.js';
import { jest } from '@jest/globals';

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
	});

	describe('wrapRead function', () => {
		it('should wrap a Readable into WFReadable', () => {
			expect(wrapRead(new Readable())).toBeInstanceOf(WFReadable);
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
	});

	describe('wrapWrite function', () => {
		it('should wrap a Writable into WFWritable', () => {
			expect(wrapWrite(new Writable())).toBeInstanceOf(WFWritable);
		});

		it('should wrap a function into WFWritable', done => {
			const writeFunc = jest.fn();
			const wrappedFuncWrite = wrapWrite(writeFunc);
			expect(wrappedFuncWrite).toBeInstanceOf(WFWritable);
			wrappedFuncWrite.inner.write(testData, () => {
				expect(writeFunc).toHaveBeenCalledWith(testData);
				done();
			});
		});
	});

	describe('WFReadable Class', () => {
		it('should allow piping to a WFTransform', async () => {
			const wfReadable = fromArray(['a', 'b', 'c']);
			const wfTransform = wrapTransform((c: string) => c.toUpperCase());
			wfReadable.pipe(wfTransform);
			expect(await toString(wfTransform)).toEqual('ABC');
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
			const wfTransform = wrapTransform(chunk => new Promise(r => setTimeout(() => r(chunk), 10)));
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
	});

	describe('WFWritable Class', () => {
		it('should write data as expected', done => {
			const writeFunc = jest.fn();
			const wfWritable = wrapWrite(writeFunc);

			wfWritable.inner.write(testData, () => {
				expect(writeFunc).toHaveBeenCalledWith(testData);
				done();
			});
		});

		it('should respect backpressure in write method', async () => {
			// Simulates backpressure
			const wfWritable = wrapWrite(() => new Promise(r => setTimeout(() => r(), 10)));
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
