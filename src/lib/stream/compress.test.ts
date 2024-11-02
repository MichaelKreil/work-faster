import { compress, decompress } from './compress.js';
import { fromValue, toBuffer } from './utils.js';

describe('Compression and Decompression', () => {
	const longString = Buffer.from('This is a long string that we will use to test the compression and decompression functionality. '.repeat(3));
	const noise = Buffer.from(Int8Array.from({ length: 2000 }, (v, k) => 125 * Math.cos(k / 10)).buffer);
	const buffer = Buffer.concat([longString, noise, longString]);

	const algorithms: { name: 'gzip' | 'brotli' | 'lz4' | 'zstd', hexStart: string, hexEnd: string }[] = [
		{ name: 'gzip', hexStart: '1f8b0800', hexEnd: '100a0000' },
		{ name: 'brotli', hexStart: '1b0f0a00', hexEnd: '' },
		{ name: 'lz4', hexStart: '04224d18', hexEnd: '' },
		{ name: 'zstd', hexStart: '28b52ffd', hexEnd: '' }
	];

	for (const { name, hexStart, hexEnd } of algorithms) {
		it(`using ${name}: should correctly compress and decompress`, async () => {
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

		it(`using ${name}: level 9 should be smaller than level 1`, async () => {
			// Compress the string with level 1
			const compressedLevel1 = await toBuffer(fromValue(buffer).pipe(await compress(name, { level: 1 })));

			// Compress the string with level 9
			const compressedLevel9 = await toBuffer(fromValue(buffer).pipe(await compress(name, { level: 9 })));

			// Assert that compression at level 9 is more efficient (smaller) than at level 1
			expect(compressedLevel9.length).toBeLessThan(compressedLevel1.length);
		});
	};
});
