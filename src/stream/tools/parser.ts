import { split } from './split.js';
import { Format } from '../types.js';
import { WFTransform } from '../classes.js';
import { wrapFilterTransform, wrapTransform } from './wrapper.js';
import { skipEmptyLines } from './skip.js';

/**
 * Parses the content of a stream based on the specified format.
 * 
 * @param format - The format of the data to parse:
 * - `'csv'`: Parses the input as CSV.
 * - `'tsv'`: Parses the input as tab-separated values.
 * - `'ndjson'`: Parses the input as newline-delimited JSON (NDJSON).
 * - `'lines'`: Treats each line of the input as a separate string.
 * @param stream - A readable stream containing the input data.
 * @returns An async iterable yielding parsed data:
 * - For `'csv'` and `'tsv'`: Objects representing rows of data.
 * - For `'ndjson'`: Parsed JSON objects.
 * - For `'lines'`: Strings representing individual lines.
 * 
 * @example
 * const csvStream = parser('csv', inputStream);
 * for await (const row of csvStream) {
 *   console.log(row); // { column1: 'value1', column2: 'value2', ... }
 * }
 * 
 * const jsonStream = parser('ndjson', inputStream);
 * for await (const obj of jsonStream) {
 *   console.log(obj); // { key: 'value', ... }
 * }
 */
export function parser(format: 'csv' | 'tsv'): WFTransform<Buffer | string, Record<string, unknown>>;
export function parser(format: 'ndjson'): WFTransform<Buffer | string, unknown>;
export function parser(format: 'lines'): WFTransform<Buffer | string, string>;
export function parser(format: Format): WFTransform<Buffer | string, Record<string, unknown> | string | unknown> {
	const transform = split().merge(skipEmptyLines());
	switch (format) {
		case 'csv': return transform.merge(parseCSV());
		case 'tsv': return transform.merge(parseCSV('\t'));
		case 'ndjson': return transform.merge(parseNDJSON());
		case 'lines': return transform;
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
 * const csvFastStream = parseCSV(inputStream);
 * for await (const row of csvFastStream) {
 *   console.log(row); // { header1: 'value1', header2: 'value2', ... }
 * }
 */
function parseCSV(separator: string = ''): WFTransform<string, Record<string, unknown>> {
	let header: string[] | null = null;

	return wrapFilterTransform(line => {
		if (header) {
			const values = line.split(separator);
			return Object.fromEntries(header.map((key, i) => [key, values[i]]));
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
			return null
		}
	})
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
function parseNDJSON(): WFTransform<string, unknown> {
	return wrapTransform(line => JSON.parse(line));
}
