import { WFReadable, WFTransform } from '../classes.js';
import type { WFReadSource as R, WFTransformSource as T, WFWriteSource as W } from './wrapper.js';
import { wrapRead, wrapTransform, wrapWrite } from './wrapper.js';

export function pipeline<A>(r: R<A>, w: W<A>): Promise<void>;
export function pipeline<A, B>(r: R<A>, t: T<A, B>, w: W<B>): Promise<void>;
export function pipeline<A, B, C>(r: R<A>, t1: T<A, B>, t2: T<B, C>, w: W<C>): Promise<void>;
export function pipeline<A, B, C, D>(r: R<A>, t1: T<A, B>, t2: T<B, C>, t3: T<C, D>, w: W<D>): Promise<void>;
export function pipeline<A, B, C, D, E>(
	r: R<A>,
	t1: T<A, B>,
	t2: T<B, C>,
	t3: T<C, D>,
	t4: T<D, E>,
	w: W<E>,
): Promise<void>;
export function pipeline<A, B, C, D, E, F>(
	r: R<A>,
	t1: T<A, B>,
	t2: T<B, C>,
	t3: T<C, D>,
	t4: T<D, E>,
	t5: T<E, F>,
	w: W<F>,
): Promise<void>;
export function pipeline<A, B, C, D, E, F, G>(
	r: R<A>,
	t1: T<A, B>,
	t2: T<B, C>,
	t3: T<C, D>,
	t4: T<D, E>,
	t5: T<E, F>,
	t6: T<F, G>,
	w: W<G>,
): Promise<void>;
export function pipeline<A, B, C, D, E, F, G, H>(
	r: R<A>,
	t1: T<A, B>,
	t2: T<B, C>,
	t3: T<C, D>,
	t4: T<D, E>,
	t5: T<E, F>,
	t6: T<F, G>,
	t7: T<G, H>,
	w: W<H>,
): Promise<void>;
export function pipeline<A, B, C, D, E, F, G, H, I>(
	r: R<A>,
	t1: T<A, B>,
	t2: T<B, C>,
	t3: T<C, D>,
	t4: T<D, E>,
	t5: T<E, F>,
	t6: T<F, G>,
	t7: T<G, H>,
	t8: T<H, I>,
	w: W<I>,
): Promise<void>;
export function pipeline(r: R, ...w: (T | W)[]): Promise<void>;

export function pipeline(r: R, ...w: (T | W)[]): Promise<void> {
	const read = wrapRead(r);
	const write = wrapWrite(w.pop() as W);
	const transforms = w.map((t) => wrapTransform(t as T));

	let stream: WFReadable | WFTransform = read;
	for (const transform of transforms) {
		stream = stream.pipe(transform);
	}
	stream.pipe(write);

	const allStages = [read.inner, ...transforms.map((t) => t.inner), write.inner];

	return new Promise((resolve, reject) => {
		let settled = false;
		const teardown = (err?: Error) => {
			// Destroy every stage that's still alive so a failure does not
			// leak file handles, child processes, or HTTP connections that
			// the surviving stages were holding.
			for (const stage of allStages) {
				if (!stage.destroyed) stage.destroy(err);
			}
		};
		const fail = (err: Error) => {
			if (settled) return;
			settled = true;
			teardown(err);
			reject(err);
		};
		const done = () => {
			if (settled) return;
			settled = true;
			resolve();
		};

		// Attach an error listener to every stage so a failure mid-pipeline
		// rejects instead of hanging on the writable's never-fired 'finish'.
		for (const stage of allStages) stage.on('error', fail);
		write.inner.on('finish', done);
	});
}
