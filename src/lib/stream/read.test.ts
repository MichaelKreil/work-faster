import { jest } from '@jest/globals';
import { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';

const createReadStream = jest.fn();
const statSync = jest.fn();
const httpRequest = jest.fn((_url, _cb: (res: IncomingMessage) => void) => { });
const httpsRequest = jest.fn((_url, _cb: (res: IncomingMessage) => void) => { });

// Mock `fs`, `http`, and `https` modules before importing `read`
jest.unstable_mockModule('node:fs', () => ({ createReadStream, statSync }));
jest.unstable_mockModule('node:http', () => ({ default: { request: httpRequest } }));
jest.unstable_mockModule('node:https', () => ({ default: { request: httpsRequest } }));

// Now import the `read` function with the mocks applied
const { read } = await import('./read.js');

describe('read', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should return a file stream and size for a local file', async () => {
		const mockSize = 1024;
		const mockStream = new Readable({
			read() {
				this.push('file content');
				this.push(null);
			},
		});

		statSync.mockReturnValue({ size: mockSize });
		createReadStream.mockReturnValue(mockStream);

		const filename = 'testfile.txt';
		const { stream, size } = await read(filename);

		expect(statSync).toHaveBeenCalledWith(filename);
		expect(createReadStream).toHaveBeenCalledWith(filename);
		expect(size).toBe(mockSize);

		const result = await streamToString(stream);
		expect(result).toBe('file content');
	});

	it('should return an HTTP stream and content length for an HTTP URL', async () => {
		const mockSize = 2048;
		const mockStream = new Readable({
			read() {
				this.push('http content');
				this.push(null);
			},
		}) as IncomingMessage;
		mockStream.headers = { 'content-length': mockSize.toString() };

		httpRequest.mockImplementation((_url, cb) => {
			cb(mockStream);
			return { end: jest.fn() };
		});

		const url = 'http://example.com/file';
		const { stream, size } = await read(url);

		expect(httpRequest).toHaveBeenCalledWith(url, expect.any(Function));
		expect(size).toBe(mockSize);

		const result = await streamToString(stream);
		expect(result).toBe('http content');
	});

	it('should return an HTTPS stream and content length for an HTTPS URL', async () => {
		const mockSize = 3072;
		const mockStream = new Readable({
			read() {
				this.push('https content');
				this.push(null);
			},
		}) as IncomingMessage;
		mockStream.headers = { 'content-length': mockSize.toString() };

		httpsRequest.mockImplementation((_, cb) => {
			cb(mockStream);
			return { end: jest.fn() };
		});

		const url = 'https://example.com/file';
		const { stream, size } = await read(url);

		expect(httpsRequest).toHaveBeenCalledWith(url, expect.any(Function));
		expect(size).toBe(mockSize);

		const result = await streamToString(stream);
		expect(result).toBe('https content');
	});
});

// Helper function to convert a stream to a string for testing purposes
async function streamToString(stream: Readable): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString('utf-8');
}
