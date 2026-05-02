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
	return { on: vi.fn(), end: vi.fn(), setTimeout: vi.fn(), destroy: vi.fn() };
}

function mockResponse(body: string, headers: Record<string, string>, statusCode: number): IncomingMessage {
	const stream = Readable.from([body]) as IncomingMessage;
	stream.headers = headers;
	stream.statusCode = statusCode;
	stream.setTimeout = vi.fn() as unknown as IncomingMessage['setTimeout'];
	return stream;
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
		const response = mockResponse('http content', { 'content-length': mockSize.toString() }, 200);

		httpRequest.mockImplementation((_url, cb) => {
			cb(response);
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
		const response = mockResponse('https content', { 'content-length': mockSize.toString() }, 200);

		httpsRequest.mockImplementation((_, cb) => {
			cb(response);
			return mockRequest();
		});

		const url = 'https://example.com/file';
		const { stream, size } = await read(url);

		expect(httpsRequest).toHaveBeenCalledWith(url, expect.any(Function));
		expect(size).toBe(mockSize);
		expect(await toString(stream)).toBe('https content');
	});

	it('should reject on a non-2xx HTTP response', async () => {
		const response = mockResponse('not found', {}, 404);

		httpsRequest.mockImplementation((_, cb) => {
			cb(response);
			return mockRequest();
		});

		await expect(read('https://example.com/missing')).rejects.toThrow('HTTP 404 for https://example.com/missing');
	});

	it('should reject when the underlying request emits an error', async () => {
		httpsRequest.mockImplementation(() => {
			const req = mockRequest();
			queueMicrotask(() => {
				const errCall = req.on.mock.calls.find((c) => c[0] === 'error');
				errCall?.[1](new Error('boom'));
			});
			return req;
		});

		await expect(read('https://example.com/file')).rejects.toThrow('boom');
	});

	it('should arm a request timeout when httpTimeoutMs is set', async () => {
		const response = mockResponse('ok', {}, 200);
		const req = mockRequest();
		httpsRequest.mockImplementation((_, cb) => {
			cb(response);
			return req;
		});

		await read('https://example.com/file', { httpTimeoutMs: 5000 });

		expect(req.setTimeout).toHaveBeenCalledWith(5000, expect.any(Function));
		expect(response.setTimeout).toHaveBeenCalledWith(5000, expect.any(Function));
	});

	it('should skip arming a timeout when httpTimeoutMs is 0', async () => {
		const response = mockResponse('ok', {}, 200);
		const req = mockRequest();
		httpsRequest.mockImplementation((_, cb) => {
			cb(response);
			return req;
		});

		await read('https://example.com/file', { httpTimeoutMs: 0 });

		expect(req.setTimeout).not.toHaveBeenCalled();
		expect(response.setTimeout).not.toHaveBeenCalled();
	});
});
