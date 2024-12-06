import { fromValue } from './utils.js';
import { parser } from './parser.js';

describe('parser', () => {
	describe('CSV parser', () => {
		it('should parse CSV data', async () => {
			const stream = fromValue('name,age\nAlice,30\nBob,25\n');

			const result: object[] = [];
			for await (const entry of parser('csv', stream)) {
				result.push(entry);
			}

			expect(result).toEqual([{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]);
		});

		it('should handle an empty CSV stream', async () => {
			const stream = fromValue('');

			const result: object[] = [];
			for await (const entry of parser('csv', stream)) {
				result.push(entry);
			}

			expect(result).toEqual([]);
		});

		it('should detect and parse CSV data with semicolon delimiter', async () => {
			const stream = fromValue('name;age\nAlice;30\nBob;25\n');

			const result: object[] = [];
			for await (const entry of parser('csv', stream)) {
				result.push(entry);
			}

			expect(result).toEqual([{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]);
		});

		it('should detect and parse CSV data with tab delimiter', async () => {
			const stream = fromValue('name\tage\nAlice\t30\nBob\t25\n');

			const result: object[] = [];
			for await (const entry of parser('csv', stream)) {
				result.push(entry);
			}

			expect(result).toEqual([{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]);
		});

		it('should handle empty rows gracefully', async () => {
			const stream = fromValue('name,age\nAlice,30\n\nBob,25\n');

			const result: object[] = [];
			for await (const entry of parser('csv', stream)) {
				result.push(entry);
			}

			expect(result).toEqual([{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]);
		});
	});

	describe('TSV parser', () => {
		it('should parse TSV data', async () => {
			const stream = fromValue('name\tage\nAlice\t30\nBob\t25\n');

			const result: object[] = [];
			for await (const entry of parser('tsv', stream)) {
				result.push(entry);
			}

			expect(result).toEqual([{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]);
		});
	});

	describe('NDJSON parser', () => {
		it('should parse NDJSON data', async () => {
			const stream = fromValue('{"name":"Alice","age":30}\n{"name":"Bob","age":25}\n');

			const result = [];
			for await (const entry of parser('ndjson', stream)) {
				result.push(entry);
			}

			expect(result).toEqual([{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }]);
		});

		it('should ignore empty lines in NDJSON data', async () => {
			const stream = fromValue('{"name":"Alice","age":30}\n\n{"name":"Bob","age":25}\n');

			const result = [];
			for await (const entry of parser('ndjson', stream)) {
				result.push(entry);
			}

			expect(result).toEqual([{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }]);
		});

		it('should throw an error for invalid JSON', async () => {
			const stream = fromValue('{"name":"Alice","age":30}\n{"name":"Bob",age:25}\n');

			const result = [];
			await expect(async () => {
				for await (const entry of parser('ndjson', stream)) {
					result.push(entry);
				}
			}).rejects.toThrow();
		});
	});

	describe('Lines parser', () => {
		it('should parse lines of text', async () => {
			const stream = fromValue('line1\nline2\nline3\n');

			const result: string[] = [];
			for await (const entry of parser('lines', stream)) {
				result.push(entry);
			}

			expect(result).toEqual(['line1', 'line2', 'line3']);
		});

		it('should handle empty lines gracefully', async () => {
			const stream = fromValue('line1\n\nline2\nline3\n\n');

			const result: string[] = [];
			for await (const entry of parser('lines', stream)) {
				result.push(entry);
			}

			expect(result).toEqual(['line1', '', 'line2', 'line3', '']);
		});

		it('should handle an empty stream', async () => {
			const stream = fromValue('');

			const result: string[] = [];
			for await (const entry of parser('lines', stream)) {
				result.push(entry);
			}

			expect(result).toEqual([]);
		});
	});

	describe('Error handling', () => {
		it('should throw an error for unsupported formats', async () => {
			const stream = fromValue('invalid format data');

			await expect(() => parser('unsupported' as unknown as 'ndjson', stream)).toThrow('Unknown format: unsupported');
		});
	});
});
