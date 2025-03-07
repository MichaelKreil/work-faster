import { ProgressBar } from '../../utils/progress_bar.js';
import { read } from './read.js';
import { decompress } from './compress.js';
import { parser } from './parser.js';
import type { Compression, Format } from '../types.js';
import { WFReadable } from '../classes.js';

/**
 * Reads a data file, optionally decompresses it, and parses it based on the specified format.
 * 
 * Overload signatures:
 * - For CSV, CSV Fast, and TSV formats: Returns `WFReadable<object>`.
 * - For JSON format: Returns `WFReadable<unknown>`.
 * - For lines of text: Returns `WFReadable<string>`.
 * 
 * @param filename - The path to the data file to be read.
 * @param options - Configuration options:
 *   - `compression`: The compression type applied to the file. Supported values are `'gzip'`, `'brotli'`, `'lz4'`, `'zstd'`, or `'none'`.
 *   - `format`: The format of the file content:
 *     - `'csv'`: Comma-separated values, parsed using a standard CSV parser.
 *     - `'csv_fast'`: Comma-separated values, parsed using a fast parser with header detection.
 *     - `'tsv'`: Tab-separated values.
 *     - `'json'`: Newline-delimited JSON (NDJSON).
 *     - `'lines'`: Raw lines of text.
 *   - `progress`: Whether to display a progress bar for large files. Requires `size` metadata to be available.
 * @returns An async iterable containing the parsed data:
 *   - `WFReadable<object>` for `'csv'`, `'csv_fast'`, and `'tsv'`.
 *   - `WFReadable<unknown>` for `'json'`.
 *   - `WFReadable<string>` for `'lines'`.
 * 
 * @throws Error if the specified format or compression type is unsupported.
 * 
 * @example
 * // Parse a CSV file
 * const csvStream = await readDataFile('data.csv', { format: 'csv' });
 * for await (const row of csvStream) {
 *   console.log(row); // { column1: 'value1', column2: 'value2', ... }
 * }
 * 
 * @example
 * // Parse a compressed JSON file
 * const jsonStream = await readDataFile('data.json.gz', { format: 'json', compression: 'gzip' });
 * for await (const obj of jsonStream) {
 *   console.log(obj); // { key: 'value', ... }
 * }
 * 
 * @example
 * // Display progress for a large TSV file
 * const tsvStream = await readDataFile('data.tsv', { format: 'tsv', progress: true });
 * for await (const row of tsvStream) {
 *   console.log(row); // { column1: 'value1', column2: 'value2', ... }
 * }
 */
export async function readDataFile(
	filename: string,
	options: { compression?: Compression; format: 'csv' | 'tsv'; progress?: boolean }
): Promise<WFReadable<Record<string, unknown>>>;

export async function readDataFile(
	filename: string,
	options: { compression?: Compression; format: 'ndjson'; progress?: boolean }
): Promise<WFReadable<unknown>>;

export async function readDataFile(
	filename: string,
	options: { compression?: Compression; format: 'lines' | undefined; progress?: boolean }
): Promise<WFReadable<string>>;

export async function readDataFile(
	filename: string,
	options?: { compression?: Compression; format?: Format; progress?: boolean }
): Promise<WFReadable<Record<string, unknown> | string | unknown>>;

// Implementation
export async function readDataFile(
	filename: string,
	options?: { compression?: Compression; format?: Format; progress?: boolean }
): Promise<WFReadable<object | string | unknown>> {
	// Read the initial stream
	// eslint-disable-next-line prefer-const
	let { stream, size } = await read(filename);

	const compression: Compression = options?.compression ?? 'none';
	const format: Format = options?.format ?? 'lines';
	const progress = options?.progress ?? false;

	// Optionally add progress tracking
	if (progress && size) {
		const progressBar = new ProgressBar(size);
		let pos = 0;
		stream.inner.on('data', (chunk: Buffer) => {
			pos += chunk.length;
			progressBar.update(pos);
		});
		stream.inner.on('end', () => progressBar.close());
	}

	// Decompress the stream if needed
	if (compression !== 'none') stream = stream.merge(decompress(compression));

	// Parse the stream based on the specified format
	switch (format) {
		case 'csv':
		case 'tsv':
			return stream.merge(parser(format)); // Matches the first overload
		case 'ndjson':
			return stream.merge(parser(format)); // Matches the second overload
		case 'lines':
			return stream.merge(parser(format)); // Matches the third overload
		default:
			throw new Error(`Unsupported format: ${format}`);
	}
}
