import { getInitialDialogState, getOriginalDimensionsSummaryHtml } from '../src/dialogHandler';

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
