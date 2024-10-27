
export { forEachAsync } from './lib/for_each_async.js';
export { ProgressBar } from './lib/progress_bar.js';
export { streamFileData } from './lib/stream_file_data.js';

import { getSplitter } from './lib/split.js';
export const stream = {
	split: getSplitter,
}
