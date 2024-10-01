import { createReadStream, statSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import papa from 'papaparse';
import os from 'node:os';
import { extname } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import { createGunzip, createBrotliDecompress } from 'node:zlib';

export function forEachAsync<V>(list: V[], callback: (item: V, index: number) => Promise<void>, maxParallel = 0): Promise<void> {
	if (maxParallel === 0) maxParallel = os.cpus().length;

	return new Promise((resolve, reject) => {
		let running = 0, index = 0, finished = false;

		queueMicrotask(next);

		function next() {
			if (finished) return;
			if (running >= maxParallel) return;
			if (index >= list.length) {
				if (running === 0) {
					finished = true;
					resolve();
					return
				}
				return
			}

			running++;
			const currentIndex = index++;

			callback(list[currentIndex], currentIndex)
				.then(() => {
					running--;
					queueMicrotask(next)
				})
				.catch(err => {
					finished = true;
					reject(err);
				})

			if (running < maxParallel) queueMicrotask(next);
		}
	})
}

export async function streamFileData(filename: string, opt: { progress?: true, fast?: true }) {
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
	} else if (/\.(geo)?json(l|seq)$/.test(filename)) {
		return getJsonParser(stream);
	} else {
		throw new Error('Unknown file extension: ' + extname(filename));
	}

	function getHttpStream(lib: typeof http | typeof https, url: string): Promise<http.IncomingMessage> {
		return new Promise<http.IncomingMessage>(res => {
			lib.request(url, stream => res(stream)).end();
		})
	}

	function getSplitter(matcher = /\r?\n/, format: BufferEncoding = 'utf8') {
		let last = '';
		const decoder = new StringDecoder(format);

		return new Transform({
			autoDestroy: true,
			readableObjectMode: true,
			transform: function (chunk: string, enc: BufferEncoding, cb: () => void) {
				last += decoder.write(chunk);
				const lines = last.split(matcher);
				const lastIndex = lines.length - 1;
				for (let i = 0; i < lastIndex; i++) this.push(lines[i])
				last = lines[lastIndex];
				cb();
			},
			flush: function (cb: () => void) {
				this.push(last);
				cb();
			}
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
}

type ProgressState = { index: number, time: number };

export class ProgressBar {
	private readonly MAX_STATES = 30;
	private index = 0;
	private nextUpdateTime: number;
	private readonly total: number;
	private readonly timeStep: number;
	private readonly previousStates: ProgressState[] = [];

	constructor(total: number, timeStep = 1000) {
		this.total = total;
		this.timeStep = timeStep;
		this.nextUpdateTime = Date.now();
		this.update(0);
	}

	private log() {
		const { index, total, previousStates, MAX_STATES } = this;
		const time = Date.now();
		const progress = 100 * index / total;
		let message = `\r\x1b[K   ${index}/${total} - ${progress.toFixed(2)} %`;

		const newState: ProgressState = { index, time };
		const lastState: ProgressState = previousStates[previousStates.length - 1] || newState;
		if ((lastState.index !== index) || (lastState === newState)) {
			previousStates.unshift(newState);
			while (previousStates.length > MAX_STATES) previousStates.pop();
		}

		if (lastState.index < index) {
			const speed = 1000 * (index - lastState.index) / (time - lastState.time);
			let speedString;
			if (speed >= 1e6) {
				speedString = (speed / 1000).toFixed(0) + ' K'
			} else if (speed >= 1e5) {
				speedString = (speed / 1000).toFixed(1) + ' K'
			} else if (speed >= 1e4) {
				speedString = (speed / 1000).toFixed(2) + ' K'
			} else if (speed >= 1e3) {
				speedString = speed.toFixed(0)
			} else if (speed >= 1e2) {
				speedString = speed.toFixed(1)
			} else if (speed >= 1e1) {
				speedString = speed.toFixed(2)
			} else {
				speedString = speed.toFixed(3)
			}

			const eta = (total - index) / speed;
			const etaString = [
				Math.floor(eta / 3600).toFixed(0),
				(Math.floor(eta / 60) % 60 + 100).toFixed(0).slice(1),
				(Math.floor(eta) % 60 + 100).toFixed(0).slice(1),
			].join(':');

			message += ` - ${speedString}/s - ${etaString}`;
		}

		process.stderr.write(message);
	}

	public update(value: number) {
		this.index = value;
		if (Date.now() >= this.nextUpdateTime) {
			this.log();
			this.nextUpdateTime += this.timeStep;
		}
	}

	public increment(value = 1) {
		this.update(this.index + value);
	}

	public close() {
		this.index = this.total;
		this.log();
		process.stderr.write(`\n`);
	}
}

