import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { WFReadable } from '../classes.js';

/**
 * Reads a file from a local path or URL and returns a readable stream and its size.
 */
export async function read(filename: string): Promise<{ stream: WFReadable<Buffer>; size: number }> {
	let stream,
		size: number = 0;

	if (filename.startsWith('http://')) {
		stream = await getHttpStream(http, filename);
	} else if (filename.startsWith('https://')) {
		stream = await getHttpStream(https, filename);
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
 * errors and on non-2xx status codes so failures surface instead of hanging.
 */
function getHttpStream(lib: typeof http | typeof https, url: string): Promise<http.IncomingMessage> {
	return new Promise<http.IncomingMessage>((resolve, reject) => {
		const req = lib.request(url, (res) => {
			const status = res.statusCode ?? 0;
			if (status < 200 || status >= 300) {
				res.resume();
				reject(new Error(`HTTP ${status} for ${url}`));
				return;
			}
			resolve(res);
		});
		req.on('error', reject);
		req.end();
	});
}
