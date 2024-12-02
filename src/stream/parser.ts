import { asLines } from './split.js';
import papa from 'papaparse';
import { WFReadable, wrapTransform } from './types.js';

export type Format = 'csv' | 'csv_fast' | 'json' | 'tsv' | 'lines';

/**
 * Parses the content of a stream based on the specified format.
 * 
 * @param format - The format of the data to parse:
 * - `'csv'`: Parses the input as CSV using PapaParse.
 * - `'csv_fast'`: Fast CSV parsing assuming the first line is a header.
 * - `'tsv'`: Parses the input as tab-separated values.
 * - `'json'`: Parses the input as newline-delimited JSON (NDJSON).
 * - `'lines'`: Treats each line of the input as a separate string.
 * @param stream - A readable stream containing the input data.
 * @returns An async iterable yielding parsed data:
 * - For `'csv'`, `'csv_fast'`, and `'tsv'`: Objects representing rows of data.
 * - For `'json'`: Parsed JSON objects.
 * - For `'lines'`: Strings representing individual lines.
 * 
 * @example
 * const csvStream = parser('csv', inputStream);
 * for await (const row of csvStream) {
 *   console.log(row); // { column1: 'value1', column2: 'value2', ... }
 * }
 * 
 * const jsonStream = parser('json', inputStream);
 * for await (const obj of jsonStream) {
 *   console.log(obj); // { key: 'value', ... }
 * }
 */
export function parser(format: 'csv' | 'csv_fast' | 'tsv', stream: WFReadable<Buffer | string>): AsyncIterable<object>;
export function parser(format: 'json', stream: WFReadable<Buffer | string>): AsyncIterable<unknown>;
export function parser(format: 'lines', stream: WFReadable<Buffer | string>): AsyncIterable<string>;
export function parser(format: Format, stream: WFReadable<Buffer | string>): AsyncIterable<object | string | unknown> {
	switch (format) {
		case 'csv': return parseCSV(stream);
		case 'csv_fast': return parseCSVFast(stream);
		case 'tsv': return parseCSVFast(stream, '\t');
		case 'json': return parseNDJSON(stream);
		case 'lines': return asLines(stream);
	}
	throw new Error(`Unknown format: ${format}`);
}

/**
 * Parses a stream as CSV, assuming the first line is a header row.
 * 
 * @param stream - A readable stream containing CSV data.
 * @param separator - The column separator. Defaults to autodetection based on the input.
 * @returns An async iterable yielding objects representing rows of data.
 * 
 * @example
 * const csvFastStream = parseCSVFast(inputStream);
 * for await (const row of csvFastStream) {
 *   console.log(row); // { header1: 'value1', header2: 'value2', ... }
 * }
 */
async function* parseCSVFast(stream: WFReadable<Buffer | string>, separator: string = ''): AsyncIterable<object> {
	let header: string[] | null = null;

	for await (const line of asLines(stream)) {
		if (header) {
			if (line.length < 1) continue;
			const values = line.split(separator);
			yield Object.fromEntries(header.map((key, i) => [key, values[i]]));
		} else {
			if (!separator) {
				let count = 0;

				[',', ';', '\t'].forEach(s => {
					const newCount = line.split(s).length;
					if (newCount <= count) return;
					count = newCount;
					separator = s;
				});
			}

			header = line.split(separator);
		}
	}
}

/**
 * Parses a stream as CSV using PapaParse.
 * 
 * @param stream - A readable stream containing CSV data.
 * @returns An async iterable yielding objects representing rows of data.
 * 
 * @example
 * const csvStream = parseCSV(inputStream);
 * for await (const row of csvStream) {
 *   console.log(row); // { header1: 'value1', header2: 'value2', ... }
 * }
 */
async function* parseCSV(stream: WFReadable<Buffer | string>): AsyncIterable<object> {
	const parser = wrapTransform<Buffer, object>(papa.parse(papa.NODE_STREAM_INPUT, { header: true }));
	stream.pipe(parser);
	for await (const entry of parser) {
		yield entry;
	}
}

/**
 * Parses a stream as newline-delimited JSON (NDJSON).
 * 
 * @param stream - A readable stream containing JSON objects, one per line.
 * @returns An async iterable yielding parsed JSON objects.
 * 
 * @example
 * const jsonStream = parseNDJSON(inputStream);
 * for await (const obj of jsonStream) {
 *   console.log(obj); // { key: 'value', ... }
 * }
 */
async function* parseNDJSON(stream: WFReadable<Buffer | string>): AsyncIterable<object> {
	for await (const line of asLines(stream)) {
		if (line.length > 0) yield JSON.parse(line);
	}
}
