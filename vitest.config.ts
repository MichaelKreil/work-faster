import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		include: ['**/src/**/*.test.ts'],
		exclude: ['**/src/**/*.mock.test.ts', '**/node_modules/**'],
		coverage: {
			include: ['src/**/*.ts'],
			exclude: ['**/*.test.ts', '**/index.ts', '**/types.ts'],
		},
	},
});
