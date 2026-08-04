import { spawn } from './spawn.js';
import { fromValue, toString } from './utils.js';

describe('spawn', () => {
	it('should return the first 8 bytes of input using "head -c 8"', async () => {
		expect(
			await toString(fromValue('This is a test input that should be truncated.').pipe(spawn('head', ['-c', '8']))),
		).toBe('This is ');
	});

	it('should handle larger input and return only the first 8 bytes', async () => {
		expect(
			await toString(
				fromValue('Lorem ipsum dolor sit amet, consectetur adipiscing elit.').pipe(spawn('head', ['-c', '8'])),
			),
		).toBe('Lorem ip');
	});

	it('should emit an error event for an invalid command', async () => {
		await expect(toString(spawn('invalidCommand', []))).rejects.toThrow(
			'Failed to execute command "invalidCommand": spawn invalidCommand ENOENT',
		);
	});

	it('should not treat stderr output from a successful command as an error', async () => {
		// `sh -c 'echo err 1>&2; cat'` writes to stderr but exits 0.
		const result = await toString(fromValue('payload').pipe(spawn('sh', ['-c', 'echo err 1>&2; cat'])));
		expect(result).toBe('payload');
	});

	it('should include stderr in the error when the command exits non-zero', async () => {
		await expect(toString(fromValue('').pipe(spawn('sh', ['-c', 'echo "boom" 1>&2; exit 3'])))).rejects.toThrow(
			/Process exited with code 3.*boom/s,
		);
	});

	it('should keep only the tail of a large stderr stream', async () => {
		// 4 MB of stderr from a failing child. Buffering it whole is what a
		// looping process would use to exhaust memory; only the tail is useful.
		const script = 'yes "0123456789abcdefghijklmnopqrstuvwxyz" | head -c 4000000 1>&2; echo LASTLINE 1>&2; exit 4';

		const error = await toString(fromValue('').pipe(spawn('sh', ['-c', script]))).catch((e: Error) => e);

		expect(error).toBeInstanceOf(Error);
		const { message } = error as Error;
		expect(message).toMatch(/Process exited with code 4/);
		// The end of stderr survives, the bulk does not, and it says so.
		expect(message).toContain('LASTLINE');
		expect(message).toContain('[stderr truncated]');
		expect(message.length).toBeLessThan(16 * 1024);
	});

	it('should complete cleanly when the child closes stdin early (EPIPE)', async () => {
		// `head -c 1` reads one byte and exits, leaving us writing into a
		// closed stdin. The transform should swallow the resulting EPIPE
		// and complete with whatever the child emitted.
		const big = Buffer.alloc(2 * 1024 * 1024, 0x41); // 2 MB of 'A'
		const result = await toString(fromValue(big.toString()).pipe(spawn('head', ['-c', '1'])));
		expect(result).toBe('A');
	});

	it('should fail when the child is killed by a signal', async () => {
		// `kill -TERM $$` makes the shell terminate itself before exiting.
		await expect(toString(fromValue('').pipe(spawn('sh', ['-c', 'kill -TERM $$'])))).rejects.toThrow(
			/Process killed by signal SIGTERM/,
		);
	});
});
