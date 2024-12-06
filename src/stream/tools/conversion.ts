import { WFReadable, WFTransform } from '../classes.js';
import { wrapTransform } from './wrapper.js';

export function asBuffer(source: WFReadable<Buffer | string>): WFReadable<Buffer>;
export function asBuffer<I>(source: WFTransform<I, Buffer | string>): WFTransform<I, Buffer>;

export function asBuffer<I = unknown>(
	source: WFReadable<Buffer | string> | WFTransform<I, Buffer | string>
): WFReadable<Buffer> | WFTransform<I, Buffer> {
	return source.merge(wrapTransform((c: Buffer | string) => Buffer.isBuffer(c) ? c : Buffer.from(c)));
}
