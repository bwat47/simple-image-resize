import { buildNewSyntax } from '../src/imageSyntaxBuilder';
import { ImageContext, ResizeDialogResult } from '../src/types';
import joplin from 'api';

describe('buildNewSyntax', () => {
    beforeEach(() => {
        // Default to 'widthAndHeight' setting
        (joplin.settings.value as jest.Mock).mockResolvedValue('widthAndHeight');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
    const baseContext: ImageContext = {
        type: 'markdown',
        syntax: '![Alt](:/0123456789abcdef0123456789abcdef)',
        source: '0123456789abcdef0123456789abcdef',
        sourceType: 'resource',
        altText: 'Alt',
        title: undefined,
        originalDimensions: { width: 800, height: 600 },
    };

    test('returns markdown syntax when targetSyntax=markdown', async () => {
        const result: ResizeDialogResult = {
            targetSyntax: 'markdown',
            altText: 'New Alt',
            resizeMode: 'percentage',
            percentage: 50,
        };

        const syntax = await buildNewSyntax(baseContext, result);
        expect(syntax).toBe('![New Alt](:/0123456789abcdef0123456789abcdef)');
    });

    test('calculates percentage resize for HTML output with width and height', async () => {
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'Alt',
            resizeMode: 'percentage',
            percentage: 25,
        };
        const syntax = await buildNewSyntax(baseContext, result);
        // 25% of 800x600 => 200x150
        expect(syntax).toContain('width="200"');
        expect(syntax).toContain('height="150"');
    });

    test('calculates percentage resize for HTML output with width only', async () => {
        (joplin.settings.value as jest.Mock).mockResolvedValue('widthOnly');
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'Alt',
            resizeMode: 'percentage',
            percentage: 25,
        };
        const syntax = await buildNewSyntax(baseContext, result);
        // 25% of 800x600 => 200x150
        expect(syntax).toContain('width="200"');
        expect(syntax).not.toContain('height=');
    });

    test('absolute dimensions both provided with width and height', async () => {
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'X',
            resizeMode: 'absolute',
            absoluteWidth: 320,
            absoluteHeight: 240,
        };
        const syntax = await buildNewSyntax(baseContext, result);
        expect(syntax).toContain('width="320"');
        expect(syntax).toContain('height="240"');
    });

    test('absolute dimensions both provided with width only', async () => {
        (joplin.settings.value as jest.Mock).mockResolvedValue('widthOnly');
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'X',
            resizeMode: 'absolute',
            absoluteWidth: 320,
            absoluteHeight: 240,
        };
        const syntax = await buildNewSyntax(baseContext, result);
        expect(syntax).toContain('width="320"');
        expect(syntax).not.toContain('height=');
    });

    test('absolute width only keeps aspect ratio', async () => {
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'X',
            resizeMode: 'absolute',
            absoluteWidth: 400,
        };
        const syntax = await buildNewSyntax(baseContext, result);
        // Aspect ratio 800x600 => height scales to 300
        expect(syntax).toContain('width="400"');
        expect(syntax).toContain('height="300"');
    });

    test('absolute height only keeps aspect ratio', async () => {
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'X',
            resizeMode: 'absolute',
            absoluteHeight: 300,
        };
        const syntax = await buildNewSyntax(baseContext, result);
        // Width should scale: 800/600 * 300 = 400
        expect(syntax).toContain('width="400"');
        expect(syntax).toContain('height="300"');
    });

    test('preserves title when generating HTML', async () => {
        const ctx: ImageContext = { ...baseContext, title: 'My Title' };
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'Alt',
            resizeMode: 'percentage',
            percentage: 50,
        };
        const syntax = await buildNewSyntax(ctx, result);
        expect(syntax).toContain('title="My Title"');
    });

    test('preserves title when generating markdown', async () => {
        const ctx: ImageContext = { ...baseContext, title: 'My Title' };
        const result: ResizeDialogResult = {
            targetSyntax: 'markdown',
            altText: 'Alt2',
            resizeMode: 'percentage',
            percentage: 100,
        };
        const syntax = await buildNewSyntax(ctx, result);
        expect(syntax).toBe('![Alt2](:/0123456789abcdef0123456789abcdef "My Title")');
    });

    test('removes brackets and preserves backslashes in alt text for markdown output', async () => {
        const res: ResizeDialogResult = {
            targetSyntax: 'markdown',
            altText: 'Alt [with] brackets and \\ backslash',
            resizeMode: 'percentage',
            percentage: 100,
        };
        const syntax = await buildNewSyntax(baseContext, res);
        expect(syntax).toBe('![Alt with brackets and \\ backslash](:/0123456789abcdef0123456789abcdef)');
    });

    test('escapes quotes in title for markdown and html output', async () => {
        const ctx: ImageContext = { ...baseContext, title: 'He said "hi" & <ok>' };
        // HTML
        const htmlRes: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'Alt',
            resizeMode: 'percentage',
            percentage: 100,
        };
        const html = await buildNewSyntax(ctx, htmlRes);
        expect(html).toContain('title="He said &quot;hi&quot; &amp; &lt;ok&gt;"');
        // Markdown
        const mdRes: ResizeDialogResult = {
            targetSyntax: 'markdown',
            altText: 'Alt',
            resizeMode: 'percentage',
            percentage: 100,
        };
        const md = await buildNewSyntax(ctx, mdRes);
        expect(md).toBe('![Alt](:/0123456789abcdef0123456789abcdef "He said &quot;hi&quot; &amp; &lt;ok&gt;")');
    });

    test('escapes quotes in alt text for html output', async () => {
        const res: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'Quote: "double" & <tag>',
            resizeMode: 'percentage',
            percentage: 100,
        };
        const html = await buildNewSyntax(baseContext, res);
        expect(html).toContain('alt="Quote: &quot;double&quot; &amp; &lt;tag&gt;"');
    });

    test('escapes single quotes in alt text for html output', async () => {
        const res: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: "It's fine",
            resizeMode: 'percentage',
            percentage: 100,
        };
        const html = await buildNewSyntax(baseContext, res);
        expect(html).toContain('alt="It&#39;s fine"');
    });

    test('builds syntax for external URL source', async () => {
        const externalCtx: ImageContext = {
            type: 'markdown',
            syntax: '![Logo](https://example.com/logo.png)',
            source: 'https://example.com/logo.png',
            sourceType: 'external',
            altText: 'Logo',
            originalDimensions: { width: 1024, height: 512 },
        };
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'Logo',
            resizeMode: 'percentage',
            percentage: 50,
        };
        const syntax = await buildNewSyntax(externalCtx, result);
        expect(syntax).toContain('<img src="https://example.com/logo.png"');
        expect(syntax).toContain('width="512"');
        expect(syntax).toContain('height="256"');
    });
});
