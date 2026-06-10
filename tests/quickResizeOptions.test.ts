import {
    buildQuickResizeResult,
    parseQuickResizeOptions,
    QUICK_RESIZE_OPTIONS_DEFAULT,
} from '../src/quickResizeOptions';

describe('parseQuickResizeOptions', () => {
    it('parses the default quick resize options', () => {
        expect(parseQuickResizeOptions(QUICK_RESIZE_OPTIONS_DEFAULT)).toEqual([
            { kind: 'percentage', value: 100, label: '100%' },
            { kind: 'percentage', value: 75, label: '75%' },
            { kind: 'percentage', value: 50, label: '50%' },
            { kind: 'percentage', value: 33, label: '33%' },
            { kind: 'percentage', value: 25, label: '25%' },
        ]);
    });

    it('parses mixed pixel and percentage options', () => {
        expect(parseQuickResizeOptions('300px, 500px, 75%, 100%')).toEqual([
            { kind: 'pixels', value: 300, label: '300px' },
            { kind: 'pixels', value: 500, label: '500px' },
            { kind: 'percentage', value: 75, label: '75%' },
            { kind: 'percentage', value: 100, label: '100%' },
        ]);
    });

    it.each([
        ['empty list', ''],
        ['more than five values', '100%, 75%, 50%, 33%, 25%, 10%'],
        ['zero percentage', '0%'],
        ['zero pixels', '0px'],
        ['missing unit', '75'],
        ['unknown unit', '75pt'],
        ['decimal percentage', '33.3%'],
        ['decimal pixels', '300.5px'],
        ['percentage above maximum', '501%'],
    ])('rejects %s', (_name, rawOptions) => {
        expect(() => parseQuickResizeOptions(rawOptions)).toThrow();
    });
});

describe('buildQuickResizeResult', () => {
    it('builds a percentage resize request', () => {
        const [option] = parseQuickResizeOptions('75%');

        expect(buildQuickResizeResult(option, 'Alt')).toEqual({
            targetSyntax: 'html',
            altText: 'Alt',
            resizeMode: 'percentage',
            percentage: 75,
        });
    });

    it('builds a Markdown conversion request for 100%', () => {
        const [option] = parseQuickResizeOptions('100%');

        expect(buildQuickResizeResult(option, 'Alt')).toEqual({
            targetSyntax: 'markdown',
            altText: 'Alt',
            resizeMode: 'percentage',
            percentage: 100,
        });
    });

    it('builds an absolute-width resize request for pixels', () => {
        const [option] = parseQuickResizeOptions('300px');

        expect(buildQuickResizeResult(option, 'Alt')).toEqual({
            targetSyntax: 'html',
            altText: 'Alt',
            resizeMode: 'absolute',
            absoluteWidth: 300,
        });
    });
});
