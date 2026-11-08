import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import {
    contentScriptExternals,
    createBuildOptions,
    createContentScriptBuildOptions,
    createWebviewScriptBuildOptions,
} from '@bwat47/joplin-plugin-scripts';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));

/** Builds `options` in memory and returns the bundle text and its runtime imports. */
async function bundle(options) {
    const result = await build({ ...options, write: false, metafile: true, logLevel: 'silent' });
    const imports = Object.values(result.metafile.outputs).flatMap((output) => output.imports);
    return { text: result.outputFiles[0].text, imports };
}

test('the resize dialog script loads as a plain script without module, exports, or require', async () => {
    const { text, imports } = await bundle(createWebviewScriptBuildOptions(root, 'dialog/resizeDialog.ts'));
    assert.deepEqual(imports, []);
    // A dialog <script> has globals only. Without `document`, the script skips initialization,
    // so this checks that loading the bundle itself needs no CommonJS bindings.
    // eslint-disable-next-line sonarjs/code-eval -- Executes only the bundle built from this repository.
    assert.doesNotThrow(() => runInNewContext(text, { console }));
});

test('content scripts export a factory and only require host editor libraries', async () => {
    for (const script of ['editor/cursorContentScript.ts', 'viewer/viewerContentScript.ts']) {
        const { text, imports } = await bundle(createContentScriptBuildOptions(root, script));
        assert.ok(
            imports.every((item) => item.external && contentScriptExternals.includes(item.path)),
            script
        );
        const module = { exports: {} };
        // eslint-disable-next-line sonarjs/code-eval -- Executes only the bundle built from this repository, with a controlled host stub.
        runInNewContext(text, { module, exports: module.exports, require: () => ({}) });
        assert.equal(typeof module.exports.default, 'function', script);
    }
});

test('the production bundle registers with Joplin without requiring any module', async () => {
    const { text } = await bundle(createBuildOptions(root));
    let registered = false;
    // eslint-disable-next-line sonarjs/code-eval -- Executes only the bundle built from this repository, with a controlled host stub.
    runInNewContext(text, {
        joplin: {
            plugins: {
                register: (plugin) => {
                    registered = typeof plugin.onStart === 'function';
                },
            },
        },
        console,
        setTimeout,
        clearTimeout,
        require: (name) => {
            throw new Error(`Unexpected runtime dependency: ${name}`);
        },
    });
    assert.equal(registered, true);
});
