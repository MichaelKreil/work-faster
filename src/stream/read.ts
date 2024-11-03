import { createReadStream, statSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { WFReadable } from './types.js';

/**
 * Reads a file from a local path or URL and returns a readable stream and its size.
 */
export async function read(filename: string): Promise<{ stream: WFReadable<Buffer>; size: number }> {
	let stream, size: number = 0;

	if (filename.startsWith('http://')) {
		stream = await getHttpStream(http, filename);
	} else if (filename.startsWith('https://')) {
		stream = await getHttpStream(https, filename);
	} else {
		size = statSync(filename).size;
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
 * Helper to get a stream for HTTP or HTTPS requests.
 */
function getHttpStream(lib: typeof http | typeof https, url: string): Promise<http.IncomingMessage> {
	return new Promise<http.IncomingMessage>((resolve) => {
		lib.request(url, (stream) => resolve(stream)).end();
	});
}
