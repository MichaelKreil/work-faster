import { compress, decompress } from './compress.js';
import { fromValue, toBuffer, toString } from './utils.js';

describe('Compression and Decompression', () => {
	const longString = 'This is a long string that we will use to test the compression and decompression functionality. '.repeat(100);

	it('should compress and decompress gzip', async () => {
		const buffer = await toBuffer(fromValue(longString).pipe(compress('gzip')));
		expect(buffer.subarray(0, 4).toString('hex')).toBe('1f8b0800');
		const decompressedString = await toString(fromValue(buffer).pipe(decompress('gzip')));
		expect(decompressedString).toBe(longString);
	});

	it('should compress and decompress brotli', async () => {
		const buffer = await toBuffer(fromValue(longString).pipe(compress('brotli')));
		expect(buffer.subarray(0, 4).toString('hex')).toBe('1b7f2550');
		const decompressedString = await toString(fromValue(buffer).pipe(decompress('brotli')));
		expect(decompressedString).toBe(longString);
	});

	it('should compress and decompress lz4', async () => {
		const buffer = await toBuffer(fromValue(longString).pipe(compress('lz4')));
		expect(buffer.subarray(0, 4).toString('hex')).toBe('04224d18');
		const decompressedString = await toString(fromValue(buffer).pipe(decompress('lz4')));
		expect(decompressedString).toBe(longString);
	});

	it('should compress and decompress zstd', async () => {
		const buffer = await toBuffer(fromValue(longString).pipe(compress('zstd')));
		expect(buffer.subarray(0, 4).toString('hex')).toBe('28b52ffd');
		const decompressedString = await toString(fromValue(buffer).pipe(decompress('zstd')));
		expect(decompressedString).toBe(longString);
	});
});
