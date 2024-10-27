import { Readable, PassThrough, Transform } from 'node:stream';
import { jest } from '@jest/globals';

const createGunzip = jest.fn();
const createBrotliDecompress = jest.fn();
const spawn = jest.fn();

// Mock node:zlib and node:child_process modules using jest.unstable_mockModule
jest.unstable_mockModule('node:zlib', () => ({ createGunzip, createBrotliDecompress }));
jest.unstable_mockModule('node:child_process', () => ({ spawn }));

// Now dynamically import decompress after mocks are set up
const { decompress } = await import('./decompress.js');

describe('decompress', () => {
	let stream: Readable;
	const pipeSpy = jest.spyOn(Readable.prototype, 'pipe');
	createGunzip.mockReturnValue(new PassThrough());
	createBrotliDecompress.mockReturnValue(new PassThrough());
	spawn.mockReturnValue({
		stdin: new PassThrough(),
		stdout: new PassThrough(),
		stderr: new PassThrough(),
		on: jest.fn(),
		once: jest.fn(),
	});

	beforeEach(() => {
		stream = new Readable({
			read() {
				this.push('data');
				this.push(null);
			},
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should use createGunzip for .gz files', () => {
		const result = stream.pipe(decompress('gzip'));

		expect(createGunzip).toHaveBeenCalledTimes(1);
		expect(result).toBeInstanceOf(Transform);
		expect(pipeSpy).toHaveBeenCalledTimes(1);
	});

	it('should use createBrotliDecompress for .br files', () => {
		const result = stream.pipe(decompress('brotli'));

		expect(createBrotliDecompress).toHaveBeenCalledTimes(1);
		expect(result).toBeInstanceOf(Transform);
		expect(pipeSpy).toHaveBeenCalledTimes(1);
	});

	it('should use spawn with zstd command for .zst files', () => {
		const result = stream.pipe(decompress('zstd'));

		expect(spawn).toHaveBeenCalledWith('zstd', ['-d'], { stdio: ['pipe', 'pipe', 'pipe'] });
		expect(result).toBeInstanceOf(Transform);
		expect(pipeSpy).toHaveBeenCalledTimes(1);
	});

	it('should use spawn with lz4 command for .lz4 files', () => {
		const result = stream.pipe(decompress('lz4'));

		expect(spawn).toHaveBeenCalledWith('lz4', ['-d'], { stdio: ['pipe', 'pipe', 'pipe'] });
		expect(result).toBeInstanceOf(Transform);
		expect(pipeSpy).toHaveBeenCalledTimes(1);
	});
});
