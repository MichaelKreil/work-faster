import { ProgressBar } from '../progress_bar.js';
import { read } from './read.js';
import { Compression, decompress } from './compress.js';
import { Format, parser } from './parser.js';
import { asLines } from './split.js';

export async function readDataFile(filename: string, compression: Compression | null, format: Format, progress?: boolean): Promise<AsyncGenerator<object>>
export async function readDataFile(filename: string, compression: Compression | null, format: null, progress?: boolean): Promise<AsyncGenerator<string>>
export async function readDataFile(filename: string, compression: Compression | null, format: Format | null, progress?: boolean): Promise<AsyncGenerator<object | string>> {
	// Read the initial stream
	// eslint-disable-next-line prefer-const
	let { stream, size } = await read(filename);

	// Optionally add progress tracking
	if (progress && size) {
		const progress = new ProgressBar(size);
		let pos = 0;
		stream.inner.on('data', (chunk: Buffer) => {
			pos += chunk.length;
			progress.update(pos);
		});
		stream.inner.on('close', () => progress.close());
	}

	// Decompress the stream if needed
	if (compression != null) stream = stream.pipe(decompress(compression));

	if (format == null) return asLines(stream);

	// Parse the stream based on file type
	return parser(format, stream);
}
