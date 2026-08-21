import type { DialogResult } from 'api/types';
import {
    getInitialDialogState,
    getOriginalDimensionsSummaryHtml,
    ResizeDialog,
    type JoplinDialogApi,
    type ResizeDialogDefaults,
} from '../src/dialogHandler';
import type { ImageContext } from '../src/types';

describe('getInitialDialogState', () => {
    describe('HTML syntax with percentage mode', () => {
        it('should enable HTML syntax and percentage mode', () => {
            const state = getInitialDialogState('html', 'percentage', true);

            // CSS classes
            expect(state.resizeFieldsetClass).toBe('resize-fieldset');
            expect(state.percentageModeRowClass).toBe('row');
            expect(state.percentageRowClass).toBe('row');
            expect(state.absoluteGroupClass).toBe('stack absolute-size-group is-disabled');
            expect(state.heightRowClass).toBe('row is-disabled');

            // Checked attributes
            expect(state.htmlCheckedAttr).toBe(' checked');
            expect(state.markdownCheckedAttr).toBe('');
            expect(state.percentageModeCheckedAttr).toBe(' checked');
            expect(state.absoluteModeCheckedAttr).toBe('');

            // Disabled attributes
            expect(state.percentageDisabledAttr).toBe('');
            expect(state.percentageModeDisabledAttr).toBe('');
            expect(state.absoluteDisabledAttr).toBe(' disabled');
            expect(state.heightDisabledAttr).toBe(' disabled');
        });
    });

    describe('HTML syntax with absolute mode', () => {
        it('should enable HTML syntax and absolute mode', () => {
            const state = getInitialDialogState('html', 'absolute', true);

            // CSS classes
            expect(state.resizeFieldsetClass).toBe('resize-fieldset');
            expect(state.percentageRowClass).toBe('row is-disabled');
            expect(state.absoluteGroupClass).toBe('stack absolute-size-group');
            expect(state.heightRowClass).toBe('row');

            // Checked attributes
            expect(state.htmlCheckedAttr).toBe(' checked');
            expect(state.markdownCheckedAttr).toBe('');
            expect(state.percentageModeCheckedAttr).toBe('');
            expect(state.absoluteModeCheckedAttr).toBe(' checked');

            // Disabled attributes
            expect(state.percentageDisabledAttr).toBe(' disabled');
            expect(state.absoluteDisabledAttr).toBe('');
            expect(state.heightDisabledAttr).toBe('');
        });
    });

    describe('Markdown syntax with percentage mode', () => {
        it('should enable Markdown syntax and disable all resize controls', () => {
            const state = getInitialDialogState('markdown', 'percentage', true);

            // CSS classes
            expect(state.resizeFieldsetClass).toBe('resize-fieldset is-locked');
            expect(state.percentageRowClass).toBe('row is-disabled');
            expect(state.absoluteGroupClass).toBe('stack absolute-size-group is-disabled');

            // Checked attributes
            expect(state.htmlCheckedAttr).toBe('');
            expect(state.markdownCheckedAttr).toBe(' checked');
            expect(state.percentageModeCheckedAttr).toBe(' checked');
            expect(state.absoluteModeCheckedAttr).toBe('');

            // Disabled attributes
            expect(state.percentageDisabledAttr).toBe(' disabled');
            expect(state.absoluteDisabledAttr).toBe(' disabled');
        });
    });

    describe('Markdown syntax with absolute mode', () => {
        it('should enable Markdown syntax and disable all resize controls', () => {
            const state = getInitialDialogState('markdown', 'absolute', true);

            // CSS classes
            expect(state.resizeFieldsetClass).toBe('resize-fieldset is-locked');
            expect(state.percentageRowClass).toBe('row is-disabled');
            expect(state.absoluteGroupClass).toBe('stack absolute-size-group is-disabled');

            // Checked attributes
            expect(state.htmlCheckedAttr).toBe('');
            expect(state.markdownCheckedAttr).toBe(' checked');
            expect(state.percentageModeCheckedAttr).toBe('');
            expect(state.absoluteModeCheckedAttr).toBe(' checked');

            // Disabled attributes
            expect(state.percentageDisabledAttr).toBe(' disabled');
            expect(state.absoluteDisabledAttr).toBe(' disabled');
        });
    });

    describe('Edge cases and invariants', () => {
        it('disables percentage mode and defaults to absolute when dimensions are unknown', () => {
            const state = getInitialDialogState('html', 'percentage', false);

            expect(state.percentageModeRowClass).toBe('row is-disabled');
            expect(state.percentageModeCheckedAttr).toBe('');
            expect(state.percentageModeDisabledAttr).toBe(' disabled');
            expect(state.percentageRowClass).toBe('row is-disabled');
            expect(state.absoluteModeCheckedAttr).toBe(' checked');
            expect(state.absoluteGroupClass).toBe('stack absolute-size-group');
            expect(state.absoluteDisabledAttr).toBe('');
            expect(state.heightRowClass).toBe('row is-disabled');
            expect(state.heightDisabledAttr).toBe(' disabled');
        });

        it('should ensure only one syntax is checked at a time', () => {
            const htmlState = getInitialDialogState('html', 'percentage', true);
            const markdownState = getInitialDialogState('markdown', 'percentage', true);

            // HTML state
            expect(htmlState.htmlCheckedAttr).toBe(' checked');
            expect(htmlState.markdownCheckedAttr).toBe('');

            // Markdown state
            expect(markdownState.htmlCheckedAttr).toBe('');
            expect(markdownState.markdownCheckedAttr).toBe(' checked');
        });

        it('should ensure only one resize mode is checked at a time', () => {
            const percentageState = getInitialDialogState('html', 'percentage', true);
            const absoluteState = getInitialDialogState('html', 'absolute', true);

            // Percentage state
            expect(percentageState.percentageModeCheckedAttr).toBe(' checked');
            expect(percentageState.absoluteModeCheckedAttr).toBe('');

            // Absolute state
            expect(absoluteState.percentageModeCheckedAttr).toBe('');
            expect(absoluteState.absoluteModeCheckedAttr).toBe(' checked');
        });

        it('should ensure exactly one resize control is enabled when HTML syntax is selected', () => {
            const percentageState = getInitialDialogState('html', 'percentage', true);
            const absoluteState = getInitialDialogState('html', 'absolute', true);

            // Percentage mode: percentage enabled, absolute disabled
            expect(percentageState.percentageDisabledAttr).toBe('');
            expect(percentageState.absoluteDisabledAttr).toBe(' disabled');

            // Absolute mode: percentage disabled, absolute enabled
            expect(absoluteState.percentageDisabledAttr).toBe(' disabled');
            expect(absoluteState.absoluteDisabledAttr).toBe('');
        });

        it('should lock resize fieldset when Markdown syntax is selected', () => {
            const markdownPercentage = getInitialDialogState('markdown', 'percentage', true);
            const markdownAbsolute = getInitialDialogState('markdown', 'absolute', true);

            expect(markdownPercentage.resizeFieldsetClass).toContain('is-locked');
            expect(markdownAbsolute.resizeFieldsetClass).toContain('is-locked');
        });

        it('should not lock resize fieldset when HTML syntax is selected', () => {
            const htmlPercentage = getInitialDialogState('html', 'percentage', true);
            const htmlAbsolute = getInitialDialogState('html', 'absolute', true);

            expect(htmlPercentage.resizeFieldsetClass).not.toContain('is-locked');
            expect(htmlAbsolute.resizeFieldsetClass).not.toContain('is-locked');
        });
    });

    describe('original dimensions summary', () => {
        const context = {
            type: 'markdown' as const,
            syntax: '![Alt](https://example.com/image.png)',
            source: 'https://example.com/image.png',
            sourceType: 'external' as const,
            altText: 'Alt',
            originalDimensions: { width: 400, height: 300 },
            originalDimensionsDetermined: true,
        };

        it('displays detected dimensions', () => {
            expect(getOriginalDimensionsSummaryHtml(context)).toBe('Original: <strong>400px × 300px</strong>');
        });

        it('does not display fallback values when dimensions are unknown', () => {
            expect(getOriginalDimensionsSummaryHtml({ ...context, originalDimensionsDetermined: false })).toBe(
                'Original dimensions could not be determined.'
            );
        });
    });
});

