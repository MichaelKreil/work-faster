import { ProgressBar } from '../progress_bar.js';
import { read } from './read.js';
import { Compression, decompress } from './decompress.js';
import { Format, parser } from './parser.js';

export async function readDataFile(
	filename: string,
	compression: Compression | null,
	format: Format,
	progress?: true
): Promise<AsyncGenerator<object>> {

	// Read the initial stream
	// eslint-disable-next-line prefer-const
	let { stream, size } = await read(filename);

	// Optionally add progress tracking
	if (progress && size) {
		const progress = new ProgressBar(size);
		let pos = 0;
		stream.on('data', (chunk: Buffer) => {
			pos += chunk.length;
			progress.update(pos);
		});
		stream.on('close', () => progress.close());
	}

	// Decompress the stream if needed
	if (compression != null) stream = stream.pipe(decompress(compression));

	// Parse the stream based on file type
	return parser(format, stream);
}
