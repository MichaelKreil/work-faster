import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { WFReadable } from '../classes.js';

const DEFAULT_HTTP_TIMEOUT_MS = 30_000;

export interface ReadOptions {
	/**
	 * Idle timeout for HTTP/HTTPS requests, in milliseconds. Applies both to
	 * connection setup and to gaps between bytes once the response has started.
	 * Defaults to 30s. Pass 0 to disable.
	 */
	httpTimeoutMs?: number;
}

/**
 * Reads a file from a local path or URL and returns a readable stream and its size.
 */
export async function read(
	filename: string,
	options: ReadOptions = {},
): Promise<{ stream: WFReadable<Buffer>; size: number }> {
	const httpTimeoutMs = options.httpTimeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS;
	let stream,
		size: number = 0;

	if (filename.startsWith('http://')) {
		stream = await getHttpStream(http, filename, httpTimeoutMs);
	} else if (filename.startsWith('https://')) {
		stream = await getHttpStream(https, filename, httpTimeoutMs);
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
 * Helper to get a stream for HTTP or HTTPS requests. Rejects on connection
 * errors, non-2xx status codes, and on idle timeouts so failures surface
 * instead of hanging.
 */
function getHttpStream(
	lib: typeof http | typeof https,
	url: string,
	timeoutMs: number,
): Promise<http.IncomingMessage> {
	return new Promise<http.IncomingMessage>((resolve, reject) => {
		const req = lib.request(url, (res) => {
			const status = res.statusCode ?? 0;
			if (status < 200 || status >= 300) {
				res.resume();
				reject(new Error(`HTTP ${status} for ${url}`));
				return;
			}
			if (timeoutMs > 0) {
				res.setTimeout(timeoutMs, () => {
					res.destroy(new Error(`HTTP response idle for ${timeoutMs}ms: ${url}`));
				});
			}
			resolve(res);
		});
		if (timeoutMs > 0) {
			req.setTimeout(timeoutMs, () => {
				req.destroy(new Error(`HTTP request timed out after ${timeoutMs}ms: ${url}`));
			});
		}
		req.on('error', reject);
		req.end();
	});
}
