import { createReadStream, statSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import papa from 'papaparse';
import { extname } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { createGunzip, createBrotliDecompress } from 'node:zlib';
import { ProgressBar } from './progress_bar.js';
import { getSplitter } from './split.js';



export async function streamFileData(
	filename: string,
	opt: { progress?: true, fast?: true }
): Promise<Readable> {
	if (!opt) opt = {};

	let stream: Readable, size: number = 0;

	if (filename.startsWith('http://')) {
		stream = await getHttpStream(http, filename)
	} else if (filename.startsWith('https://')) {
		stream = await getHttpStream(https, filename)
	} else {
		size = statSync(filename).size;
		stream = createReadStream(filename);
	}

	if ('headers' in stream && typeof stream.headers == 'object' && stream.headers != null) {
		const { headers } = stream;
		if ('content-length' in headers && typeof headers['content-length'] == 'string') {
			size = parseInt(headers['content-length'], 10);
		}
	}

	if (opt.progress && size) {
		let pos = 0;
		const progress = new ProgressBar(size);
		stream.on('data', (chunk: Buffer) => {
			pos += chunk.length;
			progress.update(pos);
		})
		stream.on('close', () => progress.close());
	}

	if (filename.endsWith('.gz')) {
		filename = filename.slice(0, -3);
		stream = stream.pipe(createGunzip())
	} else if (filename.endsWith('.br')) {
		filename = filename.slice(0, -3);
		stream = stream.pipe(createBrotliDecompress())
	}

	if (/\.[ct]sv$/.test(filename)) {
		if (opt.fast) {
			return getCsvParserFast(stream);
		} else {
			return getCsvParser(stream);
		}
	} else if (/\.(((geo)?json(l|seq))|ndjson)$/.test(filename)) {
		return getJsonParser(stream);
	} else {
		throw new Error('Unknown file extension: ' + extname(filename));
	}
}


function getHttpStream(lib: typeof http | typeof https, url: string): Promise<http.IncomingMessage> {
	return new Promise<http.IncomingMessage>(res => {
		lib.request(url, stream => res(stream)).end();
	})
}

function getCsvParserFast(stream: Readable) {
	let header: string[], separator: string;

	stream = stream.pipe(getSplitter());
	return stream.pipe(new Transform({
		autoDestroy: true,
		readableObjectMode: true,
		transform: (line, enc, cb) => {
			line = line.toString();
			if (header) {
				if (line.length < 1) return cb();
				line = line.split(separator);
				cb(null, Object.fromEntries(header.map((key, i) => [key, line[i]])));
			} else {
				separator = ',';
				header = line.split(separator);

				if (line.split(';').length > header.length) {
					separator = ';';
					header = line.split(separator);
				}

				if (line.split('\t').length > header.length) {
					separator = '\t';
					header = line.split(separator);
				}
				cb(null);
			}
		},
	}))
}

function getCsvParser(stream: Readable) {
	const parser = papa.parse(papa.NODE_STREAM_INPUT, { header: true });
	return stream.pipe(parser);
}

function getJsonParser(stream: Readable) {
	stream = stream.pipe(getSplitter());
	return stream.pipe(new Transform({
		autoDestroy: true,
		readableObjectMode: true,
		transform: (line, enc, cb) => {
			cb(null, (line.length > 0) ? JSON.parse(line) : null)
		},
	}))
}