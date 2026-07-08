import { PassThrough, Transform, Writable } from 'node:stream';
import { WFTransform, WFWritable } from './classes.js';

describe('WFWritable', () => {
	it('should resolve write() once a backpressured stream drains', async () => {
		const inner = new PassThrough({ highWaterMark: 1 });
		const w = new WFWritable<Buffer>(inner);

		let resolved = false;
		const p = w.write(Buffer.from('1234567890')).then(() => (resolved = true));

		// Backpressured: not resolved until the buffer is consumed.
		expect(resolved).toBe(false);
		inner.resume(); // drain the internal buffer
		await p;
		expect(resolved).toBe(true);
	});

	it('should reject write() when a backpressured stream errors instead of hanging', async () => {
		const inner = new Writable({
			highWaterMark: 1,
			write(_chunk, _enc, cb) {
				cb(new Error('boom'));
			},
		});
		inner.on('error', () => {}); // avoid an unhandled 'error' crashing the test process
		const w = new WFWritable<Buffer>(inner);

		await expect(w.write(Buffer.from('1234567890'))).rejects.toThrow('boom');
	});

	it('should reject write() to an already-destroyed stream', async () => {
		const inner = new PassThrough();
		inner.destroy();
		const w = new WFWritable<Buffer>(inner);

		await expect(w.write(Buffer.from('x'))).rejects.toThrow(/destroyed or ended/);
	});

	it('should not leak error/drain listeners after a successful write', async () => {
		const inner = new PassThrough({ highWaterMark: 1 });
		const w = new WFWritable<Buffer>(inner);
		const baselineError = inner.listenerCount('error');
		const baselineDrain = inner.listenerCount('drain');

		const p = w.write(Buffer.from('1234567890'));
		inner.resume();
		await p;

		expect(inner.listenerCount('error')).toBe(baselineError);
		expect(inner.listenerCount('drain')).toBe(baselineDrain);
	});

	it('should reject end() when the stream errors before finishing', async () => {
		const inner = new Writable({
			write(_chunk, _enc, cb) {
				cb();
			},
			final(cb) {
				cb(new Error('final failed'));
			},
		});
		inner.on('error', () => {});
		const w = new WFWritable<Buffer>(inner);

		await expect(w.end()).rejects.toThrow('final failed');
	});

	it('should resolve end() on a clean finish', async () => {
		const inner = new PassThrough();
		inner.resume();
		const w = new WFWritable<Buffer>(inner);

		await expect(w.end()).resolves.toBeUndefined();
		expect(inner.writableFinished).toBe(true);
	});
});

describe('WFTransform', () => {
	it('should accept the input generic type in write() (not just Buffer)', async () => {
		// Regression: write() previously hardcoded `Buffer`, so this object-mode
		// write (and the documented `flatten().write([1,2,3])` example) failed to
		// compile. Typing here doubles as a compile-time guard.
		const inner = new PassThrough({ objectMode: true });
		const t = new WFTransform<{ id: number }, { id: number }>(inner);

		const received: unknown[] = [];
		inner.on('data', (chunk) => received.push(chunk));

		await t.write({ id: 1 });
		await t.write({ id: 2 });

		expect(received).toEqual([{ id: 1 }, { id: 2 }]);
	});

	it('should reject write() when a backpressured transform errors', async () => {
		const inner = new Transform({
			highWaterMark: 1,
			transform(_chunk, _enc, cb) {
				cb(new Error('transform boom'));
			},
		});
		inner.on('error', () => {});
		const t = new WFTransform<Buffer, Buffer>(inner);

		await expect(t.write(Buffer.from('1234567890'))).rejects.toThrow('transform boom');
	});
});
