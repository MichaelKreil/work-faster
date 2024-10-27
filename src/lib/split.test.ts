// get_splitter.test.ts
import { getSplitter } from './split.js';
import { Readable } from 'node:stream';

describe('getSplitter', () => {
	it('should split data by newline by default', (done) => {
		const splitter = getSplitter();
		const input = chunksToStream(['line1\nline2\nline3\n']);

		const results: string[] = [];
		splitter.on('data', (line) => results.push(line));
		splitter.on('end', () => {
			expect(results).toEqual(['line1', 'line2', 'line3', '']);
			done();
		});

		input.pipe(splitter);
	});

	it('should support custom delimiters', (done) => {
		const splitter = getSplitter(';');
		const input = chunksToStream(['item1;item2;item3;']);

		const results: string[] = [];
		splitter.on('data', (item) => results.push(item));
		splitter.on('end', () => {
			expect(results).toEqual(['item1', 'item2', 'item3', '']);
			done();
		});

		input.pipe(splitter);
	});

	it('should handle partial lines across chunks', (done) => {
		const splitter = getSplitter();
		const input = chunksToStream(['partial', 'Line1\npartial', 'Line2\n']);

		const results: string[] = [];
		splitter.on('data', (line) => results.push(line));
		splitter.on('end', () => {
			expect(results).toEqual(['partialLine1', 'partialLine2', '']);
			done();
		});

		input.pipe(splitter);
	});

	it('should push the last line on flush', (done) => {
		const splitter = getSplitter();
		const input = chunksToStream(['lastLineWithoutNewline']);

		const results: string[] = [];
		splitter.on('data', (line) => results.push(line));
		splitter.on('end', () => {
			expect(results).toEqual(['lastLineWithoutNewline']);
			done();
		});

		input.pipe(splitter);
	});

	it('should support non-UTF-8 encodings', (done) => {
		const splitter = getSplitter(/\0/, 'utf16le');
		const input = chunksToStream([Buffer.from('line1\0line2\0line3\0', 'utf16le')]);

		const results: string[] = [];
		splitter.on('data', (line) => results.push(line));
		splitter.on('end', () => {
			expect(results).toEqual(['line1', 'line2', 'line3', '']);
			done();
		});

		input.pipe(splitter);
	});
});

function chunksToStream(chunks: string[] | Buffer[]): Readable {
	return new Readable({
		read() {
			chunks.forEach((chunk) => this.push(chunk));
			this.push(null);
		}
	});
}
