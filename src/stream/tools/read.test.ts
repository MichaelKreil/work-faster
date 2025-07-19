import { jest } from '@jest/globals';
import { IncomingMessage } from 'http';
import { Readable } from 'stream';
import { toString } from './utils.js';

const createReadStream = jest.fn();
const statSync = jest.fn();
const httpRequest = jest.fn((_url, _cb: (res: IncomingMessage) => void) => { });
const httpsRequest = jest.fn((_url, _cb: (res: IncomingMessage) => void) => { });

// Mock `fs`, `http`, and `https` modules before importing `read`
jest.unstable_mockModule('fs', () => ({ createReadStream, statSync }));
jest.unstable_mockModule('http', () => ({ default: { request: httpRequest } }));
jest.unstable_mockModule('https', () => ({ default: { request: httpsRequest } }));

// Now import the `read` function with the mocks applied
const { read } = await import('./read.js');

describe('read', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should return a file stream and size for a local file', async () => {
		const mockSize = 1024;
		statSync.mockReturnValue({ size: mockSize });
		createReadStream.mockReturnValue(Readable.from(['file content']));

		const filename = 'testfile.txt';
		const { stream, size } = await read(filename);

		expect(statSync).toHaveBeenCalledWith(filename);
		expect(createReadStream).toHaveBeenCalledWith(filename);
		expect(size).toBe(mockSize);
		expect(await toString(stream)).toBe('file content');
	});

	it('should return an HTTP stream and content length for an HTTP URL', async () => {
		const mockSize = 2048;
		const mockStream = Readable.from(['http content']) as IncomingMessage;
		mockStream.headers = { 'content-length': mockSize.toString() };

		httpRequest.mockImplementation((_url, cb) => {
			cb(mockStream);
			return { end: jest.fn() };
		});

		const url = 'http://example.com/file';
		const { stream, size } = await read(url);

		expect(httpRequest).toHaveBeenCalledWith(url, expect.any(Function));
		expect(size).toBe(mockSize);
		expect(await toString(stream)).toBe('http content');
	});

	it('should return an HTTPS stream and content length for an HTTPS URL', async () => {
		const mockSize = 3072;
		const mockStream = Readable.from(['https content']) as IncomingMessage;
		mockStream.headers = { 'content-length': mockSize.toString() };

		httpsRequest.mockImplementation((_, cb) => {
			cb(mockStream);
			return { end: jest.fn() };
		});

		const url = 'https://example.com/file';
		const { stream, size } = await read(url);

		expect(httpsRequest).toHaveBeenCalledWith(url, expect.any(Function));
		expect(size).toBe(mockSize);
		expect(await toString(stream)).toBe('https content');
	});
});
