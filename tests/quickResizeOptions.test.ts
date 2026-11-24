import {
    buildQuickResizeResult,
    formatQuickResizeOptions,
    getQuickResizeSkippedMessage,
    normalizeQuickResizeOptions,
    QUICK_RESIZE_OPTIONS_DEFAULT,
    requiresOriginalDimensions,
    type QuickResizeOption,
} from '../src/host/quickResizeOptions';
import { requireValue } from './helpers/requireValue';

function parseSingleOption(rawOption: string): QuickResizeOption {
    return requireValue(normalizeQuickResizeOptions(rawOption)[0], `the ${rawOption} option`);
}

describe('normalizeQuickResizeOptions', () => {
    it('parses the default quick resize options', () => {
        expect(normalizeQuickResizeOptions(QUICK_RESIZE_OPTIONS_DEFAULT)).toEqual([
            { kind: 'percentage', value: 100, label: '100%' },
            { kind: 'percentage', value: 75, label: '75%' },
            { kind: 'percentage', value: 50, label: '50%' },
            { kind: 'percentage', value: 33, label: '33%' },
            { kind: 'percentage', value: 25, label: '25%' },
        ]);
    });

    it('parses mixed pixel and percentage options', () => {
        expect(normalizeQuickResizeOptions('300px, 500px, 75%, 100%')).toEqual([
            { kind: 'pixels', value: 300, label: '300px' },
            { kind: 'pixels', value: 500, label: '500px' },
            { kind: 'percentage', value: 75, label: '75%' },
            { kind: 'percentage', value: 100, label: '100%' },
        ]);
    });

    it('removes invalid quick resize options and keeps valid options', () => {
        const options = normalizeQuickResizeOptions('100%, 500inches, 300px, 900%, 75%');
        expect(options).toEqual([
            { kind: 'percentage', value: 100, label: '100%' },
            { kind: 'pixels', value: 300, label: '300px' },
            { kind: 'percentage', value: 75, label: '75%' },
        ]);
        expect(formatQuickResizeOptions(options)).toBe('100%, 300px, 75%');
    });

    it.each([
        ['zero percentage', '0%'],
        ['zero pixels', '0px'],
        ['missing unit', '75'],
        ['unknown unit', '75pt'],
        ['decimal percentage', '33.3%'],
        ['decimal pixels', '300.5px'],
        ['percentage above maximum', '501%'],
    ])('drops %s', (_name, invalidToken) => {
        expect(normalizeQuickResizeOptions(`100%, ${invalidToken}`)).toEqual([
            { kind: 'percentage', value: 100, label: '100%' },
        ]);
    });

    it('resets empty settings to the default quick resize options', () => {
        expect(formatQuickResizeOptions(normalizeQuickResizeOptions(''))).toBe(QUICK_RESIZE_OPTIONS_DEFAULT);
        expect(formatQuickResizeOptions(normalizeQuickResizeOptions(' , , '))).toBe(QUICK_RESIZE_OPTIONS_DEFAULT);
    });

    it('resets fully invalid settings to the default quick resize options', () => {
        expect(formatQuickResizeOptions(normalizeQuickResizeOptions('500inches, 900%, 0px'))).toBe(
            QUICK_RESIZE_OPTIONS_DEFAULT
        );
    });

    it('removes values beyond the quick resize slot limit', () => {
        expect(formatQuickResizeOptions(normalizeQuickResizeOptions('100%, 75%, 50%, 33%, 25%, 10%, 300px'))).toBe(
            QUICK_RESIZE_OPTIONS_DEFAULT
        );
    });

    it('normalizes valid option casing and spacing', () => {
        expect(formatQuickResizeOptions(normalizeQuickResizeOptions(' 300PX,75% , 025% '))).toBe('300px, 75%, 25%');
    });
});

describe('buildQuickResizeResult', () => {
    it('builds a percentage resize request', () => {
        const option = parseSingleOption('75%');

        expect(buildQuickResizeResult(option, { altText: 'Alt', title: 'Title' })).toEqual({
            targetSyntax: 'html',
            altText: 'Alt',
            title: 'Title',
            resizeMode: 'percentage',
            percentage: 75,
        });
    });

    it('builds a Markdown conversion request for 100%', () => {
        const option = parseSingleOption('100%');

        expect(buildQuickResizeResult(option, { altText: 'Alt', title: 'Title' })).toEqual({
            targetSyntax: 'markdown',
            altText: 'Alt',
            title: 'Title',
            resizeMode: 'percentage',
            percentage: 100,
        });
    });

    it('builds an absolute-width resize request for pixels', () => {
        const option = parseSingleOption('300px');

        expect(buildQuickResizeResult(option, { altText: 'Alt', title: 'Title' })).toEqual({
            targetSyntax: 'html',
            altText: 'Alt',
            title: 'Title',
            resizeMode: 'absolute',
            absoluteWidth: 300,
        });
    });
});

describe('requiresOriginalDimensions', () => {
    it('requires original dimensions for scaling percentages', () => {
        const seventyFive = parseSingleOption('75%');

        expect(requiresOriginalDimensions(seventyFive)).toBe(true);
    });

    it('does not require original dimensions for 100%, which converts to Markdown', () => {
        const hundred = parseSingleOption('100%');

        expect(requiresOriginalDimensions(hundred)).toBe(false);
    });

    it('does not require original dimensions for pixel values', () => {
        const pixels = parseSingleOption('300px');

        expect(requiresOriginalDimensions(pixels)).toBe(false);
    });

    it('names the skipped option and suggests an alternative', () => {
        const seventyFive = parseSingleOption('75%');

        expect(getQuickResizeSkippedMessage(seventyFive)).toBe(
            "Cannot resize to 75%: the image's original dimensions are unknown. Use a pixel value such as 300px, or the resize dialog."
        );
    });
});
