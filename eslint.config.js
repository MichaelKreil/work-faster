import js from '@eslint/js';
import ts from 'typescript-eslint';
import parser from '@typescript-eslint/parser';
import eslint_plugin from '@typescript-eslint/eslint-plugin';

export default [
	js.configs.recommended,
	...ts.configs.recommended,
	{
		ignores: ['coverage/**/*.*', 'dist/**/*.*'],
	},
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			parser,
			// No `project` here on purpose. Type-aware parsing roughly doubles lint
			// time, and none of the enabled rules consult type information -
			// typescript-eslint's recommended set is entirely syntactic, and
			// `no-undef` is off because tsc already reports unknown identifiers.
			// Add `project: './tsconfig.json'` back alongside
			// `ts.configs.recommendedTypeChecked` if typed rules are ever wanted.
			parserOptions: {
				sourceType: 'module',
			},
		},
		plugins: {
			'@typescript-eslint': eslint_plugin,
		},
		linterOptions: {
			reportUnusedDisableDirectives: true,
		},
		rules: {
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
				},
			],
		},
	},
];
