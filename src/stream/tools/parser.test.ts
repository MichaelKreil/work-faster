import { fromValue, toArray } from './utils.js';
import { parser } from './parser.js';
import { WFTransform } from '../classes.js';

describe('parser', () => {
	async function process(content: string, parser: WFTransform<Buffer, unknown>): Promise<unknown[]> {
		return toArray(fromValue(content).merge(parser))
	}

	const result = [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }];

	describe('CSV parser', () => {
		it('should parse CSV data', async () => {
			expect(await process('name,age\nAlice,30\nBob,25\n', parser('csv'))).toEqual(result);
		});

		it('should handle an empty CSV stream', async () => {
			expect(await process('', parser('csv'))).toEqual([]);
		});

		it('should detect and parse CSV data with semicolon delimiter', async () => {
			expect(await process('name;age\nAlice;30\nBob;25\n', parser('csv'))).toEqual(result);
		});

		it('should detect and parse CSV data with tab delimiter', async () => {
			expect(await process('name\tage\nAlice\t30\nBob\t25\n', parser('csv'))).toEqual(result);
		});

		it('should handle empty rows gracefully', async () => {
			expect(await process('name,age\nAlice,30\n\nBob,25\n', parser('csv'))).toEqual(result);
		});
	});

	describe('TSV parser', () => {
		it('should parse TSV data', async () => {
			expect(await process('name\tage\nAlice\t30\nBob\t25\n', parser('tsv'))).toEqual(result);
		});
	});

	describe('NDJSON parser', () => {
		const result = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];

		it('should parse NDJSON data', async () => {
			expect(await process('{"name":"Alice","age":30}\n{"name":"Bob","age":25}\n', parser('ndjson'))).toEqual(result);
		});

		it('should ignore empty lines in NDJSON data', async () => {
			expect(await process('{"name":"Alice","age":30}\n\n{"name":"Bob","age":25}\n', parser('ndjson'))).toEqual(result);
		});

		it('should throw an error for invalid JSON', async () => {
			expect(process('{"name":"Alice","age":30}\n{"name":"Bob",age:25}\n', parser('ndjson'))).rejects.toThrow();
		});
	});

	describe('Lines parser', () => {
		const result = ['line1', 'line2', 'line3'];

		it('should parse lines of text', async () => {
			expect(await process('line1\nline2\nline3\n', parser('lines'))).toEqual(result)
		});

		it('should handle empty lines gracefully', async () => {
			expect(await process('line1\n\nline2\nline3\n\n', parser('lines'))).toEqual(result)
		});

		it('should handle an empty stream', async () => {
			expect(await process('', parser('lines'))).toEqual([])
		});
	});

	describe('Error handling', () => {
		it('should throw an error for unsupported formats', async () => {
			expect(() => process('invalid format data', parser('unsupported' as unknown as 'ndjson'))).toThrow('Unknown format: unsupported');
		});
	});
});
