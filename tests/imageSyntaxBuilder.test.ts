import { buildNewSyntax } from '../src/imageSyntaxBuilder';
import { ImageContext, ResizeDialogResult } from '../src/types';

describe('buildNewSyntax', () => {
    const baseContext: ImageContext = {
        type: 'markdown',
        syntax: '![Alt](:/0123456789abcdef0123456789abcdef)',
        source: '0123456789abcdef0123456789abcdef',
        sourceType: 'resource',
        altText: 'Alt',
        title: undefined,
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

    test('preserves title when generating HTML', () => {
        const ctx: ImageContext = { ...baseContext, title: 'My Title' };
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'Alt',
            resizeMode: 'percentage',
            percentage: 50,
        };
        const syntax = buildNewSyntax(ctx, result);
        expect(syntax).toContain('title="My Title"');
    });

    test('preserves title when generating markdown', () => {
        const ctx: ImageContext = { ...baseContext, title: 'My Title' };
        const result: ResizeDialogResult = {
            targetSyntax: 'markdown',
            altText: 'Alt2',
            resizeMode: 'percentage',
            percentage: 100,
        };
        const syntax = buildNewSyntax(ctx, result);
        expect(syntax).toBe('![Alt2](:/0123456789abcdef0123456789abcdef "My Title")\n\n');
    });

    test('escapes quotes in title for markdown and html output', () => {
        const ctx: ImageContext = { ...baseContext, title: 'He said "hi" & <ok>' };
        // HTML
        const htmlRes: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'Alt',
            resizeMode: 'percentage',
            percentage: 100,
        };
        const html = buildNewSyntax(ctx, htmlRes);
        expect(html).toContain('title="He said &quot;hi&quot; &amp; &lt;ok&gt;"');
        // Markdown
        const mdRes: ResizeDialogResult = {
            targetSyntax: 'markdown',
            altText: 'Alt',
            resizeMode: 'percentage',
            percentage: 100,
        };
        const md = buildNewSyntax(ctx, mdRes);
        expect(md).toBe('![Alt](:/0123456789abcdef0123456789abcdef "He said &quot;hi&quot; &amp; &lt;ok&gt;")\n\n');
    });

    test('escapes quotes in alt text for html output', () => {
        const res: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'Quote: "double" & <tag>',
            resizeMode: 'percentage',
            percentage: 100,
        };
        const html = buildNewSyntax(baseContext, res);
        expect(html).toContain('alt="Quote: &quot;double&quot; &amp; &lt;tag&gt;"');
    });

    test('escapes single quotes in alt text for html output', () => {
        const res: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: "It's fine",
            resizeMode: 'percentage',
            percentage: 100,
        };
        const html = buildNewSyntax(baseContext, res);
        expect(html).toContain('alt="It&#39;s fine"');
    });

    test('builds syntax for external URL source', () => {
        const externalCtx: ImageContext = {
            type: 'markdown',
            syntax: '![Logo](https://example.com/logo.png)',
            source: 'https://example.com/logo.png',
            sourceType: 'external',
            altText: 'Logo',
            originalDimensions: { width: 1024, height: 512 },
            originalSelection: '![Logo](https://example.com/logo.png)\n',
        };
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'Logo',
            resizeMode: 'percentage',
            percentage: 50,
        };
        const syntax = buildNewSyntax(externalCtx, result);
        expect(syntax).toContain('<img src="https://example.com/logo.png"');
        expect(syntax).toContain('width="512"');
        expect(syntax).toContain('height="256"');
    });
});
