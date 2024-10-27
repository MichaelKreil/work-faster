import { Readable } from 'node:stream';
import { jest } from '@jest/globals';
import type { ReadStream } from 'node:fs';

jest.unstable_mockModule('node:fs', () => ({
	createReadStream: jest.fn(),
	statSync: jest.fn().mockReturnValue({ size: 100 }),
}));

jest.unstable_mockModule('node:http', () => ({
	default: {
		request: jest.fn((_, callback: (red: Readable) => void) => {
			const mockStream = new Readable({ read: () => { } });
			setTimeout(() => callback(mockStream), 1);
			return { end: jest.fn() };
		})
	},
}));

jest.unstable_mockModule('node:https', () => ({
	default: {
		request: jest.fn((_, callback: (red: Readable) => void) => {
			const mockStream = new Readable({ read: () => { } });
			setTimeout(() => callback(mockStream), 1);
			return { end: jest.fn() };
		})
	},
}));

jest.unstable_mockModule('node:zlib', () => ({
	createGunzip: jest.fn(() => new Readable({ read: () => { } })),
	createBrotliDecompress: jest.fn(() => new Readable({ read: () => { } })),
}));

jest.unstable_mockModule('./progress_bar', () => {
	const update = jest.fn();
	const close = jest.fn();
	const ProgressBar = jest.fn().mockImplementation(() => ({ update, close, }))
	ProgressBar.prototype.update = update;
	ProgressBar.prototype.close = close;
	return { ProgressBar }
}
);


const { streamFileData } = await import('./stream_file_data.js');
const createReadStream = jest.mocked((await import('node:fs')).createReadStream);
const zlib = await import('node:zlib');
const createGunzip = jest.mocked(zlib.createGunzip);
const createBrotliDecompress = jest.mocked(zlib.createBrotliDecompress);
const httpRequest = jest.mocked((await import('node:http')).default.request);
const httpsRequest = jest.mocked((await import('node:https')).default.request);
const ProgressBar = jest.mocked((await import('./progress_bar.js')).ProgressBar);

describe('streamFileData', () => {
	let mockStream: Readable;

	beforeEach(() => {
		mockStream = new Readable({ read: () => { } });
		createReadStream.mockReturnValue(mockStream as ReadStream);
		createReadStream.mockClear();
		httpRequest.mockClear();
		httpsRequest.mockClear();
		ProgressBar.mockClear();
		ProgressBar.prototype.close.mockClear();
		ProgressBar.prototype.update.mockClear();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should create a read stream for a local file', async () => {
		await streamFileData('test.csv', {});
		expect(createReadStream).toHaveBeenCalledWith('test.csv');
	});

	it('should create an HTTP stream for an HTTP URL', async () => {
		await streamFileData('http://example.com/test.csv', {});
		expect(httpRequest).toHaveBeenCalled();
	});

	it('should create an HTTPS stream for an HTTPS URL', async () => {
		await streamFileData('https://example.com/test.csv', {});
		expect(httpsRequest).toHaveBeenCalled();
	});

	it('should initialize a progress bar if progress option is enabled', async () => {
		await streamFileData('test.csv', { progress: true });
		expect(ProgressBar).toHaveBeenCalledWith(100);
		mockStream.emit('data', Buffer.from('data chunk'));
		expect(ProgressBar.prototype.update).toHaveBeenCalled();
		mockStream.emit('close');
		expect(ProgressBar.prototype.close).toHaveBeenCalled();
	});

	it('should decompress .gz files', async () => {
		await streamFileData('test.csv.gz', {});
		expect(createGunzip).toHaveBeenCalled();
		expect(createReadStream).toHaveBeenCalledWith('test.csv.gz');
	});

	it('should decompress .br files', async () => {
		await streamFileData('test.csv.br', {});
		expect(createBrotliDecompress).toHaveBeenCalled();
		expect(createReadStream).toHaveBeenCalledWith('test.csv.br');
	});

	it('should use fast CSV parser if fast option is enabled', async () => {
		const stream = await streamFileData('test.csv', { fast: true });
		expect(stream.readableObjectMode).toBe(true);
		// Mocking and asserting fast CSV parsing logic can go here
	});

	it('should use the regular CSV parser by default', async () => {
		const stream = await streamFileData('test.csv', {});
		expect(stream.readableObjectMode).toBe(true);
		// Mocking and asserting regular CSV parsing logic can go here
	});

	it('should use JSON parser for JSON files', async () => {
		const stream = await streamFileData('test.ndjson', {});
		expect(stream.readableObjectMode).toBe(true);
		// Mocking and asserting JSON parsing logic can go here
	});

	it('should throw an error for unknown file types', async () => {
		await expect(streamFileData('test.unknown', {})).rejects.toThrow('Unknown file extension: .unknown');
	});
});
