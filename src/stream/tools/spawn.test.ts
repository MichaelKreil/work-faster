import { spawn } from './spawn.js';
import { fromValue, toString } from './utils.js';

describe('spawn', () => {
	it('should return the first 8 bytes of input using "head -c 8"', async () => {
		expect(await toString(fromValue('This is a test input that should be truncated.')
			.pipe(spawn('head', ['-c', '8']))
		)).toBe('This is ');
	});

	it('should handle larger input and return only the first 8 bytes', async () => {
		expect(await toString(fromValue('Lorem ipsum dolor sit amet, consectetur adipiscing elit.')
			.pipe(spawn('head', ['-c', '8']))
		)).toBe('Lorem ip');
	});

	it('should emit an error event for an invalid command', async () => {
		await expect(toString(spawn('invalidCommand', [])))
			.rejects.toThrow('Failed to execute command "invalidCommand": spawn invalidCommand ENOENT')
	});
});
