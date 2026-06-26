import js from '@eslint/js';
import sveltePlugin from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteParser from 'svelte-eslint-parser';
import tseslint from 'typescript-eslint';

export default [
  // -----------------------------------------------------------------------
  // Base: ignore patterns
  // -----------------------------------------------------------------------
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'cypress-plugin-api-main/**',
      'docs/**',
      '.atl/**',
      '.vscode/**',
      'openspec/**',
      'coverage/**',
      'package-lock.json',
    ],
  },
  // -----------------------------------------------------------------------
  // Recommended rulesets
  // -----------------------------------------------------------------------
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...sveltePlugin.configs.recommended,
  // -----------------------------------------------------------------------
  // Global language options for all files
  // -----------------------------------------------------------------------
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  // -----------------------------------------------------------------------
  // TypeScript source files
  // -----------------------------------------------------------------------
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'no-debugger': 'error',
    },
  },
  // -----------------------------------------------------------------------
  // Config files — no tsconfig project needed
  // -----------------------------------------------------------------------
  {
    files: ['*.config.{ts,js}', 'cypress.config.ts'],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // -----------------------------------------------------------------------
  // Svelte files — override TS parser with Svelte parser
  // -----------------------------------------------------------------------
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
      },
    },
    rules: {
      'svelte/no-at-html-tags': 'warn',
      'svelte/valid-compile': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-undef': 'off',
    },
  },
  // -----------------------------------------------------------------------
  // Cypress E2E test files — relaxed rules
  // -----------------------------------------------------------------------
  {
    files: ['cypress/e2e/**/*.cy.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  // -----------------------------------------------------------------------
  // Cypress support files
  // -----------------------------------------------------------------------
  {
    files: ['cypress/support/**/*.ts'],
    rules: {
      '@typescript-eslint/no-namespace': 'off',
    },
  },
  // -----------------------------------------------------------------------
  // Unit test files — relaxed rules
  // -----------------------------------------------------------------------
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
];
