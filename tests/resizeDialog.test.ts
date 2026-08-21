// @vitest-environment jsdom

import initializeResizeDialog from '../src/dialog/resizeDialog';
import { renderDialogHtml, type ResizeDialogDefaults } from '../src/dialogHandler';
import { logger } from '../src/logger';
import type { ImageContext, ResizeMode } from '../src/types';

/**
 * Builds the same markup the plugin host writes, so these tests break if the
 * dialog HTML and the webview's element hooks ever drift apart.
 */
function dialogMarkup(width: number, height: number, defaults: ResizeDialogDefaults): string {
    const context: ImageContext = {
        type: 'markdown',
        syntax: `![Alt](https://example.com/image.png)`,
        source: 'https://example.com/image.png',
        sourceType: 'external',
        altText: 'Alt',
        originalDimensions: { width, height },
        originalDimensionsDetermined: true,
    };
    return renderDialogHtml(context, defaults);
}

function defaultsFor(defaultResizeMode: ResizeMode, defaultPercentage = 50): ResizeDialogDefaults {
    return { defaultResizeMode, defaultPercentage };
}

function setInputValue(name: string, value: string): void {
    const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (!input) throw new Error(`Missing ${name} input.`);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('resize dialog webview', () => {
    afterEach(() => {
        document.body.replaceChildren();
    });

    it('initializes each root only once', () => {
        document.body.innerHTML = dialogMarkup(400, 300, defaultsFor('absolute'));
        const addListener = vi.spyOn(EventTarget.prototype, 'addEventListener');

        initializeResizeDialog();
        const listenerCount = addListener.mock.calls.length;
        initializeResizeDialog();

        expect(listenerCount).toBeGreaterThan(0);
        expect(document.querySelector('#dialog-root')?.getAttribute('data-initialized')).toBe('true');
        expect(addListener).toHaveBeenCalledTimes(listenerCount);
        addListener.mockRestore();
    });

    it('initializes replacement HTML with its new dimensions', () => {
        // Mirrors a second open: Joplin remounts the webview with fresh markup and
        // re-runs this script against it.
        document.body.innerHTML = dialogMarkup(800, 400, defaultsFor('absolute'));
        initializeResizeDialog();

        setInputValue('absoluteWidth', '200');
        expect(document.querySelector<HTMLInputElement>('input[name="absoluteHeight"]')?.value).toBe('100');

        document.body.innerHTML = dialogMarkup(400, 300, defaultsFor('absolute'));
        initializeResizeDialog();
        expect(document.querySelector('#dialog-root')?.getAttribute('data-initialized')).toBe('true');

        setInputValue('absoluteWidth', '200');
        expect(document.querySelector<HTMLInputElement>('input[name="absoluteHeight"]')?.value).toBe('150');
    });

    it('gives up on a malformed config instead of reporting it twice', () => {
        const logError = vi.spyOn(logger, 'error').mockImplementation(() => {});
        document.body.innerHTML = `<div id="dialog-root" data-config="{oops"><form name="resizeForm"></form></div>`;

        expect(() => initializeResizeDialog()).not.toThrow();
        expect(document.querySelector('#dialog-root')?.getAttribute('data-initialized')).toBe('true');

        // Re-entering must not report the same failure twice.
        initializeResizeDialog();
        expect(logError).toHaveBeenCalledOnce();

        logError.mockRestore();
    });

    it('retains mode switching and percentage previews', () => {
        document.body.innerHTML = dialogMarkup(800, 400, defaultsFor('percentage', 25));
        initializeResizeDialog();

        expect(document.querySelector<HTMLInputElement>('input[name="absoluteWidth"]')?.value).toBe('200');
        expect(document.querySelector<HTMLInputElement>('input[name="absoluteHeight"]')?.value).toBe('100');

        const absoluteMode = document.querySelector<HTMLInputElement>('input[name="resizeMode"][value="absolute"]');
        if (!absoluteMode) throw new Error('Missing absolute resize mode.');
        absoluteMode.checked = true;
        absoluteMode.dispatchEvent(new Event('change', { bubbles: true }));

        expect(document.querySelector<HTMLInputElement>('input[name="absoluteWidth"]')?.disabled).toBe(false);
        expect(document.querySelector<HTMLInputElement>('input[name="absoluteHeight"]')?.disabled).toBe(false);
    });
});
