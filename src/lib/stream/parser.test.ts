import { fromString } from './utils.js';
import { parser } from './parser.js';

describe('parser', () => {
	describe('CSV parser', () => {
		it('should parse CSV data using the standard parser', async () => {
			const csvData = 'name,age\nAlice,30\nBob,25\n';
			const stream = fromString(csvData);

			const result: object[] = [];
			for await (const entry of parser('csv', stream)) {
				result.push(entry);
			}

			expect(result).toEqual([
				{ name: 'Alice', age: '30' },
				{ name: 'Bob', age: '25' },
			]);
		});
	});

	describe('CSV Fast parser', () => {
		it('should parse CSV data using the fast parser', async () => {
			const csvData = 'name,age\nAlice,30\nBob,25\n';
			const stream = fromString(csvData);

			const result: object[] = [];
			for await (const entry of parser('csv_fast', stream)) {
				result.push(entry);
			}

			expect(result).toEqual([
				{ name: 'Alice', age: '30' },
				{ name: 'Bob', age: '25' },
			]);
		});

		it('should detect and parse CSV data with semicolon delimiter', async () => {
			const csvData = 'name;age\nAlice;30\nBob;25\n';
			const stream = fromString(csvData);

			const result: object[] = [];
			for await (const entry of parser('csv_fast', stream)) {
				result.push(entry);
			}

			expect(result).toEqual([
				{ name: 'Alice', age: '30' },
				{ name: 'Bob', age: '25' },
			]);
		});

		it('should detect and parse CSV data with tab delimiter', async () => {
			const csvData = 'name\tage\nAlice\t30\nBob\t25\n';
			const stream = fromString(csvData);

			const result: object[] = [];
			for await (const entry of parser('csv_fast', stream)) {
				result.push(entry);
			}

			expect(result).toEqual([
				{ name: 'Alice', age: '30' },
				{ name: 'Bob', age: '25' },
			]);
		});
	});

	describe('NDJSON parser', () => {
		it('should parse NDJSON data', async () => {
			const ndjsonData = '{"name":"Alice","age":30}\n{"name":"Bob","age":25}\n';
			const stream = fromString(ndjsonData);

			const result: object[] = [];
			for await (const entry of parser('json', stream)) {
				result.push(entry);
			}

			expect(result).toEqual([
				{ name: 'Alice', age: 30 },
				{ name: 'Bob', age: 25 },
			]);
		});

		it('should ignore empty lines in NDJSON data', async () => {
			const ndjsonData = '{"name":"Alice","age":30}\n\n{"name":"Bob","age":25}\n';
			const stream = fromString(ndjsonData);

			const result: object[] = [];
			for await (const entry of parser('json', stream)) {
				result.push(entry);
			}

			expect(result).toEqual([
				{ name: 'Alice', age: 30 },
				{ name: 'Bob', age: 25 },
			]);
		});
	});
});
