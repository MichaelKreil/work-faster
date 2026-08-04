import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { WFReadable } from '../classes.js';

const DEFAULT_HTTP_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_REDIRECTS = 5;

// 3xx codes that carry a `location` header pointing at the actual resource.
// `read` only ever issues GET requests, so 303/307/308 need no method rewrite.
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

export interface ReadOptions {
	/**
	 * Idle timeout for HTTP/HTTPS requests, in milliseconds. Applies both to
	 * connection setup and to gaps between bytes once the response has started.
	 * Defaults to 30s. Pass 0 to disable.
	 */
	httpTimeoutMs?: number;
	/**
	 * Maximum number of HTTP redirects to follow. Defaults to 5. Pass 0 to
	 * reject on the first 3xx response instead of following it.
	 */
	maxRedirects?: number;
}

/**
 * Reads a file from a local path or URL and returns a readable stream and its size.
 *
 * HTTP and HTTPS URLs follow up to `maxRedirects` redirects, including those
 * that switch between the two protocols. The returned size comes from the
 * `content-length` of the final response.
 */
export async function read(
	filename: string,
	options: ReadOptions = {},
): Promise<{ stream: WFReadable<Buffer>; size: number }> {
	const httpTimeoutMs = options.httpTimeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS;
	const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
	let stream,
		size: number = 0;

	if (filename.startsWith('http://') || filename.startsWith('https://')) {
		stream = await getHttpStream(filename, httpTimeoutMs, maxRedirects);
	} else {
		size = (await stat(filename)).size;
		stream = createReadStream(filename);
	}

	if ('headers' in stream && typeof stream.headers === 'object' && stream.headers) {
		const { headers } = stream;
		if ('content-length' in headers && typeof headers['content-length'] === 'string') {
			size = parseInt(headers['content-length'], 10);
		}
	}

	return { stream: new WFReadable(stream), size };
}

/**
 * Requests `url`, following redirects, and resolves with the final 2xx
 * response. Rejects on connection errors, non-2xx status codes, idle timeouts,
 * and redirect chains that are broken or longer than `maxRedirects`, so
 * failures surface instead of hanging.
 */
async function getHttpStream(url: string, timeoutMs: number, maxRedirects: number): Promise<http.IncomingMessage> {
	let currentUrl = url;

	for (let hops = 0; ; hops++) {
		const res = await request(currentUrl, timeoutMs);
		const status = res.statusCode ?? 0;

		if (REDIRECT_STATUS_CODES.has(status)) {
			const { location } = res.headers;
			// The redirect body is of no interest, but it still has to be drained
			// so the socket can be released back to the agent pool.
			res.resume();
			if (!location) throw new Error(`HTTP ${status} without a location header for ${currentUrl}`);
			if (hops >= maxRedirects) throw new Error(`Too many redirects (more than ${maxRedirects}) for ${url}`);
			// `location` may be relative to the URL that produced it.
			currentUrl = new URL(location, currentUrl).href;
			if (!currentUrl.startsWith('http://') && !currentUrl.startsWith('https://')) {
				throw new Error(`Unsupported redirect target ${currentUrl} for ${url}`);
			}
			continue;
		}

		if (status < 200 || status >= 300) {
			res.resume();
			throw new Error(`HTTP ${status} for ${currentUrl}`);
		}

		if (timeoutMs > 0) {
			res.setTimeout(timeoutMs, () => {
				res.destroy(new Error(`HTTP response idle for ${timeoutMs}ms: ${currentUrl}`));
			});
		}
		return res;
	}
}

/**
 * Issues a single GET and resolves with the response, whatever its status.
 */
function request(url: string, timeoutMs: number): Promise<http.IncomingMessage> {
	const lib = url.startsWith('https://') ? https : http;
	return new Promise<http.IncomingMessage>((resolve, reject) => {
		const req = lib.request(url, resolve);
		if (timeoutMs > 0) {
			req.setTimeout(timeoutMs, () => {
				req.destroy(new Error(`HTTP request timed out after ${timeoutMs}ms: ${url}`));
			});
		}
		req.on('error', reject);
		req.end();
	});
}
