import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		include: ['**/src/**/*.test.ts'],
		exclude: ['**/node_modules/**'],
		coverage: {
			include: ['src/**/*.ts'],
			exclude: ['**/*.test.ts', '**/index.ts', '**/types.ts'],
			thresholds: {
				lines: 90,
				branches: 85,
				functions: 90,
				statements: 90,
			},
		},
	},
});
