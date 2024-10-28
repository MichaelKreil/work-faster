import { jest } from '@jest/globals';
import { PassThrough, Readable } from 'node:stream';

const ProgressBar = jest.fn();
const read = jest.fn<(filename: string) => Promise<{ stream: Readable; size: number }>>();
const decompress = jest.fn();
const parser = jest.fn();

// Mock the necessary modules
jest.unstable_mockModule('./read.js', () => ({ read }));
jest.unstable_mockModule('./decompress.js', () => ({ decompress }));
jest.unstable_mockModule('../progress_bar.js', () => ({ ProgressBar }));
jest.unstable_mockModule('./parser.js', () => ({ parser }));

// Now import parseFile with the mocks applied
const { readDataFile } = await import('./data_file.js');

describe('parseFile', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should read the file and parse it with the specified format', async () => {
		// Mock the read function to return a dummy stream and size
		const mockSize = 1000;
		const mockStream = new PassThrough();
		read.mockResolvedValue({ stream: mockStream, size: mockSize });

		// Mock the parser to return an async generator
		const mockParser = async function* () { yield { data: 'parsed' }; };
		parser.mockReturnValue(mockParser());

		const result = [];
		for await (const item of await readDataFile('file.csv', null, 'csv')) {
			result.push(item);
		}

		expect(read).toHaveBeenCalledWith('file.csv');
		expect(parser).toHaveBeenCalledWith('csv', mockStream);
		expect(result).toEqual([{ data: 'parsed' }]);
	});

	it('should decompress the stream if compression is specified', async () => {
		const mockStream = new PassThrough();
		read.mockResolvedValue({ stream: mockStream, size: 0 });

		const decompressedStream = new PassThrough();
		decompress.mockReturnValue(decompressedStream);

		const mockParser = async function* () { yield { data: 'decompressed and parsed' }; };
		parser.mockReturnValue(mockParser());

		const result = [];
		for await (const item of await readDataFile('file.gz', 'gzip', 'csv')) {
			result.push(item);
		}

		expect(decompress).toHaveBeenCalledWith('gzip');
		expect(parser).toHaveBeenCalledWith('csv', decompressedStream);
		expect(result).toEqual([{ data: 'decompressed and parsed' }]);
	});

	it('should track progress if progress is enabled', async () => {
		const mockSize = 5000;
		const mockStream = new PassThrough();
		read.mockResolvedValue({ stream: mockStream, size: mockSize });

		const mockProgressBar = {
			update: jest.fn(),
			close: jest.fn(),
		};
		ProgressBar.mockReturnValue(mockProgressBar);

		const mockParser = async function* () { yield { data: 'parsed with progress' }; };
		parser.mockReturnValue(mockParser());

		const result = [];
		for await (const item of await readDataFile('file.csv', null, 'csv', true)) {
			result.push(item);
		}

		expect(ProgressBar).toHaveBeenCalledWith(mockSize);
		expect(result).toEqual([{ data: 'parsed with progress' }]);
	});
});
