import { wrap, wrapRead, wrapTransform, wrapWrite, WFReadable, WFTransform, WFWritable } from './types.js';
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
			expect(await toArray(fromArray(['TestData']).pipe(wrappedFuncTransform))).toEqual(['TESTDATA'])
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
	});

	describe('WFWritable Class', () => {
		it('should write data as expected', done => {
			const writeFunc = jest.fn();
			const wfWritable = wrapWrite(writeFunc);

			wfWritable.inner.write(testData, () => {
				expect(writeFunc).toHaveBeenCalledWith(testData);
				done()
			});
		});
	});
});
