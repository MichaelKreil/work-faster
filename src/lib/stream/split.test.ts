import { asLines, split } from './split.js';
import { fromArray, fromString, toStringArray } from './utils.js';

describe('split', () => {
	it('should split data by newline by default', async () => {
		const splitter = split();
		const input = fromArray(['line1\nline2\nline3\n']);
		const results = await toStringArray(input.pipe(splitter));
		expect(results).toEqual(['line1', 'line2', 'line3', '']);
	});

	it('should support custom delimiters', async () => {
		const splitter = split(';');
		const input = fromArray(['item1;item2;item3;']);
		const results = await toStringArray(input.pipe(splitter));
		expect(results).toEqual(['item1', 'item2', 'item3', '']);
	});

	it('should handle partial lines across chunks', async () => {
		const splitter = split();
		const input = fromArray(['partial', 'Line1\npartial', 'Line2\n']);
		const results = await toStringArray(input.pipe(splitter));
		expect(results).toEqual(['partialLine1', 'partialLine2', '']);
	});

	it('should push the last line on flush', async () => {
		const splitter = split();
		const input = fromArray(['lastLineWithoutNewline']);
		const results = await toStringArray(input.pipe(splitter));
		expect(results).toEqual(['lastLineWithoutNewline']);
	});

	it('should support non-UTF-8 encodings', async () => {
		const splitter = split(/\0/, 'utf16le');
		const input = fromArray([Buffer.from('line1\0line2\0line3\0', 'utf16le')]);
		const results = await toStringArray(input.pipe(splitter));
		expect(results).toEqual(['line1', 'line2', 'line3', '']);
	});
});


describe('asLines', () => {
	it('should split lines by newline by default', async () => {
		const input = fromString('line1\nline2\nline3\n');
		const result: string[] = [];
		for await (const line of asLines(input)) result.push(line);
		expect(result).toEqual(['line1', 'line2', 'line3', '']);
	});

	it('should split lines by custom delimiter', async () => {
		const input = fromString('item1;item2;item3;');
		const result: string[] = [];
		for await (const line of asLines(input, ';')) result.push(line);
		expect(result).toEqual(['item1', 'item2', 'item3', '']);
	});

	it('should handle partial lines across chunks', async () => {
		const input = fromArray(['partial', 'Line1\npartial', 'Line2\n']);
		const result: string[] = [];
		for await (const line of asLines(input)) result.push(line);
		expect(result).toEqual(['partialLine1', 'partialLine2', '']);
	});

	it('should push the last line on flush', async () => {
		const input = fromString('lastLineWithoutNewline');
		const result: string[] = [];
		for await (const line of asLines(input)) result.push(line);
		expect(result).toEqual(['lastLineWithoutNewline']);
	});
});