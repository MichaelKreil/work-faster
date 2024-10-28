import type { Transform } from 'node:stream';
import { createBrotliDecompress, createGunzip } from 'node:zlib';
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
