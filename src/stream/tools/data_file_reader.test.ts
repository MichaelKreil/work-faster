import { fromValue, toArray, toBuffer } from './utils.js';
import { jest } from '@jest/globals';
import { Compression, Format } from '../types.js';
import { compress } from './compress.js';

// Mock dependencies with unstable_mockModule
jest.unstable_mockModule('./read.js', () => ({
	read: jest.fn(),
}));
jest.unstable_mockModule('../../utils/progress_bar.js', () => ({
	ProgressBar: jest.fn().mockImplementation(() => ({
		update: jest.fn(),
		close: jest.fn(),
	})),
}));

// Importing modules after mocking them
const { read } = await import('./read.js');
const { ProgressBar } = await import('../../utils/progress_bar.js');
const { readDataFile } = await import('./data_file_reader.js');

describe('readDataFile', () => {
	const cache = new Map<string, Buffer>();

	const formats: { format: Format, input: string, output: unknown[] }[] = [
		{ format: 'csv', input: 'c1,c2\nv1,v2\nv3,v4', output: [{ c1: 'v1', c2: 'v2' }, { c1: 'v3', c2: 'v4' }] },
		{ format: 'tsv', input: 'c1\tc2\nv1\tv2\nv3\tv4', output: [{ c1: 'v1', c2: 'v2' }, { c1: 'v3', c2: 'v4' }] },
		{ format: 'ndjson', input: '{"c1":"v1","c2":"v2"}\n{"c1":"v3","c2":"v4"}\n', output: [{ c1: 'v1', c2: 'v2' }, { c1: 'v3', c2: 'v4' }] },
		{ format: 'lines', input: 'l1\nl2', output: ['l1', 'l2'] },
	];

	const compressions: { compression: Compression }[] = [
		{ compression: 'none' },
		{ compression: 'brotli' },
		{ compression: 'gzip' },
		{ compression: 'zstd' },
		{ compression: 'lz4' },
	];

	async function mockSource(content: string, compression: Compression = 'none') {
		jest.clearAllMocks();

		const key = compression + '/' + content;
		let buffer: Buffer;
		if (cache.has(key)) {
			buffer = cache.get(key)!;
		} else {
			buffer = await toBuffer(fromValue(content).merge(compress(compression)))
			cache.set(key, buffer);
		}

		// Set up a mock stream
		const stream = fromValue(buffer);

		// Mock `read` to return a Promise with a mock stream and size
		jest.mocked(read).mockResolvedValue({ stream, size: buffer.length });
	};

	describe('should parse compressed and formatted files correctly', () => {
		for (const f of formats) {
			describe('format: ' + f.format, () => {
				for (const c of compressions) {
					it('compression: ' + c.compression, async () => {
						await mockSource(f.input, c.compression);
						const reader = await readDataFile('file.txt', {
							compression: c.compression,
							format: f.format,
						});
						expect(await toArray(reader)).toStrictEqual(f.output);
					})
				}
			})
		}
	})

	describe('should read empty files', () => {
		for (const f of formats) {
			it('format: ' + f.format, async () => {
				await mockSource('', 'none');
				const reader = await readDataFile('file.txt', {
					format: f.format,
				});
				expect(await toArray(reader)).toStrictEqual([]);
			})
		}
	})

	it('should handle files with unknown format gracefully', async () => {
		await expect(readDataFile('file.unknown', { format: 'unknown' as unknown as 'ndjson' })).rejects.toThrow('Unsupported format: unknown');
	});

	it('should track progress if enabled', async () => {
		await mockSource('1\n2\n3\n4\n5\n6\n7\n8\n9\n');
		const reader = await readDataFile('file.txt', { progress: true, format: 'lines' });
		const result = await toArray(reader);
		expect(ProgressBar).toHaveBeenCalledWith(18);
		expect(result).toStrictEqual('1,2,3,4,5,6,7,8,9'.split(','));
	});
});
