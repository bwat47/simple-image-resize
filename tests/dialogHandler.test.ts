import { getInitialDialogState } from '../src/dialogHandler';

describe('getInitialDialogState', () => {
    describe('HTML syntax with percentage mode', () => {
        it('should enable HTML syntax and percentage mode', () => {
            const state = getInitialDialogState('html', 'percentage');

            // CSS classes
            expect(state.resizeFieldsetClass).toBe('resize-fieldset');
            expect(state.percentageRowClass).toBe('row');
            expect(state.absoluteGroupClass).toBe('stack absolute-size-group is-disabled');

            // Checked attributes
            expect(state.htmlCheckedAttr).toBe(' checked');
            expect(state.markdownCheckedAttr).toBe('');
            expect(state.percentageModeCheckedAttr).toBe(' checked');
            expect(state.absoluteModeCheckedAttr).toBe('');

            // Disabled attributes
            expect(state.percentageDisabledAttr).toBe('');
            expect(state.absoluteDisabledAttr).toBe(' disabled');
        });
    });

    describe('HTML syntax with absolute mode', () => {
        it('should enable HTML syntax and absolute mode', () => {
            const state = getInitialDialogState('html', 'absolute');

            // CSS classes
            expect(state.resizeFieldsetClass).toBe('resize-fieldset');
            expect(state.percentageRowClass).toBe('row is-disabled');
            expect(state.absoluteGroupClass).toBe('stack absolute-size-group');

            // Checked attributes
            expect(state.htmlCheckedAttr).toBe(' checked');
            expect(state.markdownCheckedAttr).toBe('');
            expect(state.percentageModeCheckedAttr).toBe('');
            expect(state.absoluteModeCheckedAttr).toBe(' checked');

            // Disabled attributes
            expect(state.percentageDisabledAttr).toBe(' disabled');
            expect(state.absoluteDisabledAttr).toBe('');
        });
    });

    describe('Markdown syntax with percentage mode', () => {
        it('should enable Markdown syntax and disable all resize controls', () => {
            const state = getInitialDialogState('markdown', 'percentage');

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
            const state = getInitialDialogState('markdown', 'absolute');

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
        it('should ensure only one syntax is checked at a time', () => {
            const htmlState = getInitialDialogState('html', 'percentage');
            const markdownState = getInitialDialogState('markdown', 'percentage');

            // HTML state
            expect(htmlState.htmlCheckedAttr).toBe(' checked');
            expect(htmlState.markdownCheckedAttr).toBe('');

            // Markdown state
            expect(markdownState.htmlCheckedAttr).toBe('');
            expect(markdownState.markdownCheckedAttr).toBe(' checked');
        });

        it('should ensure only one resize mode is checked at a time', () => {
            const percentageState = getInitialDialogState('html', 'percentage');
            const absoluteState = getInitialDialogState('html', 'absolute');

            // Percentage state
            expect(percentageState.percentageModeCheckedAttr).toBe(' checked');
            expect(percentageState.absoluteModeCheckedAttr).toBe('');

            // Absolute state
            expect(absoluteState.percentageModeCheckedAttr).toBe('');
            expect(absoluteState.absoluteModeCheckedAttr).toBe(' checked');
        });

        it('should ensure exactly one resize control is enabled when HTML syntax is selected', () => {
            const percentageState = getInitialDialogState('html', 'percentage');
            const absoluteState = getInitialDialogState('html', 'absolute');

            // Percentage mode: percentage enabled, absolute disabled
            expect(percentageState.percentageDisabledAttr).toBe('');
            expect(percentageState.absoluteDisabledAttr).toBe(' disabled');

            // Absolute mode: percentage disabled, absolute enabled
            expect(absoluteState.percentageDisabledAttr).toBe(' disabled');
            expect(absoluteState.absoluteDisabledAttr).toBe('');
        });

        it('should lock resize fieldset when Markdown syntax is selected', () => {
            const markdownPercentage = getInitialDialogState('markdown', 'percentage');
            const markdownAbsolute = getInitialDialogState('markdown', 'absolute');

            expect(markdownPercentage.resizeFieldsetClass).toContain('is-locked');
            expect(markdownAbsolute.resizeFieldsetClass).toContain('is-locked');
        });

        it('should not lock resize fieldset when HTML syntax is selected', () => {
            const htmlPercentage = getInitialDialogState('html', 'percentage');
            const htmlAbsolute = getInitialDialogState('html', 'absolute');

            expect(htmlPercentage.resizeFieldsetClass).not.toContain('is-locked');
            expect(htmlAbsolute.resizeFieldsetClass).not.toContain('is-locked');
        });
    });
});
