import { createBrotliDecompress, createGunzip, createGzip, createBrotliCompress } from 'node:zlib';
import { spawn } from './spawn.js';
import { type WFTransform, wrapTransform } from './types.js';

export type Compression = 'gzip' | 'brotli' | 'lz4' | 'zstd';

export function decompress(type: Compression): WFTransform<Buffer, Buffer> {
	switch (type) {
		case 'gzip': return wrapTransform(createGunzip());
		case 'brotli': return wrapTransform(createBrotliDecompress());
		case 'zstd': return spawn('zstd', ['-d']);
		case 'lz4': return spawn('lz4', ['-d']);
	}
}

export function compress(type: Compression): WFTransform<Buffer, Buffer> {
	switch (type) {
		case 'gzip': return wrapTransform(createGzip({ level: 9 }));
		case 'brotli': return wrapTransform(createBrotliCompress());
		case 'zstd': return spawn('zstd', []);
		case 'lz4': return spawn('lz4', []);
	}
}
