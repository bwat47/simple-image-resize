import { getDialogFieldState } from '../src/dialog/dialogFieldState';

describe('getDialogFieldState', () => {
    it('enables only the percentage input in HTML percentage mode', () => {
        expect(getDialogFieldState('html', 'percentage', true)).toEqual({
            resizeMode: 'percentage',
            resizeLocked: false,
            percentageModeDisabled: false,
            percentageDisabled: false,
            absoluteDisabled: true,
            heightDisabled: true,
            heightDimmed: false,
        });
    });

    it('enables only the absolute inputs in HTML absolute mode', () => {
        expect(getDialogFieldState('html', 'absolute', true)).toEqual({
            resizeMode: 'absolute',
            resizeLocked: false,
            percentageModeDisabled: false,
            percentageDisabled: true,
            absoluteDisabled: false,
            heightDisabled: false,
            heightDimmed: false,
        });
    });

    it.each(['percentage', 'absolute'] as const)('locks every size input for Markdown in %s mode', (mode) => {
        const state = getDialogFieldState('markdown', mode, true);

        expect(state.resizeMode).toBe(mode);
        expect(state.resizeLocked).toBe(true);
        expect(state.percentageModeDisabled).toBe(false);
        expect(state.percentageDisabled).toBe(true);
        expect(state.absoluteDisabled).toBe(true);
        expect(state.heightDisabled).toBe(true);
        expect(state.heightDimmed).toBe(false);
    });

    it('falls back to absolute mode with a dimmed height row when dimensions are unknown', () => {
        expect(getDialogFieldState('html', 'percentage', false)).toEqual({
            resizeMode: 'absolute',
            resizeLocked: false,
            percentageModeDisabled: true,
            percentageDisabled: true,
            absoluteDisabled: false,
            heightDisabled: true,
            heightDimmed: true,
        });
    });

    it('does not dim the height row separately when its absolute group is disabled', () => {
        const state = getDialogFieldState('markdown', 'absolute', false);

        expect(state.absoluteDisabled).toBe(true);
        expect(state.heightDisabled).toBe(true);
        expect(state.heightDimmed).toBe(false);
    });
});
