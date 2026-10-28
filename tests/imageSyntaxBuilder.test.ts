import MarkdownIt from 'markdown-it';
import { extractImageDetails } from './helpers/imageDetails';
import { buildNewSyntax } from '../src/host/imageSyntaxBuilder';
import type { ImageContext, ImageSyntax, ResizeDialogResult } from '../src/shared/types';

describe('buildNewSyntax', () => {
    const baseContext: ImageContext = {
        type: 'markdown',
        syntax: '![Alt](:/0123456789abcdef0123456789abcdef)',
        source: '0123456789abcdef0123456789abcdef',
        sourceType: 'resource',
        altText: 'Alt',
        title: '',
        originalDimensions: { width: 800, height: 600 },
        originalDimensionsDetermined: true,
    };

    test('returns markdown syntax when targetSyntax=markdown', () => {
        const result: ResizeDialogResult = {
            targetSyntax: 'markdown',
            altText: 'New Alt',
            title: '',
            resizeMode: 'percentage',
            percentage: 50,
        };

        const syntax = buildNewSyntax(baseContext, result, 'widthAndHeight');
        expect(syntax).toBe('![New Alt](:/0123456789abcdef0123456789abcdef)');
    });

    test('calculates percentage resize for HTML output with width and height', () => {
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'Alt',
            title: '',
            resizeMode: 'percentage',
            percentage: 25,
        };
        const syntax = buildNewSyntax(baseContext, result, 'widthAndHeight');
        // 25% of 800x600 => 200x150
        expect(syntax).toContain('width="200"');
        expect(syntax).toContain('height="150"');
    });

    test('calculates percentage resize for HTML output with width only', () => {
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'Alt',
            title: '',
            resizeMode: 'percentage',
            percentage: 25,
        };
        const syntax = buildNewSyntax(baseContext, result, 'widthOnly');
        // 25% of 800x600 => 200x150
        expect(syntax).toContain('width="200"');
        expect(syntax).not.toContain('height=');
    });

    test('absolute dimensions both provided with width and height', () => {
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'X',
            title: '',
            resizeMode: 'absolute',
            absoluteWidth: 320,
            absoluteHeight: 240,
        };
        const syntax = buildNewSyntax(baseContext, result, 'widthAndHeight');
        expect(syntax).toContain('width="320"');
        expect(syntax).toContain('height="240"');
    });

    test('absolute dimensions both provided with width only', () => {
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'X',
            title: '',
            resizeMode: 'absolute',
            absoluteWidth: 320,
            absoluteHeight: 240,
        };
        const syntax = buildNewSyntax(baseContext, result, 'widthOnly');
        expect(syntax).toContain('width="320"');
        expect(syntax).not.toContain('height=');
    });

    test('omits height when original dimensions could not be determined', () => {
        const context: ImageContext = { ...baseContext, originalDimensionsDetermined: false };
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'X',
            title: '',
            resizeMode: 'absolute',
            absoluteWidth: 320,
            absoluteHeight: 240,
        };

        const syntax = buildNewSyntax(context, result, 'widthAndHeight');

        expect(syntax).toContain('width="320"');
        expect(syntax).not.toContain('height=');
    });

    test('absolute width only keeps aspect ratio', () => {
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'X',
            title: '',
            resizeMode: 'absolute',
            absoluteWidth: 400,
        };
        const syntax = buildNewSyntax(baseContext, result, 'widthAndHeight');
        // Aspect ratio 800x600 => height scales to 300
        expect(syntax).toContain('width="400"');
        expect(syntax).toContain('height="300"');
    });

    test('absolute height only keeps aspect ratio', () => {
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'X',
            title: '',
            resizeMode: 'absolute',
            absoluteHeight: 300,
        };
        const syntax = buildNewSyntax(baseContext, result, 'widthAndHeight');
        // Width should scale: 800/600 * 300 = 400
        expect(syntax).toContain('width="400"');
        expect(syntax).toContain('height="300"');
    });

    test('preserves title when generating HTML', () => {
        const title = 'My Title';
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'Alt',
            title,
            resizeMode: 'percentage',
            percentage: 50,
        };
        const syntax = buildNewSyntax(baseContext, result, 'widthAndHeight');
        expect(syntax).toContain('title="My Title"');
    });

    test('preserves title when generating markdown', () => {
        const title = 'My Title';
        const result: ResizeDialogResult = {
            targetSyntax: 'markdown',
            altText: 'Alt2',
            title,
            resizeMode: 'percentage',
            percentage: 100,
        };
        const syntax = buildNewSyntax(baseContext, result, 'widthAndHeight');
        expect(syntax).toBe('![Alt2](:/0123456789abcdef0123456789abcdef "My Title")');
    });

    test.each(['markdown', 'html'] as const)('uses the dialog title over the original for %s output', (to) => {
        const ctx: ImageContext = { ...baseContext, title: 'Old' };
        const base = { targetSyntax: to, altText: 'Alt', resizeMode: 'percentage', percentage: 100 } as const;

        expect(buildNewSyntax(ctx, { ...base, title: 'New' }, 'widthOnly')).toContain('New');
        expect(buildNewSyntax(ctx, { ...base, title: 'New' }, 'widthOnly')).not.toContain('Old');
        expect(buildNewSyntax(ctx, { ...base, title: '' }, 'widthOnly')).not.toMatch(/title=|"Old"/);
    });

    test('escapes brackets and escaping backslashes in alt text for markdown output', () => {
        const res: ResizeDialogResult = {
            targetSyntax: 'markdown',
            altText: 'Alt [with] brackets and \\ backslash',
            title: '',
            resizeMode: 'percentage',
            percentage: 100,
        };
        const syntax = buildNewSyntax(baseContext, res, 'widthAndHeight');
        expect(syntax).toBe(String.raw`![Alt \[with\] brackets and \ backslash](:/0123456789abcdef0123456789abcdef)`);
        expect(extractImageDetails(syntax, 'markdown')?.altText).toBe(res.altText);
    });

    test.each([
        [
            'leaves inline markup in alt text alone',
            'my_screenshot_2024.png *x* a < b <3 <',
            'my_screenshot_2024.png *x* a < b <3 <',
            '',
        ],
        ['escapes tag-like angle brackets in alt text', '<b>x</b> <!-- <?', String.raw`\<b>x\</b> \<!-- \<?`, ''],
        ['leaves literal backslashes alone', String.raw`C:\notes`, String.raw`C:\notes`, String.raw` "C:\notes"`],
        ['escapes a trailing backslash', 'path\\', 'path\\\\', ' "path\\\\"'],
        ['escapes backslashes before punctuation', String.raw`a\[b\]`, String.raw`a\\\[b\\\]`, String.raw` "a\\[b\\]"`],
        ['escapes backticks in alt text', 'a `b] c` d', 'a \\`b\\] c\\` d', ' "a `b] c` d"'],
    ])('markdown output %s', (_label, text, expectedAlt, expectedTitlePart) => {
        const title = expectedTitlePart ? text : '';
        const res: ResizeDialogResult = {
            targetSyntax: 'markdown',
            altText: text,
            title,
            resizeMode: 'percentage',
            percentage: 100,
        };
        const syntax = buildNewSyntax(baseContext, res, 'widthAndHeight');
        expect(syntax).toBe(`![${expectedAlt}](:/0123456789abcdef0123456789abcdef${expectedTitlePart})`);
        expect(extractImageDetails(syntax, 'markdown')).toMatchObject({ altText: text, title });
    });

    test.each([
        [`<span title="x`, ' after">'],
        [`<span title='`, '', `'>`],
        ['<http://example.com/', ' y>'],
    ])('keeps the image intact when alt text %j starts an unclosed tag', (altText, trailingText, title = '') => {
        const res: ResizeDialogResult = {
            targetSyntax: 'markdown',
            altText,
            title,
            resizeMode: 'percentage',
            percentage: 100,
        };
        const syntax = buildNewSyntax(baseContext, res, 'widthAndHeight');
        const tokens = new MarkdownIt({ html: true }).parseInline(syntax + trailingText, {});
        const image = tokens[0].children?.find((token) => token.type === 'image');

        expect(image?.attrGet('src')).toBe(':/0123456789abcdef0123456789abcdef');
        expect(extractImageDetails(syntax, 'markdown')).toMatchObject({ altText, title });
    });

    test('escapes entity-like sequences in alt text and title for markdown output', () => {
        const title = 'a &lt; b &#60; c & d';
        const res: ResizeDialogResult = {
            targetSyntax: 'markdown',
            altText: 'use &nbsp; here & &amp there',
            title,
            resizeMode: 'percentage',
            percentage: 100,
        };
        const syntax = buildNewSyntax(baseContext, res, 'widthAndHeight');
        expect(syntax).toBe(
            '![use &amp;nbsp; here & &amp there](:/0123456789abcdef0123456789abcdef "a &amp;lt; b &amp;#60; c & d")'
        );
    });

    test('leaves ampersands Markdown would not decode unescaped and round-trips them', () => {
        const text = '&a; &#12345678; &#x1234567; &_x;';
        const res: ResizeDialogResult = {
            targetSyntax: 'markdown',
            altText: text,
            title: text,
            resizeMode: 'percentage',
            percentage: 100,
        };
        const syntax = buildNewSyntax(baseContext, res, 'widthAndHeight');
        expect(syntax).toBe(`![${text}](:/0123456789abcdef0123456789abcdef "${text}")`);
        expect(extractImageDetails(syntax, 'markdown')).toMatchObject({ altText: text, title: text });
    });

    test('round-trips entity-like text between markdown and html', () => {
        const convert = (syntax: string, from: ImageSyntax, to: ImageSyntax): string => {
            const details = extractImageDetails(syntax, from)!;
            const ctx: ImageContext = {
                ...details,
                originalDimensions: { width: 800, height: 600 },
                originalDimensionsDetermined: true,
            };
            return buildNewSyntax(
                ctx,
                {
                    targetSyntax: to,
                    altText: details.altText,
                    title: details.title,
                    resizeMode: 'percentage',
                    percentage: 100,
                },
                'widthOnly'
            );
        };
        const markdown = '![use &amp;nbsp; here](:/0123456789abcdef0123456789abcdef "a &amp;lt; b")';
        const html =
            '<img src=":/0123456789abcdef0123456789abcdef" alt="use &amp;nbsp; here" width="800" title="a &amp;lt; b" />';

        expect(convert(markdown, 'markdown', 'html')).toBe(html);
        expect(convert(html, 'html', 'markdown')).toBe(markdown);
    });

    test('escapes quotes in title for markdown and html output', () => {
        const title = 'He said "hi" & <ok>';
        // HTML: HTML entities are escaped
        const htmlRes: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'Alt',
            title,
            resizeMode: 'percentage',
            percentage: 100,
        };
        const html = buildNewSyntax(baseContext, htmlRes, 'widthAndHeight');
        expect(html).toContain('title="He said &quot;hi&quot; &amp; &lt;ok&gt;"');
        // Markdown: Quotes are escaped and recoverable on extraction.
        const mdRes: ResizeDialogResult = {
            targetSyntax: 'markdown',
            altText: 'Alt',
            title,
            resizeMode: 'percentage',
            percentage: 100,
        };
        const md = buildNewSyntax(baseContext, mdRes, 'widthAndHeight');
        expect(md).toBe('![Alt](:/0123456789abcdef0123456789abcdef "He said \\"hi\\" & <ok>")');
        expect(extractImageDetails(md, 'markdown')?.title).toBe(title);
    });

    test('escapes quotes in alt text for html output', () => {
        const res: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'Quote: "double" & <tag>',
            title: '',
            resizeMode: 'percentage',
            percentage: 100,
        };
        const html = buildNewSyntax(baseContext, res, 'widthAndHeight');
        expect(html).toContain('alt="Quote: &quot;double&quot; &amp; &lt;tag&gt;"');
    });

    test('escapes single quotes in alt text for html output', () => {
        const res: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: "It's fine",
            title: '',
            resizeMode: 'percentage',
            percentage: 100,
        };
        const html = buildNewSyntax(baseContext, res, 'widthAndHeight');
        expect(html).toContain('alt="It&apos;s fine"');
    });

    test('preserves backslashes in title without accumulation', () => {
        const title = 'mern & test\\ABC';
        // Convert to HTML
        const htmlRes: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'Alt',
            title,
            resizeMode: 'percentage',
            percentage: 100,
        };
        const html = buildNewSyntax(baseContext, htmlRes, 'widthAndHeight');
        expect(html).toContain('title="mern &amp; test\\ABC"');

        // Markdown leaves the literal backslash alone; it cannot act as an escape before `A`.
        const mdRes: ResizeDialogResult = {
            targetSyntax: 'markdown',
            altText: 'Alt',
            title,
            resizeMode: 'percentage',
            percentage: 100,
        };
        const md = buildNewSyntax(baseContext, mdRes, 'widthAndHeight');
        expect(md).toBe(String.raw`![Alt](:/0123456789abcdef0123456789abcdef "mern & test\ABC")`);
        expect(extractImageDetails(md, 'markdown')?.title).toBe(title);
    });

    test.each([
        ['&#91;cat&#93;', '[cat]'],
        ['say &quot;hi&quot; and &apos;bye&apos;', 'say "hi" and \'bye\''],
        [String.raw`\&amp;`, '&amp;'],
        [String.raw`\\&copy;`, '\\©'],
        [String.raw`\\\&copy;`, '\\&copy;'],
        ['&amp;quot; &amp;#91;', '&quot; &#91;'],
        ['&#92;&#34;', '\\"'],
        ['ends with &#92;', 'ends with \\'],
        ['&#42;cat&#42; &#96;code&#96; &lt;b&gt;', '*cat* `code` <b>'],
    ])('preserves %s across repeated conversions', (raw, expected) => {
        let syntax = `![${raw}](:/0123456789abcdef0123456789abcdef "${raw}")`;
        let from: ImageSyntax = 'markdown';
        const markdownTitles: (string | null | undefined)[] = [];
        const targets: ImageSyntax[] = ['markdown', 'markdown', 'html', 'html', 'markdown', 'html', 'markdown'];
        for (const targetSyntax of targets) {
            const details = extractImageDetails(syntax, from);
            expect(details).not.toBeNull();
            expect(details?.altText).toBe(expected);
            expect(details?.title).toBe(expected);
            syntax = buildNewSyntax(
                { ...baseContext, ...details! },
                {
                    targetSyntax,
                    altText: details!.altText,
                    title: details!.title,
                    resizeMode: 'percentage',
                    percentage: 100,
                },
                'widthOnly'
            );
            if (targetSyntax === 'markdown') {
                const tokens = new MarkdownIt().parseInline(syntax, {});
                const image = tokens[0].children?.find((token) => token.type === 'image');
                markdownTitles.push(image?.attrGet('title'));
            }
            from = targetSyntax;
        }
        expect(extractImageDetails(syntax, from)).toMatchObject({ altText: expected, title: expected });
        expect(markdownTitles).toEqual([expected, expected, expected, expected]);
    });

    test.each(['&#10;', '&#13;', '&#13;&#10;'])('normalizes decoded %s before repeated conversions', (lineBreak) => {
        const raw = `first${lineBreak}second${lineBreak}${lineBreak}third  fourth\tfifth`;
        const expected = 'first second  third  fourth\tfifth';
        const original = `![${raw}](:/0123456789abcdef0123456789abcdef "${raw}")`;

        for (const firstTarget of ['markdown', 'html'] as const) {
            let syntax = original;
            let from: ImageSyntax = 'markdown';
            const targets: ImageSyntax[] = [firstTarget, 'html', 'markdown', 'html'];
            for (const targetSyntax of targets) {
                const details = extractImageDetails(syntax, from)!;
                syntax = buildNewSyntax(
                    { ...baseContext, ...details },
                    {
                        targetSyntax,
                        altText: details.altText,
                        title: details.title,
                        resizeMode: 'percentage',
                        percentage: 100,
                    },
                    'widthOnly'
                );
                expect(syntax).not.toMatch(/[\r\n]/);
                expect(extractImageDetails(syntax, targetSyntax)).toMatchObject({ altText: expected, title: expected });
                from = targetSyntax;
            }
        }
    });

    test('rewrites a parenthesized title as a double-quoted title', () => {
        const details = extractImageDetails(
            String.raw`![Alt](:/0123456789abcdef0123456789abcdef (a \(b\) "c"))`,
            'markdown'
        )!;
        const syntax = buildNewSyntax(
            { ...baseContext, ...details },
            {
                targetSyntax: 'markdown',
                altText: details.altText,
                title: details.title,
                resizeMode: 'percentage',
                percentage: 100,
            },
            'widthOnly'
        );
        expect(syntax).toBe(String.raw`![Alt](:/0123456789abcdef0123456789abcdef "a (b) \"c\"")`);
    });

    test('builds syntax for external URL source', () => {
        const externalCtx: ImageContext = {
            type: 'markdown',
            syntax: '![Logo](https://example.com/logo.png)',
            source: 'https://example.com/logo.png',
            sourceType: 'external',
            altText: 'Logo',
            title: '',
            originalDimensions: { width: 1024, height: 512 },
            originalDimensionsDetermined: true,
        };
        const result: ResizeDialogResult = {
            targetSyntax: 'html',
            altText: 'Logo',
            title: '',
            resizeMode: 'percentage',
            percentage: 50,
        };
        const syntax = buildNewSyntax(externalCtx, result, 'widthAndHeight');
        expect(syntax).toContain('<img src="https://example.com/logo.png"');
        expect(syntax).toContain('width="512"');
        expect(syntax).toContain('height="256"');
    });
});
