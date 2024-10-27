import { spawn } from 'node:child_process';
import { Transform } from 'node:stream';

export function spawnProcessAsStream(command: string, args: string[]): Transform {
	const cp = spawn(command, args, {
		stdio: ['pipe', 'pipe', 'pipe'], // Redirect stderr to allow error handling
	});

	let hasEmittedError = false;

	// Create a Transform stream to wrap stdin and stdout of the process
	const transformStream = new Transform({
		autoDestroy: true,
		transform(chunk, encoding, cb) {
			cp.stdin.write(chunk, encoding, () => cb(null));
		},
		flush(cb) {
			cp.stdin.end();
			cp.once('close', () => cb());
		}
	});

	// Pipe stdout to the transform stream output
	cp.stdout.on('data', (data) => {
		transformStream.push(data)
	});

	// Function to emit an error if it hasn't been emitted yet
	const emitErrorOnce = (error: Error) => {
		if (!hasEmittedError) {
			hasEmittedError = true;
			transformStream.emit('error', error);
		}
	};

	// Handle process close to ensure process completion and handle non-zero exit codes
	cp.on('close', (code) => {
		if (code !== 0) {
			emitErrorOnce(new Error(`Process exited with code ${code}`));
		}
	});

	// Capture stderr data and emit as error on the transform stream
	cp.stderr.on('data', (data) => {
		emitErrorOnce(new Error(`Process stderr: ${data.toString()}`));
	});

	// Handle errors from stdin write
	cp.stdin.on('error', (err) => {
		emitErrorOnce(new Error(`Failed to write to stdin: ${err.message}`));
	});

	// Handle errors from the spawned process itself
	cp.on('error', (err) => {
		emitErrorOnce(new Error(`Failed to execute command: ${err.message}`));
	});

	return transformStream;
}
