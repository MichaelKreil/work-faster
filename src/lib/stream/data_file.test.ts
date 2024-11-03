import { arrayFromAsync, fromArray, fromValue } from './utils.js';
import { asBuffer } from './conversion.js';
import { WFReadable, WFTransform, wrapTransform } from './types.js';
import { jest } from '@jest/globals';

// Mock dependencies with unstable_mockModule
jest.unstable_mockModule('./read.js', () => ({
	read: jest.fn(),
}));
jest.unstable_mockModule('./compress.js', () => ({
	decompress: jest.fn(),
}));
jest.unstable_mockModule('./parser.js', () => ({
	parser: jest.fn(),
	Format: {
		JSON: 'json',
		CSV: 'csv',
	},
}));
jest.unstable_mockModule('./split.js', () => ({
	asLines: jest.fn(),
}));
jest.unstable_mockModule('../progress_bar.js', () => ({
	ProgressBar: jest.fn().mockImplementation(() => ({
		update: jest.fn(),
		close: jest.fn(),
	})),
}));

// Importing modules after mocking them
const { read } = await import('./read.js');
const { decompress } = await import('./compress.js');
const { parser } = await import('./parser.js');
const { asLines } = await import('./split.js');
const { ProgressBar } = await import('../progress_bar.js');
const { readDataFile } = await import('./data_file.js');

describe('readDataFile', () => {
	let mockStream: WFReadable<Buffer>;

	beforeEach(() => {
		jest.clearAllMocks();

		// Set up a mock stream
		mockStream = asBuffer(fromValue(Buffer.from('test')));

		// Mock `read` to return a Promise with a mock stream and size
		jest.mocked(read).mockResolvedValue({ stream: mockStream, size: 13 });

		// Mock `decompress` to return a Promise with a transform wrapper
		jest.mocked(decompress).mockResolvedValue(wrapTransform((chunk: Buffer) => chunk) as WFTransform<Buffer, Buffer>);

		// Mock `asLines` to return a readable stream from an array
		jest.mocked(asLines).mockReturnValue(fromArray(['line1', 'line2', 'line3']));

		// Mock `parser` to return parsed results
		jest.mocked(parser).mockReturnValue(fromArray([{ parsed: 'line1' }, { parsed: 'line2' }]));
	});

	it('should read a file without compression or parsing, returning lines', async () => {
		const gen = await readDataFile('file.txt', null, null);
		const result = await arrayFromAsync(gen);

		expect(read).toHaveBeenCalledWith('file.txt');
		expect(asLines).toHaveBeenCalledWith(mockStream);
		expect(result).toStrictEqual(['line1', 'line2', 'line3']);
	});

	it('should decompress the stream if compression is specified', async () => {
		const gen = await readDataFile('file.txt.gz', 'gzip', null);
		const result = await arrayFromAsync(gen);

		expect(decompress).toHaveBeenCalledWith('gzip');
		expect(result).toStrictEqual(['line1', 'line2', 'line3']);  // Assuming decompressed content is mocked with asLines
	});

	it('should parse the stream based on format when format is specified', async () => {
		const gen = await readDataFile('file.txt', null, 'json');
		const result = await arrayFromAsync(gen);

		expect(parser).toHaveBeenCalledWith('json', mockStream);
		expect(result).toStrictEqual([{ parsed: 'line1' }, { parsed: 'line2' }]);
	});

	it('should track progress if enabled', async () => {
		// Mock `ProgressBar` to check its instantiation and method calls
		const gen = await readDataFile('file.txt', null, null, true);
		const result = await arrayFromAsync(gen);

		expect(ProgressBar).toHaveBeenCalledWith(13);
		expect(result).toStrictEqual(['line1', 'line2', 'line3']);
	});
});
