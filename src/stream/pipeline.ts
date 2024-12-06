import { WFReadable, WFTransform } from './classes.js';
import type { WFReadSource as R, WFTransformSource as T, WFWriteSource as W } from './wrapper.js';
import { wrapRead, wrapTransform, wrapWrite } from './wrapper.js';

export function pipeline<A>(r: R<A>, w: W<A>): Promise<void>;
export function pipeline<A, B>(r: R<A>, t: T<A, B>, w: W<B>): Promise<void>;
export function pipeline<A, B, C>(r: R<A>, t1: T<A, B>, t2: T<B, C>, w: W<C>): Promise<void>;
export function pipeline<A, B, C, D>(r: R<A>, t1: T<A, B>, t2: T<B, C>, t3: T<C, D>, w: W<D>): Promise<void>;
export function pipeline<A, B, C, D, E>(r: R<A>, t1: T<A, B>, t2: T<B, C>, t3: T<C, D>, t4: T<D, E>, w: W<E>): Promise<void>;
export function pipeline<A, B, C, D, E, F>(r: R<A>, t1: T<A, B>, t2: T<B, C>, t3: T<C, D>, t4: T<D, E>, t5: T<E, F>, w: W<F>): Promise<void>;
export function pipeline<A, B, C, D, E, F, G>(r: R<A>, t1: T<A, B>, t2: T<B, C>, t3: T<C, D>, t4: T<D, E>, t5: T<E, F>, t6: T<F, G>, w: W<G>): Promise<void>;
export function pipeline<A, B, C, D, E, F, G, H>(r: R<A>, t1: T<A, B>, t2: T<B, C>, t3: T<C, D>, t4: T<D, E>, t5: T<E, F>, t6: T<F, G>, t7: T<G, H>, w: W<H>): Promise<void>;
export function pipeline<A, B, C, D, E, F, G, H, I>(r: R<A>, t1: T<A, B>, t2: T<B, C>, t3: T<C, D>, t4: T<D, E>, t5: T<E, F>, t6: T<F, G>, t7: T<G, H>, t8: T<H, I>, w: W<I>): Promise<void>;
export function pipeline(r: R, ...w: (T | W)[]): Promise<void>;

export function pipeline(r: R, ...w: (T | W)[]): Promise<void> {
	let stream: WFReadable | WFTransform = wrapRead(r);
	const write = wrapWrite(w.pop() as W);

	for (const transform of w) {
		stream = stream.pipe(wrapTransform(transform as T));
	}

	stream.pipe(write);

	return new Promise((resolve, reject) => {
		write.inner.on('finish', resolve);
		write.inner.on('error', reject);
	});
}
