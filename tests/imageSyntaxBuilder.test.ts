import { buildNewSyntax } from '../src/imageSyntaxBuilder';
import { ImageContext, ResizeDialogResult } from '../src/types';

describe('buildNewSyntax', () => {
    const baseContext: ImageContext = {
        type: 'markdown',
        syntax: '![Alt](:/0123456789abcdef0123456789abcdef)',
        resourceId: '0123456789abcdef0123456789abcdef',
        altText: 'Alt',
        originalDimensions: { width: 800, height: 600 },
        originalSelection: '![Alt](:/0123456789abcdef0123456789abcdef)\n\n', // includes trailing newlines
    };

    test('returns markdown syntax when targetSyntax=markdown and preserves trailing whitespace', () => {
        const result: ResizeDialogResult = {
            targetSyntax: 'markdown',
            altText: 'New Alt',
            resizeMode: 'percentage',
            percentage: 50,
        };

        const syntax = buildNewSyntax(baseContext, result);
        expect(syntax).toBe('![New Alt](:/0123456789abcdef0123456789abcdef)\n\n');
    });

    test('calculates percentage resize for HTML output', () => {
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'Alt',
            resizeMode: 'percentage',
            percentage: 25,
        };
        const syntax = buildNewSyntax(baseContext, result);
        // 25% of 800x600 => 200x150
        expect(syntax).toContain('width="200"');
        expect(syntax).toContain('height="150"');
    });

    test('absolute dimensions both provided', () => {
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'X',
            resizeMode: 'absolute',
            absoluteWidth: 320,
            absoluteHeight: 240,
        };
        const syntax = buildNewSyntax(baseContext, result);
        expect(syntax).toContain('width="320"');
        expect(syntax).toContain('height="240"');
    });

    test('absolute width only keeps aspect ratio', () => {
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'X',
            resizeMode: 'absolute',
            absoluteWidth: 400,
        };
        const syntax = buildNewSyntax(baseContext, result);
        // Aspect ratio 800x600 => height scales to 300
        expect(syntax).toContain('width="400"');
        expect(syntax).toContain('height="300"');
    });

    test('absolute height only keeps aspect ratio', () => {
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'X',
            resizeMode: 'absolute',
            absoluteHeight: 300,
        };
        const syntax = buildNewSyntax(baseContext, result);
        // Width should scale: 800/600 * 300 = 400
        expect(syntax).toContain('width="400"');
        expect(syntax).toContain('height="300"');
    });
});
