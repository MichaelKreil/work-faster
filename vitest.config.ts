import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		include: ['**/src/**/*.test.ts'],
		exclude: ['**/src/**/*.mock.test.ts', '**/node_modules/**'],
		coverage: {
			exclude: ['**/dist/**', '**/*.mock.test.ts', '**/node_modules/**'],
		},
	},
});
