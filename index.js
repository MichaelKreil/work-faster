"use strict"

const { createReadStream, statSync } = require('fs');
const http = require('http');
const https = require('https');
const papa = require('papaparse');
const os = require('os');
const { extname } = require('path');
const { Transform, PassThrough } = require('stream');
const { StringDecoder } = require('string_decoder');
const { createGunzip, createBrotliDecompress } = require('zlib');

module.exports = {
	streamFileData,
};

Array.prototype.forEachAsync = forEachAsync;

function forEachAsync() {
	let callback, maxParallel = os.cpus().length;
	switch (arguments.length) {
		case 1: [callback] = arguments; break;
		case 2: [callback, maxParallel] = arguments; break;
		default:
			throw Error('forEachAsync( callback, [ maxParallel ] )')
	}

	let list = this;
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
			let currentIndex = index++;

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

async function streamFileData(filename, opt) {
	if (!opt) opt = {};

	let stream, size;

	if (filename.startsWith('http://')) {
		stream = await getHttpStream(http, filename)
	} else if (filename.startsWith('https://')) {
		stream = await getHttpStream(https, filename)
	} else {
		size = statSync(filename).size;
		stream = createReadStream(filename);
	}
	if (stream && stream.headers && stream.headers['content-length']) {
		size = parseInt(stream.headers['content-length'], 10);
	}

	if (opt.progress && size) {
		let progress = new Progress();
		let pos = 0;
		stream.on('data', chunk => {
			pos += chunk.length;
			progress.update(pos / size);
		})
		stream.on('close', () => progress.finish());
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

	function getHttpStream(lib, url) {
		return new Promise(res => {
			lib.request(url, stream => res(stream)).end();
		})
	}

	function getSplitter(matcher = /\r?\n/, format = 'utf8') {
		let last = '';
		let decoder = new StringDecoder(format);

		return new Transform({
			autoDestroy: true,
			readableObjectMode: true,
			transform,
			flush,
		})

		function transform(chunk, enc, cb) {
			last += decoder.write(chunk);
			let lines = last.split(matcher);
			let lastIndex = lines.length - 1;
			for (let i = 0; i < lastIndex; i++) this.push(lines[i])
			last = lines[lastIndex];
			cb();
		}

		function flush(cb) {
			this.push(last);
			cb();
		}
	}

	function getCsvParserFast(stream) {
		let header, separator;

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

	function getCsvParser(stream) {
		let parser = papa.parse(papa.NODE_STREAM_INPUT, { header: true });
		return stream.pipe(parser);
	}

	function getJsonParser(stream) {
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

function Progress(prefix = '   ') {
	let start = Date.now();

	return {
		update,
		finish,
	}
	function update(progress) {
		let eta = (Date.now() - start) * (1 - progress) / progress / 1000;
		let hours = Math.floor(eta / 3600);
		let minutes = Math.floor(eta / 60 - hours * 60);
		let seconds = Math.floor(eta - minutes * 60 - hours * 3600);
		eta = hours + ':' + ('00' + minutes).slice(-2) + ':' + ('00' + seconds).slice(-2);
		process.stderr.write('\x1b[2K\r' + prefix + (100 * progress).toFixed(2) + '% - ' + eta);
	}
	function finish() {
		process.stderr.write('\x1b[2K\r' + prefix + 'Finished\n');
	}
}

