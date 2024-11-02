import { asBuffer } from './conversion.js';
import { asLines, split } from './split.js';
import { arrayFromAsync, fromArray, fromValue, toArray } from './utils.js';

describe('split', () => {
	it('should split data by newline by default', async () => {
		const input = fromArray(['line1\nline2\nline3\n']);
		const results = await toArray(input.pipe(split()));
		expect(results).toEqual(['line1', 'line2', 'line3', '']);
	});

	it('should support custom delimiters', async () => {
		const input = fromArray(['item1;item2;item3;']);
		const results = await toArray(input.pipe(split(';')));
		expect(results).toEqual(['item1', 'item2', 'item3', '']);
	});

	it('should handle partial lines across chunks', async () => {
		const input = fromArray(['partial', 'Line1\npartial', 'Line2\n']);
		const results = await toArray(input.pipe(split()));
		expect(results).toEqual(['partialLine1', 'partialLine2', '']);
	});

	it('should push the last line on flush', async () => {
		const input = fromArray(['lastLineWithoutNewline']);
		const results = await toArray(input.pipe(split()));
		expect(results).toEqual(['lastLineWithoutNewline']);
	});

	it('should support non-UTF-8 encodings', async () => {
		const input = fromArray([Buffer.from('line1\0line2\0line3\0', 'utf16le')]);
		const results = await toArray(input.pipe(split(/\0/, 'utf16le')));
		expect(results).toEqual(['line1', 'line2', 'line3', '']);
	});
});


describe('asLines', () => {
	it('should split lines by newline by default', async () => {
		const input = asBuffer(fromValue('line1\nline2\nline3\n'));
		const result: string[] = await arrayFromAsync(asLines(input));
		expect(result).toEqual(['line1', 'line2', 'line3', '']);
	});

	it('should split lines by custom delimiter', async () => {
		const input = asBuffer(fromValue('item1;item2;item3;'));
		const result: string[] = await arrayFromAsync(asLines(input, ';'));
		expect(result).toEqual(['item1', 'item2', 'item3', '']);
	});

	it('should handle partial lines across chunks', async () => {
		const input = asBuffer(fromArray(['partial', 'Line1\npartial', 'Line2\n']));
		const result: string[] = await arrayFromAsync(asLines(input));
		expect(result).toEqual(['partialLine1', 'partialLine2', '']);
	});

	it('should push the last line on flush', async () => {
		const input = asBuffer(fromValue('lastLineWithoutNewline'));
		const result: string[] = await arrayFromAsync(asLines(input));
		expect(result).toEqual(['lastLineWithoutNewline']);
	});
});