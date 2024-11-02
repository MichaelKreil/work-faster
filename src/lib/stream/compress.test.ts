import { compress, decompress } from './compress.js';
import { fromValue, toBuffer, toString } from './utils.js';

describe('Compression and Decompression', () => {
	const longString = 'This is a long string that we will use to test the compression and decompression functionality. '.repeat(100);

	const algorithms: { name: 'gzip' | 'brotli' | 'lz4' | 'zstd', expectedHex: string }[] = [
		{ name: 'gzip', expectedHex: '1f8b0800' },
		{ name: 'brotli', expectedHex: '1b7f2550' },
		{ name: 'lz4', expectedHex: '04224d18' },
		{ name: 'zstd', expectedHex: '28b52ffd' }
	];

	for (const { name, expectedHex } of algorithms) {
		it(`should compress and decompress ${name}`, async () => {
			const buffer = await toBuffer(fromValue(longString).pipe(await compress(name)));
			expect(buffer.subarray(0, 4).toString('hex')).toBe(expectedHex);
			const decompressedString = await toString(fromValue(buffer).pipe(await decompress(name)));
			expect(decompressedString).toBe(longString);
		});
	}
});
