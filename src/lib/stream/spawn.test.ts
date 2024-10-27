// spawnProcessAsStream.test.ts
import { spawnProcessAsStream } from './spawn.js';
import { fromString, toString } from './utils.js';

describe('spawnProcessAsStream', () => {
	it('should return the first 8 bytes of input using "head -c 8"', async () => {
		expect(await toString(fromString('This is a test input that should be truncated.')
			.pipe(spawnProcessAsStream('head', ['-c', '8']))
		)).toBe('This is ');
	});

	it('should handle large input and return only the first 8 bytes', async () => {
		expect(await toString(fromString('Lorem ipsum dolor sit amet, consectetur adipiscing elit.')
			.pipe(spawnProcessAsStream('head', ['-c', '8']))
		)).toBe('Lorem ip');
	});

	it('should emit an error event for an invalid command', (done) => {
		const processStream = spawnProcessAsStream('invalidCommand', []);
		processStream.on('error', (err) => {
			expect(err).toBeInstanceOf(Error);
			expect(err.message).toBe('Failed to execute command: spawn invalidCommand ENOENT');
			done();
		});
		fromString('test').pipe(processStream);
	});
});
