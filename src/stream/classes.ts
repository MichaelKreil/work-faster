import { Duplex, Readable, Transform, Writable } from "stream";
import { merge } from "./merge.js";

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

	merge<T>(destination: WFTransform<O, T>): WFReadable<T>;
	merge<T>(destination: WFTransform<O, T>): WFReadable<T> {
		this.pipe(destination);
		return new WFReadable(destination.inner);
	}

	[Symbol.asyncIterator](): AsyncIterator<O> {
		return this.inner[Symbol.asyncIterator]()
	}
}

export class WFTransform<I = unknown, O = I> {
	readonly type = 'Transform';
	inner: Duplex;

	constructor(inner: Duplex) {
		this.inner = inner;
	}

	pipe<T>(destination: WFTransform<O, T>): WFTransform<O, T>;
	pipe(destination: WFWritable<O>): WFWritable<O>;
	pipe<T>(destination: Duplex | Transform): WFTransform<O, T>;
	pipe<T>(
		destination: WFTransform<O, T> | WFWritable<O> | Duplex | Transform
	): WFTransform<O, T> | WFWritable<O> {
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
		return this.inner[Symbol.asyncIterator]()
	}

	// Write method that respects backpressure
	write(content: Buffer): Promise<void> {
		return new Promise(r => {
			if (!this.inner.write(content)) {
				this.inner.once('drain', r);
			} else {
				r();
			}
		})
	}

	// End method that finalizes the stream
	async end(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.inner.end((error: Error) => {
				if (error) reject(error);
				else resolve();
			});
		});
	}
}


export class WFWritable<_I = unknown> {
	readonly type = 'Writable';
	inner: Writable;

	constructor(inner: Writable) {
		this.inner = inner;
	}

	// Write method that respects backpressure
	write(content: Buffer): Promise<void> {
		return new Promise(r => {
			if (!this.inner.write(content)) {
				this.inner.once('drain', r);
			} else {
				r();
			}
		})
	}

	// End method that finalizes the stream
	async end(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.inner.end((error: Error) => {
				if (error) reject(error);
				else resolve();
			});
		});
	}
}