import type { Transform } from 'node:stream';
import { createBrotliDecompress, createGunzip } from 'node:zlib';
import { spawnProcessAsStream } from './spawn.js';

export type Compression = 'gzip' | 'brotli' | 'lz4' | 'zstd';

export function decompress(type: Compression): Transform {
	switch (type) {
		case 'gzip': return createGunzip();
		case 'brotli': return createBrotliDecompress();
		case 'zstd': return spawnProcessAsStream('zstd', ['-d']);
		case 'lz4': return spawnProcessAsStream('lz4', ['-d']);
	}
}
