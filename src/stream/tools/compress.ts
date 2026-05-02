import { PassThrough } from 'node:stream';
import { createBrotliDecompress, createGunzip, createGzip, createBrotliCompress, constants } from 'node:zlib';
import { spawn } from './spawn.js';
import type { Compression } from '../types.js';
import { wrapTransform } from './wrapper.js';
import { WFTransform } from '../classes.js';

// 'none' is a byte-mode passthrough so it composes with byte-mode
// compressors instead of switching the pipeline into object mode.
function bytePassThrough(): WFTransform<Buffer, Buffer> {
	return wrapTransform(new PassThrough());
}

export interface CompressOptions {
	/**
	 * The compression level to apply.
	 * - For `gzip`: Valid values are `0` (no compression) to `9` (maximum compression).
	 * - For `brotli`: Valid values are `0` (no compression) to `11` (maximum compression).
	 * - For `lz4`: Valid values are `1` (fastest) to `12` (slowest, highest compression).
	 * - For `zstd`: Valid values are `1` (fastest) to `22` (slowest, highest compression).
	 * Default level is used if not specified.
	 */
	level?: number;
}

const LEVEL_RANGES: Record<Exclude<Compression, 'none'>, [number, number]> = {
	gzip: [0, 9],
	brotli: [0, 11],
	lz4: [1, 12],
	zstd: [1, 22],
};

function checkLevel(type: Exclude<Compression, 'none'>, level: number | undefined): void {
	if (level === undefined) return;
	const [min, max] = LEVEL_RANGES[type];
	if (!Number.isInteger(level) || level < min || level > max) {
		throw new Error(`Invalid ${type} level ${level}; must be an integer in [${min}, ${max}]`);
	}
}

/**
 * Creates a transform stream to decompress data based on the specified compression type.
 *
 * @param type - The compression format to use for decompression:
 * - `'gzip'`: Gzip compression
 * - `'brotli'`: Brotli compression
 * - `'lz4'`: LZ4 compression (requires `lz4` CLI)
 * - `'zstd'`: Zstandard compression (requires `zstd` CLI)
 * - `'none'`: No compression (pass-through)
 *
 * @returns A `WFTransform` stream that decompresses the input data into raw data.
 * @throws An error if the specified compression type is unsupported.
 *
 * @example
 * const decompressStream = decompress('gzip');
 * sourceStream.pipe(decompressStream).pipe(destinationStream);
 */
export function decompress(type: Compression): WFTransform<Buffer, Buffer> {
	switch (type) {
		case 'brotli':
			return wrapTransform(createBrotliDecompress());
		case 'gzip':
			return wrapTransform(createGunzip());
		case 'lz4':
			return spawn('lz4', ['-d']);
		case 'zstd':
			return spawn('zstd', ['-d']);
		case 'none':
			return bytePassThrough();
		default:
			throw new Error(`Unsupported compression type: ${type}`);
	}
}

/**
 * Creates a transform stream to compress data based on the specified compression type and options.
 *
 * @param type - The compression format to use for compression:
 * - `'gzip'`: Gzip compression
 * - `'brotli'`: Brotli compression
 * - `'lz4'`: LZ4 compression (requires `lz4` CLI)
 * - `'zstd'`: Zstandard compression (requires `zstd` CLI)
 * - `'none'`: No compression (pass-through)
 *
 * @param options - Configuration options for compression:
 * - `level`: Specifies the compression level. Higher values result in better compression but slower speed.
 * Default levels are:
 * - `gzip`: `5`
 * - `brotli`: `5`
 * - `lz4`: `1`
 * - `zstd`: `3`
 *
 * @returns A `WFTransform` stream that compresses the input data.
 * @throws An error if the specified compression type is unsupported.
 *
 * @example
 * const compressStream = compress('brotli', { level: 9 });
 * sourceStream.pipe(compressStream).pipe(destinationStream);
 */
export function compress(type: Compression, options: CompressOptions = {}): WFTransform<Buffer, Buffer> {
	const { level } = options;
	if (type !== 'none') checkLevel(type, level);

	switch (type) {
		case 'brotli':
			return wrapTransform(
				createBrotliCompress({
					params: { [constants.BROTLI_PARAM_QUALITY]: level ?? 5 },
				}),
			);
		case 'gzip':
			return wrapTransform(createGzip({ level: level ?? 5 }));
		case 'lz4':
			return spawn('lz4', ['-' + (level ?? 1)]);
		case 'zstd':
			return spawn('zstd', ['-' + (level ?? 3)]);
		case 'none':
			return bytePassThrough();
		default:
			throw new Error(`Unsupported compression type: ${type}`);
	}
}
