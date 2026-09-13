import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', 'coverage/**', 'docs/**'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // The `_` prefix marks a deliberately unused parameter: the case of
      // every skeleton that keeps its final signature.
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-console': 'off',
    },
  },
  {
    files: ['packages/*/test/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
