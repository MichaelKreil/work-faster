import type { Transform } from 'node:stream';
import { createBrotliDecompress, createGunzip, createGzip, createBrotliCompress } from 'node:zlib';
import { spawn } from './spawn.js';

export type Compression = 'gzip' | 'brotli' | 'lz4' | 'zstd';

export function decompress(type: Compression): Transform {
	switch (type) {
		case 'gzip': return createGunzip();
		case 'brotli': return createBrotliDecompress();
		case 'zstd': return spawn('zstd', ['-d']);
		case 'lz4': return spawn('lz4', ['-d']);
	}
}

export function compress(type: Compression): Transform {
	switch (type) {
		case 'gzip': return createGzip({ level: 9 });
		case 'brotli': return createBrotliCompress();
		case 'zstd': return spawn('zstd', []);
		case 'lz4': return spawn('lz4', []);
	}
}
