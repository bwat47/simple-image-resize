import { extractHtmlDetails } from '../src/editor/imageSyntaxParser';
import { extractImageDetails } from './helpers/imageDetails';

describe('Image Extraction Patterns', () => {
    test('extracts markdown image details', () => {
        const sel = '![Alt text](:/0123456789abcdef0123456789abcdef)';
        const ctx = extractImageDetails(sel, 'markdown');
        expect(ctx).not.toBeNull();
        expect(ctx!.type).toBe('markdown');
        expect(ctx!.sourceType).toBe('resource');
        expect(ctx!.source).toBe('0123456789abcdef0123456789abcdef');
        expect(ctx!.altText).toBe('Alt text');
    });

    test('extracts html image details with alt text', () => {
        const sel = '<img src=":/0123456789abcdef0123456789abcdef" alt="Sample" width="800" />';
        const ctx = extractImageDetails(sel, 'html');
        expect(ctx).not.toBeNull();
        expect(ctx!.type).toBe('html');
        expect(ctx!.sourceType).toBe('resource');
        expect(ctx!.source).toBe('0123456789abcdef0123456789abcdef');
        expect(ctx!.altText).toBe('Sample');
    });

    test('extracts external URL from markdown image', () => {
        const sel = '![Logo](https://example.com/logo.png)';
        const ctx = extractImageDetails(sel, 'markdown');
        expect(ctx).not.toBeNull();
        expect(ctx!.type).toBe('markdown');
        expect(ctx!.sourceType).toBe('external');
        expect(ctx!.source).toBe('https://example.com/logo.png');
        expect(ctx!.altText).toBe('Logo');
    });

    test('extracts external URL from html image', () => {
        const sel = '<img src="https://example.com/img.png" alt="X" title="Nice" />';
        const ctx = extractImageDetails(sel, 'html');
        expect(ctx).not.toBeNull();
        expect(ctx!.type).toBe('html');
        expect(ctx!.sourceType).toBe('external');
        expect(ctx!.source).toBe('https://example.com/img.png');
        expect(ctx!.altText).toBe('X');
        expect(ctx!.title).toBe('Nice');
    });

    test('extracts markdown image with escaped ) in URL', () => {
        const sel = '![Alt](https://example.com/img_%29_final.png)';
        const ctx = extractImageDetails(sel, 'markdown');
        expect(ctx).not.toBeNull();
        expect(ctx!.type).toBe('markdown');
        expect(ctx!.source).toBe('https://example.com/img_%29_final.png');
    });

    test('extracts markdown image with optional title', () => {
        const sel = '![Alt](https://example.com/picture.png "Title here")';
        const ctx = extractImageDetails(sel, 'markdown');
        expect(ctx).not.toBeNull();
        expect(ctx!.type).toBe('markdown');
        expect(ctx!.source).toBe('https://example.com/picture.png');
        expect(ctx!.altText).toBe('Alt');
        expect(ctx!.title).toBe('Title here');
    });

    test.each([
        ['decodes in a single pass', 'use &amp;nbsp; here', 'use &nbsp; here'],
        ['decodes named and numeric references', '&lt;caf&eacute; &#128512;&gt;', '<café \u{1F600}>'],
        ['leaves references without a semicolon alone', 'Tom &amp Jerry', 'Tom &amp Jerry'],
        ['leaves a bare ampersand alone', 'Tom & Jerry', 'Tom & Jerry'],
        ['preserves escaped entities', String.raw`\&amp;`, '&amp;'],
        ['decodes after an even backslash run', String.raw`\\&copy;`, '\\©'],
        ['preserves after an odd backslash run', String.raw`\\\&copy;`, '\\&copy;'],
        ['does not decode escaped numeric references', String.raw`\&#91;`, '&#91;'],
        ['does not reinterpret decoded backslashes', '&#92;&copy;', '\\©'],
        ['decodes escaped brackets', String.raw`\[cat\]`, '[cat]'],
        ['preserves non-punctuation escapes', String.raw`C:\notes`, String.raw`C:\notes`],
        ['leaves overlong numeric references alone', '&#000000091; &#x0000005b;', '&#000000091; &#x0000005b;'],
    ])('markdown alt text and title: %s', (_label, raw, expected) => {
        const sel = `![${raw}](:/0123456789abcdef0123456789abcdef "${raw}")`;
        const ctx = extractImageDetails(sel, 'markdown');
        expect(ctx).not.toBeNull();
        expect(ctx!.altText).toBe(expected);
        expect(ctx!.title).toBe(expected);
    });

    test.each(['markdown', 'html'] as const)(
        'replaces invalid numeric references in %s alt text and titles',
        (syntax) => {
            const raw = '&#0; &#xD800; &#xDFFF; &#x110000;';
            const expected = '\uFFFD \uFFFD \uFFFD \uFFFD';
            const source = ':/0123456789abcdef0123456789abcdef';
            const image =
                syntax === 'markdown'
                    ? `![${raw}](${source} "${raw}")`
                    : `<img src="${source}" alt="${raw}" title="${raw}" />`;

            expect(extractImageDetails(image, syntax)).toMatchObject({ altText: expected, title: expected });
        }
    );

    test.each([
        ['"', String.raw`He said \"hi\" and it's fine`, 'He said "hi" and it\'s fine'],
        ["'", String.raw`It\'s "fine"`, 'It\'s "fine"'],
        ['"', '', ''],
        ['"', String.raw`path\\`, 'path\\'],
    ])('extracts a title delimited by %s: %s', (quote, title, expected) => {
        const syntax = `![Alt](:/0123456789abcdef0123456789abcdef ${quote}${title}${quote})`;
        expect(extractImageDetails(syntax, 'markdown')?.title).toBe(expected);
    });

    test.each([
        ['paren title', 'paren title'],
        [String.raw`a \(b\) "c" 'd'`, `a (b) "c" 'd'`],
        ['test _underscored title_ abc &#169;', 'test _underscored title_ abc ©'],
        ['', ''],
    ])('extracts a parenthesized title: %s', (title, expected) => {
        const syntax = `![Alt](:/0123456789abcdef0123456789abcdef (${title}))`;
        expect(extractImageDetails(syntax, 'markdown')?.title).toBe(expected);
    });

    test('rejects a parenthesized title containing unescaped parentheses', () => {
        const syntax = '![Alt](:/0123456789abcdef0123456789abcdef (a (b) c))';
        expect(extractImageDetails(syntax, 'markdown')).toBeNull();
    });

    test.each([
        ['one level', '![a [b] c](:/0123456789abcdef0123456789abcdef "t")', 'a [b] c'],
        ['two levels', '![a [[b]] c](:/0123456789abcdef0123456789abcdef)', 'a [[b]] c'],
        ['mixed with escapes', String.raw`![a \] [b\]] c](:/0123456789abcdef0123456789abcdef)`, 'a ] [b]] c'],
        [
            'a nested link',
            '![a [l](https://example.com) c](:/0123456789abcdef0123456789abcdef)',
            'a [l](https://example.com) c',
        ],
        [
            'a nested image',
            '![a ![in](:/fedcba9876543210fedcba9876543210) c](:/0123456789abcdef0123456789abcdef)',
            'a ![in](:/fedcba9876543210fedcba9876543210) c',
        ],
    ])('extracts alt text containing balanced brackets: %s', (_label, syntax, expectedAlt) => {
        expect(extractImageDetails(syntax, 'markdown')).toMatchObject({
            source: '0123456789abcdef0123456789abcdef',
            altText: expectedAlt,
        });
    });

    test('does not end alt text at a bracket inside a code span', () => {
        const syntax = '![a `]` b](:/0123456789abcdef0123456789abcdef)';
        expect(extractImageDetails(syntax, 'markdown')?.altText).toBe('a `]` b');
    });

    test.each([
        [
            'an angle-bracketed resource',
            '![Alt](<:/0123456789abcdef0123456789abcdef> "t")',
            '0123456789abcdef0123456789abcdef',
        ],
        ['an angle-bracketed URL', '![Alt](<https://example.com/a.png>)', 'https://example.com/a.png'],
        ['a URL with balanced parentheses', '![Alt](https://example.com/a_(b).png)', 'https://example.com/a_(b).png'],
    ])('extracts the source from %s', (_label, syntax, expectedSource) => {
        expect(extractImageDetails(syntax, 'markdown')?.source).toBe(expectedSource);
    });

    test.each([
        ['contain spaces', '![Alt](<https://example.com/my image.png>)'],
        ['contain parentheses', '![Alt](<https://example.com/a(b.png>)'],
    ])('rejects angle-bracketed destinations that %s', (_label, syntax) => {
        // Markdown output writes the source without angle brackets, which would break these.
        expect(extractImageDetails(syntax, 'markdown')).toBeNull();
    });

    test('decodes HTML-escaped quotes in alt text', () => {
        const sel = '<img src=":/0123456789abcdef0123456789abcdef" alt="&quot;test&quot;" />';
        const ctx = extractImageDetails(sel, 'html');
        expect(ctx).not.toBeNull();
        expect(ctx!.type).toBe('html');
        expect(ctx!.sourceType).toBe('resource');
        expect(ctx!.altText).toBe('"test"');
    });

    test.each([
        ['preserves a literal apostrophe', "honor's-magic", "honor's-magic"],
        ['decodes &apos;', 'honor&apos;s-magic', "honor's-magic"],
        ['decodes in a single pass', 'a &amp;lt; b', 'a &lt; b'],
        ['decodes astral numeric references', '&#128512; &#X1F600;', '\u{1F600} \u{1F600}'],
        ['decodes HTML5 named entities', 'caf&eacute;&nbsp;&copy;', 'café ©'],
    ])('alt text: %s', (_label, rawAlt, expected) => {
        const sel = `<img src=":/0123456789abcdef0123456789abcdef" alt="${rawAlt}" />`;
        const ctx = extractImageDetails(sel, 'html');
        expect(ctx).not.toBeNull();
        expect(ctx!.altText).toBe(expected);
    });

    // The editor normalizes line breaks to \n, so \r\n is only reachable by calling the extractor directly.
    test.each(['\n', '\r\n'])('extracts html alt text and title containing raw %j', (lineBreak) => {
        const sel = `<img src=":/0123456789abcdef0123456789abcdef" alt="first${lineBreak}second" title='a${lineBreak}b' />`;
        const ctx = extractHtmlDetails(sel);
        expect(ctx).toMatchObject({ altText: `first${lineBreak}second`, title: `a${lineBreak}b` });
    });

    test('returns null for non-image text', () => {
        expect(extractImageDetails('Some text without image', 'markdown')).toBeNull();
    });

    test('returns null for html img without a src attribute', () => {
        expect(extractImageDetails('<img alt="Sample" width="800" />', 'html')).toBeNull();
    });
});
