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

	it('should follow a redirect to an absolute location', async () => {
		const target = mockResponse('redirected content', { 'content-length': '18' }, 200);
		httpsRequest.mockImplementation((url, cb) => {
			cb(
				url === 'https://example.com/start' ? mockResponse('', { location: 'https://example.com/final' }, 302) : target,
			);
			return mockRequest();
		});

		const { stream, size } = await read('https://example.com/start');

		expect(httpsRequest).toHaveBeenCalledTimes(2);
		expect(httpsRequest).toHaveBeenLastCalledWith('https://example.com/final', expect.any(Function));
		expect(size).toBe(18);
		expect(await toString(stream)).toBe('redirected content');
	});

	it('should resolve a relative location against the redirecting URL', async () => {
		httpsRequest.mockImplementation((url, cb) => {
			cb(
				url === 'https://example.com/dir/start'
					? mockResponse('', { location: 'other' }, 301)
					: mockResponse('ok', {}, 200),
			);
			return mockRequest();
		});

		await read('https://example.com/dir/start');

		expect(httpsRequest).toHaveBeenLastCalledWith('https://example.com/dir/other', expect.any(Function));
	});

	it('should follow a redirect that switches protocol', async () => {
		httpsRequest.mockImplementation((_, cb) => {
			cb(mockResponse('', { location: 'http://example.com/plain' }, 302));
			return mockRequest();
		});
		httpRequest.mockImplementation((_url, cb) => {
			cb(mockResponse('plain content', {}, 200));
			return mockRequest();
		});

		const { stream } = await read('https://example.com/secure');

		expect(httpRequest).toHaveBeenCalledWith('http://example.com/plain', expect.any(Function));
		expect(await toString(stream)).toBe('plain content');
	});

	it('should reject a redirect loop once maxRedirects is exceeded', async () => {
		httpsRequest.mockImplementation((_, cb) => {
			cb(mockResponse('', { location: 'https://example.com/loop' }, 302));
			return mockRequest();
		});

		await expect(read('https://example.com/loop', { maxRedirects: 2 })).rejects.toThrow(
			'Too many redirects (more than 2) for https://example.com/loop',
		);
		// The initial request plus the two permitted hops.
		expect(httpsRequest).toHaveBeenCalledTimes(3);
	});

	it('should reject a redirect without a location header', async () => {
		httpsRequest.mockImplementation((_, cb) => {
			cb(mockResponse('', {}, 302));
			return mockRequest();
		});

		await expect(read('https://example.com/nowhere')).rejects.toThrow(
			'HTTP 302 without a location header for https://example.com/nowhere',
		);
	});

	it('should reject a redirect to an unsupported protocol', async () => {
		httpsRequest.mockImplementation((_, cb) => {
			cb(mockResponse('', { location: 'ftp://example.com/file' }, 302));
			return mockRequest();
		});

		await expect(read('https://example.com/start')).rejects.toThrow(
			'Unsupported redirect target ftp://example.com/file',
		);
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
