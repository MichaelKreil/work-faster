import { asBuffer } from './conversion.js';
import { WFTransform, wrapRead, wrapTransform } from './types.js';
import { arrayFromAsync } from './utils.js';

describe('asBuffer', () => {
	const stringData = 'This is a test string';
	const bufferData = Buffer.from(stringData);

	describe('when used with WFReadable', () => {
		it('should convert string data to Buffer data', async () => {
			const readable = wrapRead([stringData, bufferData]);
			const bufferReadable = asBuffer(readable);

			const chunks = await arrayFromAsync(bufferReadable);

			expect(chunks).toHaveLength(2);
			expect(Buffer.isBuffer(chunks[0])).toBe(true);
			expect(chunks[0].toString()).toBe(stringData);
			expect(chunks[1]).toEqual(bufferData); // Original buffer data should be unchanged
		});
	});

	describe('when used with WFTransform', () => {
		it('should convert string data to Buffer data while transforming', async () => {
			const transform = wrapTransform((data: string | Buffer) => {
				if (typeof data === 'string') return data.toUpperCase();
				return data.toString().toUpperCase();
			});
			const bufferTransform = asBuffer(transform) as WFTransform<string | Buffer, Buffer>;

			const transformedData = wrapRead([stringData, bufferData]).pipe(bufferTransform);
			const chunks = await arrayFromAsync(transformedData);

			expect(chunks).toHaveLength(2);
			expect(Buffer.isBuffer(chunks[0])).toBe(true);
			expect(chunks[0].toString()).toBe(stringData.toUpperCase());
			expect(chunks[1].toString()).toBe(bufferData.toString().toUpperCase());
		});

		it('should leave Buffer data unchanged', async () => {
			const passthroughTransform = wrapTransform((data: Buffer | string) => data);
			const bufferTransform = asBuffer(passthroughTransform) as WFTransform<Buffer | string, Buffer>;

			const transformedData = wrapRead([bufferData]).pipe(bufferTransform);
			const chunks = await arrayFromAsync(transformedData);

			expect(chunks).toHaveLength(1);
			expect(chunks[0]).toEqual(bufferData); // Original buffer data should be unchanged
		});
	});
});
