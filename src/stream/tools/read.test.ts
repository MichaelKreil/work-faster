import { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import { toString } from './utils.js';

const createReadStream = vi.fn();
const stat = vi.fn();
const httpRequest = vi.fn((_url, _cb: (res: IncomingMessage) => void) => {});
const httpsRequest = vi.fn((_url, _cb: (res: IncomingMessage) => void) => {});

// Mock `fs`, `http`, and `https` modules before importing `read`
vi.mock('node:fs', () => ({ createReadStream }));
vi.mock('node:fs/promises', () => ({ stat }));
vi.mock('node:http', () => ({ default: { request: httpRequest } }));
vi.mock('node:https', () => ({ default: { request: httpsRequest } }));

// Now import the `read` function with the mocks applied
const { read } = await import('./read.js');

function mockRequest() {
	return { on: vi.fn(), end: vi.fn() };
}

describe('read', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return a file stream and size for a local file', async () => {
		const mockSize = 1024;
		stat.mockResolvedValue({ size: mockSize });
		createReadStream.mockReturnValue(Readable.from(['file content']));

		const filename = 'testfile.txt';
		const { stream, size } = await read(filename);

		expect(stat).toHaveBeenCalledWith(filename);
		expect(createReadStream).toHaveBeenCalledWith(filename);
		expect(size).toBe(mockSize);
		expect(await toString(stream)).toBe('file content');
	});

	it('should return an HTTP stream and content length for an HTTP URL', async () => {
		const mockSize = 2048;
		const mockStream = Readable.from(['http content']) as IncomingMessage;
		mockStream.headers = { 'content-length': mockSize.toString() };
		mockStream.statusCode = 200;

		httpRequest.mockImplementation((_url, cb) => {
			cb(mockStream);
			return mockRequest();
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
		mockStream.statusCode = 200;

		httpsRequest.mockImplementation((_, cb) => {
			cb(mockStream);
			return mockRequest();
		});

		const url = 'https://example.com/file';
		const { stream, size } = await read(url);

		expect(httpsRequest).toHaveBeenCalledWith(url, expect.any(Function));
		expect(size).toBe(mockSize);
		expect(await toString(stream)).toBe('https content');
	});

	it('should reject on a non-2xx HTTP response', async () => {
		const mockStream = Readable.from(['not found']) as IncomingMessage;
		mockStream.headers = {};
		mockStream.statusCode = 404;

		httpsRequest.mockImplementation((_, cb) => {
			cb(mockStream);
			return mockRequest();
		});

		await expect(read('https://example.com/missing')).rejects.toThrow('HTTP 404 for https://example.com/missing');
	});

	it('should reject when the underlying request emits an error', async () => {
		httpsRequest.mockImplementation(() => {
			const req = { on: vi.fn(), end: vi.fn() };
			queueMicrotask(() => {
				const errCall = req.on.mock.calls.find((c) => c[0] === 'error');
				errCall?.[1](new Error('boom'));
			});
			return req;
		});

		await expect(read('https://example.com/file')).rejects.toThrow('boom');
	});
});
