import { Transform, pipeline } from 'node:stream';
import { WFReadable, WFTransform, WFWritable } from './types.js';

// Overloads for `merge`
export function merge<B, C>(a: WFReadable<B>, b: WFTransform<B, C>): WFReadable<C>;
export function merge<A, B>(a: WFTransform<A, B>, b: WFWritable<B>): WFWritable<A>;
export function merge<A, B, C>(a: WFTransform<A, B>, b: WFTransform<B, C>): WFTransform<A, C>;

export function merge<A, B, C>(
	a: WFReadable<B> | WFTransform<A, B>,
	b: WFTransform<B, C> | WFWritable<B>
): WFReadable<C> | WFWritable<A> | WFTransform<A, C> {
	// Case 1: Merging a WFReadable with a WFTransform to produce a WFReadable
	if (a instanceof WFReadable && b instanceof WFTransform) {
		return new WFReadable<C>(a.inner.pipe(b.inner));
	}

	// Case 2: Merging a WFTransform with a WFWritable to produce a WFWritable
	if (a instanceof WFTransform && b instanceof WFWritable) {
		a.inner.pipe(b.inner);
		return new WFWritable<A>(a.inner);
	}

	// Case 3: Merging two WFTransforms to produce a WFTransform
	if (a instanceof WFTransform && b instanceof WFTransform) {
		const transformA = a.inner;
		const transformB = b.inner;

		const combined = new Transform({
			objectMode: true,
			transform(chunk, encoding, callback) {
				if (!transformA.write(chunk, encoding)) {
					transformA.once('drain', () => callback());
				} else {
					callback();
				}
			}
		});

		// Pipe transformA into transformB, and handle errors
		pipeline(transformA, transformB, (err) => {
			if (err) {
				combined.destroy(err);
			} else {
				combined.end();
			}
		});

		// Pipe output of transformB to the combined stream
		transformB.on('data', (chunk) => combined.push(chunk));
		transformB.on('end', () => combined.push(null));

		// Handle errors on both streams
		transformA.on('error', (err) => combined.destroy(err));
		transformB.on('error', (err) => combined.destroy(err));

		return new WFTransform<A, C>(combined);
	}

	throw new Error('Invalid combination of streams for merge.');
}
