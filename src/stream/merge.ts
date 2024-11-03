import { Duplex, type Readable, type Writable } from 'node:stream';
import { WFReadable, WFTransform, WFWritable } from './types.js';

// Overloads for `merge`
export function merge<B, C>(a: WFReadable<B>, b: WFTransform<B, C>): WFReadable<C>;
export function merge<A, B>(a: WFTransform<A, B>, b: WFWritable<B>): WFWritable<A>;
export function merge<A, B, C>(a: WFTransform<A, B>, b: WFTransform<B, C>): WFTransform<A, C>;
export function merge<A, B, C>(a: WFTransform<A, B>, b: WFTransform<B, C> | WFWritable<B>): WFWritable<A> | WFTransform<A, C>;
export function merge<A, B, C>(a: WFReadable<B> | WFTransform<A, B>, b: WFTransform<B, C> | WFWritable<B>): WFReadable<C> | WFWritable<A> | WFTransform<A, C>;

// Main function implementation
export function merge<A, B, C>(
	a: WFReadable<B> | WFTransform<A, B>,
	b: WFTransform<B, C> | WFWritable<B>
): WFReadable<C> | WFWritable<A> | WFTransform<A, C> {
	// Case 1: Merging a WFReadable with a WFTransform to produce a WFReadable
	if (a instanceof WFReadable && b instanceof WFTransform) {
		return new WFReadable(a.inner.pipe(b.inner));
	}

	// Case 2: Merging a WFTransform with a WFWritable to produce a WFWritable
	if (a instanceof WFTransform && b instanceof WFWritable) {
		a.inner.pipe(b.inner);
		return new WFWritable(a.inner);
	}

	// Case 3: Merging two WFTransforms to produce a WFTransform
	if (a instanceof WFTransform && b instanceof WFTransform) {
		a.inner.pipe(b.inner);
		return new WFTransform(new DuplexWrapper(a.inner, b.inner));
	}

	throw new Error('Invalid combination of streams for merge.');
}



class DuplexWrapper extends Duplex {
	private _writable: Writable;
	private _readable: Readable;
	private _waiting: boolean;

	constructor(
		writable: Writable,
		readable: Readable
	) {
		super({
			writableObjectMode: writable.writableObjectMode,
			readableObjectMode: readable.readableObjectMode,
		});
		this._writable = writable;
		this._readable = readable;
		this._waiting = false;
		this._setupEventListeners();
	}

	private _setupEventListeners() {
		this._writable.once('finish', () => this.end());
		this.once('finish', () => this._writable.end());
		this._readable.on('readable', () => {
			if (this._waiting) {
				this._waiting = false;
				this._read();
			}
		});
		this._readable.once('end', () => this.push(null));
		this._writable.on('error', (err) => this.emit('error', err));
		this._readable.on('error', (err) => this.emit('error', err));
	}

	_write(input: unknown, encoding: BufferEncoding, done: (error?: Error | null) => void) {
		this._writable.write(input, encoding, done);
	}

	_read() {
		let buf, reads = 0;
		while ((buf = this._readable.read()) !== null) {
			this.push(buf);
			reads++;
		}
		if (reads === 0) this._waiting = true;
	}
}
