import { ReadStream, WriteStream } from 'node:fs';
import { Duplex, Readable, Transform, Writable } from 'node:stream';
import { WFReadable, WFTransform, WFWritable } from '../classes.js';


export type WFReadSource<O = unknown> = Readable | Iterable<O> | AsyncIterable<O> | WFReadable<O>;
export type WFTransformSource<I = unknown, O = I> = Duplex | ((item: I) => O) | ((item: I) => Promise<O>) | WFTransform<I, O>;
export type WFWriteSource<I = unknown> = Writable | ((item: I) => void) | ((item: I) => Promise<void>) | WFWritable<I>;


export function wrap(inner: ReadStream): WFReadable<Buffer>;
export function wrap(inner: WriteStream): WFWritable<Buffer>;
export function wrap<O = unknown>(inner: Readable | Iterable<O> | AsyncIterable<O>): WFReadable<O>;
export function wrap<I = unknown, O = I>(inner: Duplex | ((item: I) => O) | ((item: I) => Promise<O>)): WFTransform<I, O>;
export function wrap<I = unknown>(inner: Writable): WFWritable<I>;
export function wrap<I, O>(
	inner:
		Readable | Iterable<O> | AsyncIterable<O> |
		Duplex | ((item: I) => O) | ((item: I) => Promise<O>) |
		Writable
): WFReadable<O> | WFTransform<I, O> | WFWritable<I> {
	if (inner instanceof Duplex) return wrapTransform(inner);
	if (typeof inner == 'function') return wrapTransform(inner);

	if (inner instanceof Writable) return wrapWrite(inner);

	if (inner instanceof Readable) return wrapRead<O>(inner);
	if (Symbol.asyncIterator in inner) return wrapRead(inner);
	if (Symbol.iterator in inner) return wrapRead(inner);

	throw Error('unknown stream');
}



// ### READ

export function wrapRead(inner: ReadStream): WFReadable<Buffer>;
export function wrapRead<O = unknown>(inner: Readable): WFReadable<O>;
export function wrapRead<O>(inner: Iterable<O> | AsyncIterable<O> | WFReadable<O>): WFReadable<O>;
export function wrapRead<O>(inner: WFReadSource<O>): WFReadable<O>;
export function wrapRead<O>(inner: WFReadSource<O>): WFReadable<O> {
	if (inner instanceof WFReadable) return inner;
	if (inner instanceof Readable) return new WFReadable(inner);
	if (Symbol.asyncIterator in inner) return new WFReadable(Readable.from(inner));
	if (Symbol.iterator in inner) return new WFReadable(Readable.from(inner));

	throw Error('unknown readable');
}



// ### TRANSFORM

export function wrapTransform<I, O>(inner: Duplex): WFTransform<I, O>;
export function wrapTransform<I, O>(inner: ((item: I) => O) | ((item: I) => Promise<O>) | WFTransform<I, O>): WFTransform<I, O>;
export function wrapTransform<I, O>(inner: WFTransformSource<I, O>): WFTransform<I, O>;
export function wrapTransform<I, O>(inner: WFTransformSource<I, O>): WFTransform<I, O> {
	if (inner instanceof WFTransform) return inner;
	if (inner instanceof Duplex) return new WFTransform(inner);
	if (typeof inner == 'function') return new WFTransform(new Transform({
		objectMode: true,
		async transform(chunk, _encoding, callback) {
			let result;
			try {
				result = await inner(chunk);
			} catch (error) {
				return callback(error instanceof Error ? error : Error(String(error)));
			}
			callback(null, result);
		}
	}));

	throw Error('unknown transform');
}



// ### WRITE

export function wrapWrite(inner: WriteStream): WFWritable<Buffer>;
export function wrapWrite<I>(inner: Writable): WFWritable<I>;
export function wrapWrite<I>(inner: ((item: I) => void) | ((item: I) => Promise<void>) | WFWritable<I>): WFWritable<I>;
export function wrapWrite<I>(inner: WFWriteSource<I>): WFWritable<I>;
export function wrapWrite<I>(inner: WFWriteSource<I>): WFWritable<I> {
	if (inner instanceof WFWritable) return inner;
	if (inner instanceof Writable) return new WFWritable(inner);
	if (typeof inner == 'function') return new WFWritable(new Writable({
		objectMode: true,
		async write(chunk, _encoding, callback) {
			try {
				await inner(chunk);
			} catch (error) {
				return callback(error instanceof Error ? error : Error(String(error)));
			}
			callback(null);
		}
	}));

	throw Error('unknown writable');
}
