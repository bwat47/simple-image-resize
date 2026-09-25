import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const resolvePath = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['tests/**/*.{test,spec}.ts'],
        coverage: {
            provider: 'v8',
            reportsDirectory: 'coverage',
            include: ['src/**/*.{ts,tsx}'],
            exclude: ['src/manifest.json', 'src/index.ts'],
        },
    },
    resolve: {
        alias: [
            { find: /^api\/types$/, replacement: resolvePath('./tests/__mocks__/api/types.ts') },
            { find: /^api$/, replacement: resolvePath('./tests/__mocks__/api.ts') },
        ],
    },
});
