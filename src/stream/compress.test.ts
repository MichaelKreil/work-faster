import { compress, Compression, decompress } from './compress.js';
import { fromValue, toBuffer } from './utils.js';

describe('Compression and Decompression', () => {
	const longString = Buffer.from('This is a long string that we will use to test the compression and decompression functionality. '.repeat(3));
	const noise = Buffer.from(Int8Array.from({ length: 2000 }, (v, k) => 125 * Math.cos(k / 10)).buffer);
	const buffer = Buffer.concat([longString, noise, longString]);

	const algorithms: { name: Compression, hexStart: string, hexEnd: string }[] = [
		{ name: 'gzip', hexStart: '1f8b0800', hexEnd: '100a0000' },
		{ name: 'brotli', hexStart: '1b0f0a00', hexEnd: '' },
		{ name: 'lz4', hexStart: '04224d18', hexEnd: '' },
		{ name: 'zstd', hexStart: '28b52ffd', hexEnd: '' },
		{ name: 'none', hexStart: '', hexEnd: '' }
	];

	describe('should correctly compress and decompress', () => {
		for (const { name, hexStart, hexEnd } of algorithms) {
			it(name, async () => {
				// Compress the long string
				const compressedBuffer = await toBuffer(fromValue(buffer).pipe(await compress(name)));

				// Validate compression by checking the initial bytes of the compressed output
				expect(Buffer.isBuffer(compressedBuffer)).toBe(true);
				expect(compressedBuffer.length).toBeGreaterThan(0);
				const hex = compressedBuffer.toString('hex');
				if (hexStart.length > 0) expect(hex.slice(0, hexStart.length)).toBe(hexStart);
				if (hexEnd.length > 0) expect(hex.slice(-hexEnd.length)).toBe(hexEnd);

				// Decompress the buffer back to the original string
				const decompressedBuffer = await toBuffer(fromValue(compressedBuffer).pipe(await decompress(name)));

				// Verify that decompression yields the original string
				expect(decompressedBuffer).toEqual(buffer);
			});
		}
	})

	describe('level 9 should be smaller than level 1', () => {
		for (const { name } of algorithms) {
			if (name == 'none') continue;
			it(name, async () => {
				// Compress the string with level 1
				const compressedLevel1 = await toBuffer(fromValue(buffer).pipe(await compress(name, { level: 1 })));

				// Compress the string with level 9
				const compressedLevel9 = await toBuffer(fromValue(buffer).pipe(await compress(name, { level: 9 })));

				// Assert that compression at level 9 is more efficient (smaller) than at level 1
				expect(compressedLevel9.length).toBeLessThan(compressedLevel1.length);
			});
		}
	})


	it('should handle "none" compression by returning the original buffer', async () => {
		// Compress with 'none'
		const compressedBuffer = await toBuffer(fromValue(buffer).pipe(await compress('none')));

		// Validate that the compressed buffer is identical to the original
		expect(compressedBuffer).toEqual(buffer);

		// Decompress with 'none'
		const decompressedBuffer = await toBuffer(fromValue(compressedBuffer).pipe(await decompress('none')));

		// Validate that the decompressed buffer is also identical
		expect(decompressedBuffer).toEqual(buffer);
	});

	it('should throw an error for unsupported compression types during compression', async () => {
		await expect(compress('unsupported' as unknown as Compression)).rejects.toThrow('Unsupported compression type: unsupported');
	});

	it('should throw an error for unsupported compression types during decompression', async () => {
		await expect(decompress('unsupported' as unknown as Compression)).rejects.toThrow('Unsupported compression type: unsupported');
	});

	describe('should handle empty input correctly', () => {
		const emptyBuffer = Buffer.alloc(0);

		for (const { name } of algorithms) {
			it(name, async () => {
				// Compress and decompress empty input
				const compressedBuffer = await toBuffer(fromValue(emptyBuffer).pipe(await compress(name)));
				const decompressedBuffer = await toBuffer(fromValue(compressedBuffer).pipe(await decompress(name)));

				// Validate that decompression returns an empty buffer
				expect(decompressedBuffer).toEqual(emptyBuffer);
			})
		}
	});

	describe('should handle very large inputs without errors', () => {
		const largeBuffer = Buffer.alloc(10 ** 6, 'A'); // 1 MB of "A"
		for (const { name } of algorithms) {
			it(name, async () => {
				// Compress and decompress large input
				const compressedBuffer = await toBuffer(fromValue(largeBuffer).pipe(await compress(name)));
				const decompressedBuffer = await toBuffer(fromValue(compressedBuffer).pipe(await decompress(name)));

				// Validate that decompression returns the original buffer
				expect(decompressedBuffer.compare(largeBuffer)).toBe(0);
			});
		}
	})
});
