// @vitest-environment jsdom

import type { DialogResult } from 'api/types';
import initializeResizeDialog from '../src/dialog/resizeDialog';
import { ResizeDialog, type DialogPlatform, type ResizeDialogDefaults } from '../src/host/resizeDialogHost';
import { desktopDialogCss } from '../src/host/resizeDialogStyles';
import type { ImageContext } from '../src/shared/types';
import { createDialogApi, serializeForm } from './helpers/resizeDialogHarness';

const dialogContext: ImageContext = {
    type: 'markdown',
    syntax: '![Alt](https://example.com/image.png)',
    source: 'https://example.com/image.png',
    sourceType: 'external',
    altText: 'Alt',
    title: '',
    originalDimensions: { width: 400, height: 300 },
    originalDimensionsDetermined: true,
};

const dialogDefaults: ResizeDialogDefaults = {
    defaultResizeMode: 'percentage',
    defaultPercentage: 50,
};

function field(form: HTMLFormElement, name: string): HTMLInputElement {
    const element = form.elements.namedItem(name);
    if (!(element instanceof HTMLInputElement)) {
        throw new Error(`Missing input "${name}"`);
    }
    return element;
}

async function openDialog(
    options: {
        context?: Partial<ImageContext>;
        defaults?: Partial<ResizeDialogDefaults>;
        platform?: DialogPlatform;
        onOpen?: (form: HTMLFormElement) => DialogResult | null | Promise<DialogResult | null>;
    } = {}
) {
    const dialogs = createDialogApi(options.onOpen ?? ((form) => ({ id: 'ok', formData: serializeForm(form) })));
    const dialog = new ResizeDialog(dialogs, options.platform ?? 'desktop');
    const result = await dialog.open(
        { ...dialogContext, ...options.context },
        { ...dialogDefaults, ...options.defaults }
    );
    return { result, form: document.querySelector('form')!, dialogs };
}

afterEach(() => {
    document.body.replaceChildren();
});

