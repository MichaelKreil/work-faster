import { createBrotliDecompress, createGunzip, createGzip, createBrotliCompress, constants } from 'node:zlib';
import { spawn } from './spawn.js';
import { type WFTransform, wrapTransform } from './types.js';

export type Compression = 'gzip' | 'brotli' | 'lz4' | 'zstd';

interface CompressOptions {
	level?: number; // Optional compression level, applicable for gzip and zstd
}

/**
 * Returns a transform stream to decompress data based on the specified compression type.
 * @param type - Compression type ('gzip', 'brotli', 'lz4', or 'zstd')
 * @throws Error if the specified compression type is unsupported
 */
export async function decompress(type: Compression): Promise<WFTransform<Buffer, Buffer>> {
	switch (type) {
		case 'brotli': return wrapTransform(createBrotliDecompress());
		case 'gzip': return wrapTransform(createGunzip());
		case 'lz4': return spawn('lz4', ['-d']);
		case 'zstd': return spawn('zstd', ['-d']);
		default: throw new Error(`Unsupported compression type: ${type}`);
	}
}

/**
 * Returns a transform stream to compress data based on the specified compression type and options.
 * @param type - Compression type ('gzip', 'brotli', 'lz4', or 'zstd')
 * @param options - Optional parameters for compression, such as level
 * @throws Error if the specified compression type is unsupported
 */
export async function compress(type: Compression, options: CompressOptions = {}): Promise<WFTransform<Buffer, Buffer>> {
	const { level } = options;

	switch (type) {
		case 'brotli': return wrapTransform(createBrotliCompress({ params: { [constants.BROTLI_PARAM_QUALITY]: level ?? 5 } }));
		case 'gzip': return wrapTransform(createGzip({ level: level ?? 5 }));
		case 'lz4': return spawn('lz4', ['-' + (level ?? 1)]);
		case 'zstd': return spawn('zstd', ['-' + (level ?? 3)]);
		default:
			throw new Error(`Unsupported compression type: ${type}`);
	}
}
