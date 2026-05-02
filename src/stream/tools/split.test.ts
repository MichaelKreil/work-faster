import { asBuffer } from './conversion.js';
import { asLines, split, splitFast } from './split.js';
import { arrayFromAsync, fromArray, fromValue, toArray } from './utils.js';

describe('split', () => {
	it('should split data by newline by default', async () => {
		const input = fromArray(['line1\nline2\nline3\n']);
		const results = await toArray(input.pipe(split()));
		expect(results).toEqual(['line1', 'line2', 'line3']);
	});

	it('should support custom delimiters', async () => {
		const input = fromArray(['item1;item2;item3;']);
		const results = await toArray(input.pipe(split(';')));
		expect(results).toEqual(['item1', 'item2', 'item3']);
	});

	it('should handle partial lines across chunks', async () => {
		const input = fromArray(['partial', 'Line1\npartial', 'Line2\n']);
		const results = await toArray(input.pipe(split()));
		expect(results).toEqual(['partialLine1', 'partialLine2']);
	});

	it('should push the last line on flush', async () => {
		const input = fromArray(['lastLineWithoutNewline']);
		const results = await toArray(input.pipe(split()));
		expect(results).toEqual(['lastLineWithoutNewline']);
	});

	it('should support non-UTF-8 encodings', async () => {
		const input = fromArray([Buffer.from('line1\0line2\0line3\0', 'utf16le')]);
		const results = await toArray(input.pipe(split(/\0/, 'utf16le')));
		expect(results).toEqual(['line1', 'line2', 'line3']);
	});

	it('should error when a line exceeds maxLineSize on the slow path', async () => {
		// Regex delimiter forces splitSlow; large delimiter-free chunk trips the cap.
		const big = Buffer.alloc(2 * 1024 * 1024, 0x41);
		const input = fromValue(big);
		await expect(toArray(input.pipe(split(/X+/, 'utf8', 1024 * 1024)))).rejects.toThrow(/exceeded max size/);
	});
});

describe('splitLines', () => {
	it('should split data by 0xA0 delimiter', async () => {
		const input = fromValue(Buffer.from('part1\npart2\npart3\n'));
		const results = await toArray(input.pipe(splitFast()));
		expect(results).toEqual(['part1', 'part2', 'part3']);
	});

	it('should handle partial data across chunks', async () => {
		const input = fromArray([Buffer.from('partial1\npartial'), Buffer.from('2\npartial3\n')]);
		const results = await toArray(input.pipe(splitFast()));
		expect(results).toEqual(['partial1', 'partial2', 'partial3']);
	});

	it('should handle large data accumulations up to 16MB', async () => {
		// Create large data of 16MB with repeated patterns split by 0xA0
		const largeData = Buffer.concat(Array(16 * 1024).fill(Buffer.from('data\n')));
		const input = fromValue(largeData);
		const results = await toArray(input.pipe(splitFast()));
		const expected = Array(16 * 1024).fill('data');
		expect(results).toEqual(expected);
	});

	it('should push the last segment on flush if not ending with 0xA0', async () => {
		const input = fromValue(Buffer.from('lastSegmentWithoutDelimiter'));
		const results = await toArray(input.pipe(splitFast()));
		expect(results).toEqual(['lastSegmentWithoutDelimiter']);
	});

	it('should carry the partial last line across the MAX_BUFFER_SIZE boundary', async () => {
		// Build a chunk that crosses the 16 MB threshold and ends mid-line.
		// First chunk: 16 MB + a few bytes of "abc" without newline.
		// Second chunk: "def\n" so the assembled tail is "abcdef".
		const big = Buffer.alloc(16 * 1024 * 1024 + 3, 0x41); // 16 MB+3 of 'A'
		big[big.length - 3] = 0x61; // a
		big[big.length - 2] = 0x62; // b
		big[big.length - 1] = 0x63; // c
		// Insert a newline near the start so we have at least one full line
		// before the threshold trips and lastChunk gets carried.
		big[5] = 0x0a; // \n at position 5

		const chunks = [big, Buffer.from('def\nshort\n')];
		const results = await toArray(fromArray(chunks).pipe(splitFast()));

		// First line: 5 'A's, then a long line of 'A's ending with 'abcdef'.
		expect(results.length).toBe(3);
		expect(results[0]).toBe('AAAAA');
		expect(results[1].endsWith('abcdef')).toBe(true);
		expect(results[1].length).toBe(16 * 1024 * 1024 + 3 - 6 + 3); // remaining As + 'abc' + 'def'
		expect(results[2]).toBe('short');
	});

	it('should error if a single line exceeds maxLineSize', async () => {
		// 32MB of non-newline bytes pushes lastChunk past the 1MB cap.
		const big = Buffer.alloc(32 * 1024 * 1024, 0x41);
		const input = fromValue(big);
		await expect(toArray(input.pipe(splitFast(10, 'utf8', 1024 * 1024)))).rejects.toThrow(/exceeded max size/);
	});

	it('should preserve UTF-8 multi-byte chars when chunks split mid-character', async () => {
		// 'café\nrésumé\n' as UTF-8 split between the two bytes of 'é' (0xC3 0xA9).
		const full = Buffer.from('café\nrésumé\n', 'utf8');
		const cut = full.indexOf(0xc3); // first byte of 'é' in 'café'
		const input = fromArray([full.subarray(0, cut + 1), full.subarray(cut + 1)]);
		const results = await toArray(input.pipe(splitFast()));
		expect(results).toEqual(['café', 'résumé']);
	});
});

