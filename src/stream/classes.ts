import { Duplex, Readable, Transform, Writable } from 'node:stream';
import { merge } from './tools/merge.js';

/**
 * Writes a chunk to a writable/duplex stream, honoring backpressure and
 * settling on stream errors. Without the error handling, a write that is
 * backpressured (write() returned false) would wait forever on a 'drain' that
 * never fires once the stream has errored, deadlocking the caller.
 */
function writeToInner(inner: Writable, content: unknown): Promise<void> {
	return new Promise((resolve, reject) => {
		if (inner.destroyed || inner.writableEnded) {
			reject(new Error('Cannot write to a stream that has been destroyed or ended'));
			return;
		}

		let settled = false;
		const onDrain = () => {
			if (settled) return;
			settled = true;
			inner.removeListener('error', onError);
			resolve();
		};
		const onError = (err: Error) => {
			if (settled) return;
			settled = true;
			inner.removeListener('drain', onDrain);
			reject(err ?? new Error('Stream error during write'));
		};

		inner.once('error', onError);
		let flushed: boolean;
		try {
			flushed = inner.write(content, (err) => {
				if (err) onError(err);
			});
		} catch (err) {
			onError(err instanceof Error ? err : new Error(String(err)));
			return;
		}

		if (flushed) {
			if (settled) return;
			settled = true;
			inner.removeListener('error', onError);
			resolve();
		} else {
			inner.once('drain', onDrain);
		}
	});
}

/**
 * Ends a writable/duplex stream and resolves once it has finished. Attaches an
 * error listener so that a stream which errors before emitting 'finish' rejects
 * instead of hanging on a callback that never fires.
 */
function endInner(inner: Writable): Promise<void> {
	return new Promise((resolve, reject) => {
		if (inner.writableFinished) return resolve();
		if (inner.destroyed) return reject(new Error('Cannot end a stream that has been destroyed'));

		let settled = false;
		const onError = (err: Error) => {
			if (settled) return;
			settled = true;
			reject(err ?? new Error('Stream error during end'));
		};
		inner.once('error', onError);
		inner.end(() => {
			if (settled) return;
			settled = true;
			inner.removeListener('error', onError);
			resolve();
		});
	});
}

/**
 * Wrapper around Node.js Readable stream with typed output and chainable pipe/merge methods.
 */
export class WFReadable<O = unknown> {
	readonly type = 'Readable';
	inner: Readable;
	constructor(inner: Readable) {
		this.inner = inner;
	}

	pipe<T>(destination: WFTransform<O, T>): WFTransform<O, T>;
	pipe(destination: WFWritable<O>): WFWritable<O>;
	pipe<T>(destination: WFWritable<O> | WFTransform<O, T>): WFWritable<O> | WFTransform<O, T>;
	pipe<T>(destination: WFWritable<O> | WFTransform<O, T>): WFWritable<O> | WFTransform<O, T> {
		if (destination instanceof Duplex) {
			this.inner.pipe(destination);
			return new WFTransform(destination);
		}
		this.inner.pipe(destination.inner);
		return destination;
	}

	merge<T>(destination: WFTransform<O, T>): WFReadable<T> {
		this.pipe(destination);
		return new WFReadable(destination.inner);
	}

	[Symbol.asyncIterator](): AsyncIterator<O> {
		return this.inner[Symbol.asyncIterator]();
	}
}

/**
 * Wrapper around Node.js Duplex/Transform stream with typed input/output and chainable methods.
 */
export class WFTransform<I = unknown, O = I> {
	readonly type = 'Transform';
	inner: Duplex;

	constructor(inner: Duplex) {
		this.inner = inner;
	}

	pipe<T>(destination: WFTransform<O, T>): WFTransform<O, T>;
	pipe(destination: WFWritable<O>): WFWritable<O>;
	pipe<T>(destination: Duplex | Transform): WFTransform<O, T>;
	pipe<T>(destination: WFTransform<O, T> | WFWritable<O> | Duplex | Transform): WFTransform<O, T> | WFWritable<O> {
		if (destination instanceof Duplex) {
			this.inner.pipe(destination);
			return new WFTransform(destination);
		}
		this.inner.pipe(destination.inner);
		return destination;
	}

	merge<T>(destination: WFTransform<O, T>): WFTransform<I, T>;
	merge(destination: WFWritable<O>): WFWritable<I>;
	merge<T>(destination: WFWritable<O> | WFTransform<O, T>): WFWritable<I> | WFTransform<I, T> {
		return merge(this, destination);
	}

	[Symbol.asyncIterator](): AsyncIterator<O> {
		return this.inner[Symbol.asyncIterator]();
	}

	// Write method that respects backpressure and rejects on stream errors
	write(content: I): Promise<void> {
		return writeToInner(this.inner, content);
	}

	// End method that finalizes the stream
	end(): Promise<void> {
		return endInner(this.inner);
	}
}

/**
 * Wrapper around Node.js Writable stream with typed input and backpressure-aware write method.
 */
export class WFWritable<I = unknown> {
	readonly type = 'Writable';
	inner: Writable;

	constructor(inner: Writable) {
		this.inner = inner;
	}

	// Write method that respects backpressure and rejects on stream errors
	write(content: I): Promise<void> {
		return writeToInner(this.inner, content);
	}

	// End method that finalizes the stream
	end(): Promise<void> {
		return endInner(this.inner);
	}
}
