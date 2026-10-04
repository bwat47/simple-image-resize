// Flat config (ESM). Adds ignores, Node + Vitest globals, and TS-friendly rule tweaks.

import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import sonarjs from 'eslint-plugin-sonarjs';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import vitest from '@vitest/eslint-plugin';

export default defineConfig([
    {
        ignores: ['api/**', 'dist/**', 'webpack.config.js', '.prettierrc.js'],
    },

    js.configs.recommended,
    sonarjs.configs.recommended,

    // Project TS/JS sources
    {
        files: ['**/*.{ts,tsx,js}'],
        // Parser, plugin, and eslint-recommended overrides (disables core rules TypeScript handles).
        extends: [tseslint.configs.recommendedTypeChecked],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
            ecmaVersion: 2020,
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
        plugins: {
            import: importPlugin,
        },
        settings: {
            // Without these, import-x silently skips TS imports and rules like no-cycle never fire.
            // Resolve imports the way tsc does (.ts extensions, tsconfig paths)...
            'import-x/resolver-next': [createTypeScriptImportResolver({ project: './tsconfig.json' })],
            // ...and parse resolved .ts files when following the import graph.
            'import-x/extensions': ['.ts', '.tsx', '.js'],
            'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx'] },
        },
        rules: {
            // report an error if any circular dependency is found
            'import/no-cycle': ['error', { maxDepth: Infinity }],
            'no-useless-escape': 'off',
            'sonarjs/todo-tag': 'off',
            '@typescript-eslint/no-inferrable-types': 'error',
            '@typescript-eslint/explicit-module-boundary-types': 'error',
        },
    },

    // Viewer content scripts run in the browser, with Joplin's injected webviewApi
    {
        files: ['src/contentScripts/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.browser,
                webviewApi: 'readonly',
            },
        },
    },

    // Test + test support
    {
        files: [
            '**/*.test.{ts,tsx,js}',
            '**/*.spec.{ts,tsx,js}',
            '**/__tests__/**/*.{ts,tsx,js}',
            'tests/**/*.{ts,tsx,js}',
            'src/testHelpers.ts',
        ],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.vitest,
            },
        },
        plugins: {
            vitest,
        },
        rules: {
            ...vitest.configs.recommended.rules,
            // Vitest-aware variant allows expect(mock.method) and vi.mocked(mock.method).
            '@typescript-eslint/unbound-method': 'off',
            'vitest/unbound-method': 'error',
        },
    },

    // Prettier compatibility
    prettier,
]);