describe('asLines', () => {
	it('should split lines by newline by default', async () => {
		const input = asBuffer(fromValue('line1\nline2\nline3\n'));
		const result: string[] = await arrayFromAsync(asLines(input));
		expect(result).toEqual(['line1', 'line2', 'line3']);
	});

	it('should split lines by custom delimiter', async () => {
		const input = asBuffer(fromValue('item1;item2;item3;'));
		const result: string[] = await arrayFromAsync(asLines(input, ';'));
		expect(result).toEqual(['item1', 'item2', 'item3']);
	});

	it('should handle partial lines across chunks', async () => {
		const input = asBuffer(fromArray(['partial', 'Line1\npartial', 'Line2\n']));
		const result: string[] = await arrayFromAsync(asLines(input));
		expect(result).toEqual(['partialLine1', 'partialLine2']);
	});

	it('should push the last line on flush', async () => {
		const input = asBuffer(fromValue('lastLineWithoutNewline'));
		const result: string[] = await arrayFromAsync(asLines(input));
		expect(result).toEqual(['lastLineWithoutNewline']);
	});

	it('should use splitFast for numeric delimiter < 127', async () => {
		// Using tab character (code 9)
		const input = asBuffer(fromValue('item1\titem2\titem3\t'));
		const result: string[] = await arrayFromAsync(asLines(input, 9));
		expect(result).toEqual(['item1', 'item2', 'item3']);
	});

	it('should throw for numeric delimiter >= 127', async () => {
		const input = asBuffer(fromValue('test'));
		const generator = asLines(input, 127);
		await expect(generator.next()).rejects.toThrow('numeric matcher must be < 127');
	});

	it('should use split for regex delimiters', async () => {
		const input = asBuffer(fromValue('item1::item2::item3::'));
		const result: string[] = await arrayFromAsync(asLines(input, /::+/));
		expect(result).toEqual(['item1', 'item2', 'item3']);
	});

	it('should tear down the splitter when the consumer breaks early', async () => {
		const input = asBuffer(fromValue('a\nb\nc\nd\ne\n'));
		const lines: string[] = [];
		for await (const line of asLines(input)) {
			lines.push(line);
			if (lines.length === 2) break;
		}
		expect(lines).toEqual(['a', 'b']);
		// Source stream should be torn down via the destroyed splitter.
		expect(input.inner.destroyed).toBe(true);
	});
});

describe('split edge cases', () => {
	it('should throw for numeric delimiter >= 127', () => {
		expect(() => split(127)).toThrow('numeric matcher must be < 127');
	});

	it('should use splitFast for numeric delimiter', async () => {
		const input = fromArray([Buffer.from('a\tb\tc\t')]);
		const results = await toArray(input.pipe(split(9))); // tab = 9
		expect(results).toEqual(['a', 'b', 'c']);
	});
});