describe('ResizeDialog', () => {
    describe('rendered markup and initial state', () => {
        it('renders HTML syntax with percentage mode enabled by default', async () => {
            const { form } = await openDialog({ defaults: { defaultResizeMode: 'percentage' } });

            expect(form.querySelector<HTMLInputElement>('input[name="targetSyntax"][value="html"]')?.checked).toBe(
                true
            );
            expect(form.querySelector<HTMLInputElement>('input[name="targetSyntax"][value="markdown"]')?.checked).toBe(
                false
            );
            expect(form.querySelector('[data-resize-section]')?.hasAttribute('inert')).toBe(false);
            expect(form.querySelector('[data-resize-section]')?.classList).not.toContain('is-locked');

            expect(form.querySelector<HTMLInputElement>('input[name="resizeMode"][value="percentage"]')?.checked).toBe(
                true
            );
            expect(form.querySelector<HTMLInputElement>('input[name="resizeMode"][value="percentage"]')?.disabled).toBe(
                false
            );
            expect(form.querySelector<HTMLInputElement>('input[name="resizeMode"][value="absolute"]')?.checked).toBe(
                false
            );
            expect(field(form, 'percentage').disabled).toBe(false);
            expect(field(form, 'absoluteWidth').disabled).toBe(true);
            expect(field(form, 'absoluteHeight').disabled).toBe(true);
            expect(form.querySelector('[data-percentage-row]')?.classList).not.toContain('is-disabled');
            expect(form.querySelector('[data-absolute-group]')?.classList).toContain('is-disabled');
            expect(document.querySelector('.original-size')?.textContent).toBe('400 × 300 px');
        });

        it('renders HTML syntax with absolute mode enabled when configured as default', async () => {
            const { form } = await openDialog({ defaults: { defaultResizeMode: 'absolute' } });

            expect(form.querySelector<HTMLInputElement>('input[name="resizeMode"][value="absolute"]')?.checked).toBe(
                true
            );
            expect(field(form, 'percentage').disabled).toBe(true);
            expect(field(form, 'absoluteWidth').disabled).toBe(false);
            expect(field(form, 'absoluteHeight').disabled).toBe(false);
            expect(form.querySelector('[data-percentage-row]')?.classList).toContain('is-disabled');
            expect(form.querySelector('[data-absolute-group]')?.classList).not.toContain('is-disabled');
            expect(form.querySelector('[data-height-row]')?.classList).not.toContain('is-disabled');
        });

        it('disables percentage mode, dims height, and shows Size unknown when dimensions are unknown', async () => {
            const { form } = await openDialog({
                context: { originalDimensionsDetermined: false },
                defaults: { defaultResizeMode: 'percentage' },
            });

            expect(document.querySelector('.original-size')?.textContent).toBe('Size unknown');
            expect(form.querySelector('[data-percentage-mode-row]')?.classList).toContain('is-disabled');
            expect(form.querySelector<HTMLInputElement>('input[name="resizeMode"][value="percentage"]')?.disabled).toBe(
                true
            );
            expect(form.querySelector<HTMLInputElement>('input[name="resizeMode"][value="absolute"]')?.checked).toBe(
                true
            );
            expect(field(form, 'percentage').disabled).toBe(true);
            expect(field(form, 'absoluteWidth').disabled).toBe(false);
            expect(field(form, 'absoluteHeight').disabled).toBe(true);
            expect(form.querySelector('[data-height-row]')?.classList).toContain('is-disabled');
            expect(field(form, 'absoluteHeight').hasAttribute('placeholder')).toBe(false);
        });

        it('shows the title field only when the image has a title', async () => {
            const withoutTitle = await openDialog();
            expect(withoutTitle.form.elements.namedItem('imageTitle')).toBeNull();

            const withTitle = await openDialog({ context: { title: 'Say "hi"' } });
            const titleInput = field(withTitle.form, 'imageTitle');
            expect(titleInput.value).toBe('Say "hi"');
            expect(
                field(withTitle.form, 'altText').compareDocumentPosition(titleInput) & Node.DOCUMENT_POSITION_FOLLOWING
            ).not.toBe(0);
        });

        it('renders line breaks in alt text and title as spaces', async () => {
            const { form } = await openDialog({
                context: { altText: 'a\r\nb', title: 'c\nd\re' },
            });

            expect(field(form, 'altText').value).toBe('a b');
            expect(field(form, 'imageTitle').value).toBe('c d e');
        });

        it('fixes the dialog width on desktop only', async () => {
            await openDialog({ platform: 'desktop' });
            expect(document.querySelector('style')?.textContent).toContain(desktopDialogCss);

            await openDialog({ platform: 'mobile' });
            expect(document.querySelector('style')?.textContent).not.toContain(desktopDialogCss);
        });
    });

    describe('lifecycle and form submission', () => {
        it('reuses one configured handle while rendering fresh content', async () => {
            const dialogs = createDialogApi();
            const dialog = new ResizeDialog(dialogs, 'desktop');

            await dialog.open(dialogContext, dialogDefaults);
            await dialog.open({ ...dialogContext, altText: 'Second image' }, dialogDefaults);

            expect(dialogs.create).toHaveBeenCalledExactlyOnceWith('image-resize-dialog');
            expect(dialogs.setFitToContent).toHaveBeenCalledOnce();
            expect(dialogs.addScript).toHaveBeenCalledExactlyOnceWith('handle', './dialog/resizeDialog.js');
            expect(dialogs.setButtons).toHaveBeenCalledOnce();
            expect(dialogs.setHtml).toHaveBeenCalledTimes(2);
            expect(field(document.querySelector('form')!, 'altText').value).toBe('Second image');
            expect(dialogs.open).toHaveBeenCalledTimes(2);
        });

        it('silently ignores an overlapping open', async () => {
            const pending: { close?: (result: DialogResult | null) => void } = {};
            const dialogs = createDialogApi(
                () =>
                    new Promise((resolve) => {
                        pending.close = resolve;
                    })
            );
            const dialog = new ResizeDialog(dialogs, 'desktop');

            const first = dialog.open(dialogContext, dialogDefaults);
            await vi.waitFor(() => expect(dialogs.open).toHaveBeenCalledOnce());

            await expect(dialog.open(dialogContext, dialogDefaults)).resolves.toBeNull();
            expect(dialogs.open).toHaveBeenCalledOnce();

            pending.close?.({ id: 'cancel' });
            await first;
        });

        it('returns null for cancellation and an unexpected null result', async () => {
            const dialogs = createDialogApi();
            const dialog = new ResizeDialog(dialogs, 'desktop');

            await expect(dialog.open(dialogContext, dialogDefaults)).resolves.toBeNull();
            dialogs.open.mockResolvedValueOnce(null);
            await expect(dialog.open(dialogContext, dialogDefaults)).resolves.toBeNull();
        });

        it('reconfigures the existing handle after configuration fails', async () => {
            const dialogs = createDialogApi();
            dialogs.setButtons.mockRejectedValueOnce(new Error('buttons failed'));
            const dialog = new ResizeDialog(dialogs, 'desktop');

            await expect(dialog.open(dialogContext, dialogDefaults)).rejects.toThrow('buttons failed');
            await expect(dialog.open(dialogContext, dialogDefaults)).resolves.toBeNull();

            // Joplin throws when the same dialog id is created twice, so the retry has to
            // reuse the handle from the first attempt.
            expect(dialogs.create).toHaveBeenCalledOnce();
            expect(dialogs.setButtons).toHaveBeenCalledTimes(2);
            expect(dialogs.open).toHaveBeenCalledOnce();
        });

        it('does not create a second view after creation fails', async () => {
            const dialogs = createDialogApi();
            dialogs.create.mockRejectedValue(new Error('view creation failed'));
            const dialog = new ResizeDialog(dialogs, 'desktop');

            await expect(dialog.open(dialogContext, dialogDefaults)).rejects.toThrow('view creation failed');
            await expect(dialog.open(dialogContext, dialogDefaults)).rejects.toThrow('view creation failed');

            expect(dialogs.create).toHaveBeenCalledOnce();
            expect(dialogs.open).not.toHaveBeenCalled();
        });

        it('releases the open guard after an open failure', async () => {
            const dialogs = createDialogApi();
            dialogs.open.mockRejectedValueOnce(new Error('dialog failed'));
            const dialog = new ResizeDialog(dialogs, 'desktop');

            await expect(dialog.open(dialogContext, dialogDefaults)).rejects.toThrow('dialog failed');
            await expect(dialog.open(dialogContext, dialogDefaults)).resolves.toBeNull();

            expect(dialogs.create).toHaveBeenCalledOnce();
            expect(dialogs.open).toHaveBeenCalledTimes(2);
        });

        it('round-trips submitted form data from the rendered dialog', async () => {
            const { result } = await openDialog({
                context: { title: 'Initial title' },
                defaults: { defaultResizeMode: 'absolute' },
                onOpen: (form) => {
                    initializeResizeDialog();
                    field(form, 'altText').value = 'Updated alt';
                    field(form, 'imageTitle').value = 'Updated title';
                    field(form, 'absoluteWidth').value = '300';
                    field(form, 'absoluteWidth').dispatchEvent(new Event('input', { bubbles: true }));
                    return { id: 'ok', formData: serializeForm(form) };
                },
            });

            expect(result).toEqual({
                targetSyntax: 'html',
                altText: 'Updated alt',
                title: 'Updated title',
                resizeMode: 'absolute',
                percentage: undefined,
                absoluteWidth: 300,
                absoluteHeight: 225,
            });
        });

        it.each(['invalid form data', {}, { resizeForm: null }, { resizeForm: 'invalid form' }])(
            'ignores malformed form data %j',
            async (formData) => {
                const { result } = await openDialog({ onOpen: () => ({ id: 'ok', formData }) });

                expect(result).toBeNull();
            }
        );

        it('falls back for malformed form field types', async () => {
            const { result } = await openDialog({
                onOpen: () => ({
                    id: 'ok',
                    formData: {
                        resizeForm: {
                            targetSyntax: 'invalid',
                            altText: 123,
                            imageTitle: 456,
                            resizeMode: 'invalid',
                            percentage: {},
                            absoluteWidth: 300,
                            absoluteHeight: [],
                        },
                    },
                }),
            });

            expect(result).toEqual({
                targetSyntax: 'html',
                altText: '',
                title: '',
                resizeMode: dialogDefaults.defaultResizeMode,
                percentage: undefined,
                absoluteWidth: undefined,
                absoluteHeight: undefined,
            });
        });
    });
});
