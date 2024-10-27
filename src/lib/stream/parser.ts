import { Readable } from 'node:stream';
import { asLines } from './split.js';
import papa from 'papaparse';

export type Format = 'csv' | 'csv_fast' | 'json';

/**
 * Parses the stream content based on file type (CSV or JSON).
 */
export function parser(format: Format, stream: Readable): AsyncGenerator<object> {
	switch (format) {
		case 'csv': return parseCSV(stream);
		case 'csv_fast': return parseCSVFast(stream);
		case 'json': return parseNDJSON(stream);
	}
	throw new Error(`Unknown format: ${format}`);
}

/**
 * Fast CSV parser, assumes the first line is a header and uses it to map CSV values to object keys.
 */
async function* parseCSVFast(stream: Readable): AsyncGenerator<object> {
	let header: string[] | null = null, separator: string = ',';

	for await (const line of asLines(stream)) {
		if (header) {
			if (line.length < 1) continue;
			const values = line.split(separator);
			yield Object.fromEntries(header.map((key, i) => [key, values[i]]));
		} else {
			header = line.split(separator);

			if (line.split(';').length > header.length) {
				separator = ';';
				header = line.split(separator);
			}

			if (line.split('\t').length > header.length) {
				separator = '\t';
				header = line.split(separator);
			}
		}
	}
}

/**
 * Standard CSV parser using PapaParse.
 */
async function* parseCSV(stream: Readable): AsyncGenerator<object> {
	const parser = papa.parse(papa.NODE_STREAM_INPUT, { header: true });
	for await (const entry of stream.pipe(parser)) {
		yield entry;
	};
}

/**
 * JSON parser that splits JSON objects and parses each line.
 */
async function* parseNDJSON(stream: Readable): AsyncGenerator<object> {
	for await (const line of asLines(stream)) {
		if (line.length > 0) yield JSON.parse(line);
	};
}