const dialogContext: ImageContext = {
    type: 'markdown',
    syntax: '![Alt](https://example.com/image.png)',
    source: 'https://example.com/image.png',
    sourceType: 'external',
    altText: 'Alt',
    originalDimensions: { width: 400, height: 300 },
    originalDimensionsDetermined: true,
};

const dialogDefaults: ResizeDialogDefaults = {
    defaultResizeMode: 'percentage',
    defaultPercentage: 50,
};

function createDialogApi() {
    return {
        create: vi.fn<JoplinDialogApi['create']>().mockResolvedValue('handle'),
        setFitToContent: vi.fn<JoplinDialogApi['setFitToContent']>().mockResolvedValue(undefined),
        addScript: vi.fn<JoplinDialogApi['addScript']>().mockResolvedValue(undefined),
        setButtons: vi.fn<JoplinDialogApi['setButtons']>().mockResolvedValue(undefined),
        setHtml: vi.fn<JoplinDialogApi['setHtml']>().mockResolvedValue(undefined),
        open: vi.fn<JoplinDialogApi['open']>().mockResolvedValue({ id: 'cancel' }),
    } satisfies JoplinDialogApi;
}

describe('ResizeDialog', () => {
    it('reuses one configured handle while rendering fresh content', async () => {
        const dialogs = createDialogApi();
        const dialog = new ResizeDialog(dialogs);

        await dialog.open(dialogContext, dialogDefaults);
        await dialog.open({ ...dialogContext, altText: 'Second image' }, dialogDefaults);

        expect(dialogs.create).toHaveBeenCalledOnce();
        expect(dialogs.create).toHaveBeenCalledWith('image-resize-dialog');
        expect(dialogs.setFitToContent).toHaveBeenCalledOnce();
        expect(dialogs.addScript).toHaveBeenCalledTimes(2);
        expect(dialogs.setButtons).toHaveBeenCalledOnce();
        expect(dialogs.setHtml).toHaveBeenCalledTimes(2);
        expect(dialogs.setHtml.mock.calls[1][1]).toContain('value="Second image"');
        expect(dialogs.open).toHaveBeenCalledTimes(2);
    });

    it('silently ignores an overlapping open', async () => {
        const dialogs = createDialogApi();
        const pending: { close?: (result: DialogResult | null) => void } = {};
        dialogs.open.mockReturnValue(
            new Promise((resolve) => {
                pending.close = resolve;
            })
        );
        const dialog = new ResizeDialog(dialogs);

        const first = dialog.open(dialogContext, dialogDefaults);
        await vi.waitFor(() => expect(dialogs.open).toHaveBeenCalledOnce());

        await expect(dialog.open(dialogContext, dialogDefaults)).resolves.toBeNull();
        expect(dialogs.open).toHaveBeenCalledOnce();

        pending.close?.({ id: 'cancel' });
        await first;
    });

    it('returns null for cancellation and an unexpected null result', async () => {
        const dialogs = createDialogApi();
        const dialog = new ResizeDialog(dialogs);

        await expect(dialog.open(dialogContext, dialogDefaults)).resolves.toBeNull();
        dialogs.open.mockResolvedValueOnce(null);
        await expect(dialog.open(dialogContext, dialogDefaults)).resolves.toBeNull();
    });

    it('reconfigures the existing handle after configuration fails', async () => {
        const dialogs = createDialogApi();
        dialogs.setButtons.mockRejectedValueOnce(new Error('buttons failed'));
        const dialog = new ResizeDialog(dialogs);

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
        const dialog = new ResizeDialog(dialogs);

        await expect(dialog.open(dialogContext, dialogDefaults)).rejects.toThrow('view creation failed');
        await expect(dialog.open(dialogContext, dialogDefaults)).rejects.toThrow('view creation failed');

        expect(dialogs.create).toHaveBeenCalledOnce();
        expect(dialogs.open).not.toHaveBeenCalled();
    });

    it('releases the open guard after an open failure', async () => {
        const dialogs = createDialogApi();
        dialogs.open.mockRejectedValueOnce(new Error('dialog failed'));
        const dialog = new ResizeDialog(dialogs);

        await expect(dialog.open(dialogContext, dialogDefaults)).rejects.toThrow('dialog failed');
        await expect(dialog.open(dialogContext, dialogDefaults)).resolves.toBeNull();

        expect(dialogs.create).toHaveBeenCalledOnce();
        expect(dialogs.open).toHaveBeenCalledTimes(2);
    });

    it('returns submitted form data', async () => {
        const dialogs = createDialogApi();
        dialogs.open.mockResolvedValue({
            id: 'ok',
            formData: {
                resizeForm: {
                    targetSyntax: 'html',
                    altText: 'Updated alt',
                    resizeMode: 'absolute',
                    percentage: '75',
                    absoluteWidth: '300',
                    absoluteHeight: '225',
                },
            },
        });

        await expect(new ResizeDialog(dialogs).open(dialogContext, dialogDefaults)).resolves.toEqual({
            targetSyntax: 'html',
            altText: 'Updated alt',
            resizeMode: 'absolute',
            percentage: 75,
            absoluteWidth: 300,
            absoluteHeight: 225,
        });
    });
});
