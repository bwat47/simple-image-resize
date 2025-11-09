import { detectImageSyntax } from '../src/imageDetection';

describe('detectImageSyntax', () => {
    test('detects markdown image', () => {
        const sel = '![Alt text](:/0123456789abcdef0123456789abcdef)';
        const ctx = detectImageSyntax(sel);
        expect(ctx).not.toBeNull();
        expect(ctx!.type).toBe('markdown');
        expect(ctx!.sourceType).toBe('resource');
        expect(ctx!.source).toBe('0123456789abcdef0123456789abcdef');
        expect(ctx!.altText).toBe('Alt text');
    });

    test('detects html image and extracts alt', () => {
        const sel = '<img src=":/0123456789abcdef0123456789abcdef" alt="Sample" width="800" />';
        const ctx = detectImageSyntax(sel);
        expect(ctx).not.toBeNull();
        expect(ctx!.type).toBe('html');
        expect(ctx!.sourceType).toBe('resource');
        expect(ctx!.source).toBe('0123456789abcdef0123456789abcdef');
        expect(ctx!.altText).toBe('Sample');
    });

    test('detects external URL in markdown image', () => {
        const sel = '![Logo](https://example.com/logo.png)';
        const ctx = detectImageSyntax(sel);
        expect(ctx).not.toBeNull();
        expect(ctx!.type).toBe('markdown');
        expect(ctx!.sourceType).toBe('external');
        expect(ctx!.source).toBe('https://example.com/logo.png');
        expect(ctx!.altText).toBe('Logo');
    });

    test('detects external URL in html image', () => {
        const sel = '<img src="https://example.com/img.png" alt="X" title="Nice" />';
        const ctx = detectImageSyntax(sel);
        expect(ctx).not.toBeNull();
        expect(ctx!.type).toBe('html');
        expect(ctx!.sourceType).toBe('external');
        expect(ctx!.source).toBe('https://example.com/img.png');
        expect(ctx!.altText).toBe('X');
        expect(ctx!.title).toBe('Nice');
    });

    test('detects markdown image with escaped ) in URL', () => {
        const sel = '![Alt](https://example.com/img_%29_final.png)';
        const ctx = detectImageSyntax(sel);
        expect(ctx).not.toBeNull();
        expect(ctx!.type).toBe('markdown');
        expect(ctx!.source).toBe('https://example.com/img_%29_final.png');
    });

    test('detects markdown image with optional title', () => {
        const sel = '![Alt](https://example.com/picture.png "Title here")';
        const ctx = detectImageSyntax(sel);
        expect(ctx).not.toBeNull();
        expect(ctx!.type).toBe('markdown');
        expect(ctx!.source).toBe('https://example.com/picture.png');
        expect(ctx!.altText).toBe('Alt');
        expect(ctx!.title).toBe('Title here');
    });

    test('decodes HTML-escaped quotes in alt text', () => {
        const sel = '<img src=":/0123456789abcdef0123456789abcdef" alt="&quot;test&quot;" />';
        const ctx = detectImageSyntax(sel);
        expect(ctx).not.toBeNull();
        expect(ctx!.type).toBe('html');
        expect(ctx!.sourceType).toBe('resource');
        expect(ctx!.altText).toBe('"test"');
    });

    test('preserves apostrophe in alt text', () => {
        const sel = '<img src=":/0123456789abcdef0123456789abcdef" alt="honor\'s-magic" />';
        const ctx = detectImageSyntax(sel);
        expect(ctx).not.toBeNull();
        expect(ctx!.altText).toBe("honor's-magic");
    });

    test('decodes &apos; to apostrophe in alt text', () => {
        const sel = '<img src=":/0123456789abcdef0123456789abcdef" alt="honor&amp;apos;s-magic" />';
        const ctx = detectImageSyntax(sel);
        expect(ctx).not.toBeNull();
        expect(ctx!.altText).toBe("honor's-magic");
    });

    test('returns null for non-image text', () => {
        expect(detectImageSyntax('Some text without image')).toBeNull();
    });
});
