import child_process from 'node:child_process';
import { Transform } from 'node:stream';
import { WFTransform } from '../classes.js';

export function spawn(command: string, args: string[]): WFTransform<Buffer, Buffer> {
	const cp = child_process.spawn(command, args, {
		stdio: ['pipe', 'pipe', 'pipe'],
	});

	let pendingError: Error | null = null;
	let exited = false;
	const stderrChunks: Buffer[] = [];
	let onClose: (() => void) | null = null;

	const setError = (err: Error) => {
		if (!pendingError) pendingError = err;
	};

	const transformStream = new Transform({
		autoDestroy: true,
		transform(chunk, encoding, cb) {
			if (pendingError) return cb(pendingError);
			// Wait for stdin's write callback so we honor its high-water mark.
			cp.stdin.write(chunk, encoding, (err) => {
				if (err) {
					setError(err);
					cb(err);
				} else {
					cb();
				}
			});
		},
		flush(cb) {
			const finish = () => {
				if (pendingError) cb(pendingError);
				else cb();
			};
			cp.stdin.end();
			if (exited) finish();
			else onClose = finish;
		},
		destroy(err, cb) {
			if (!exited) cp.kill();
			cb(err);
		},
	});

	// Forward stdout while honoring backpressure on the readable side.
	cp.stdout.on('data', (data: Buffer) => {
		if (!transformStream.push(data)) cp.stdout.pause();
	});
	cp.stdout.on('end', () => {
		// Nothing to push; close is handled via the child's exit.
	});
	transformStream._read = () => {
		cp.stdout.resume();
	};

	cp.stderr.on('data', (data: Buffer) => {
		stderrChunks.push(data);
	});

	cp.stdin.on('error', (err) => {
		// EPIPE is expected when the child exits before we finish writing;
		// the real cause will be reported via the exit code path.
		if ((err as NodeJS.ErrnoException).code !== 'EPIPE') {
			setError(new Error(`Failed to write to stdin: ${err.message}`));
		}
	});

	cp.on('error', (err) => {
		setError(new Error(`Failed to execute command "${[command, ...args].join(' ')}": ${err.message}`));
		exited = true;
		if (onClose) {
			const cb = onClose;
			onClose = null;
			cb();
		} else {
			transformStream.destroy(pendingError ?? err);
		}
	});

	cp.on('close', (code) => {
		exited = true;
		if (code !== 0 && code !== null) {
			const stderrText = Buffer.concat(stderrChunks).toString().trim();
			const detail = stderrText ? `: ${stderrText}` : '';
			setError(new Error(`Process exited with code ${code}${detail}`));
		}
		if (onClose) {
			const cb = onClose;
			onClose = null;
			cb();
		} else if (pendingError) {
			transformStream.destroy(pendingError);
		}
	});

	return new WFTransform(transformStream);
}
