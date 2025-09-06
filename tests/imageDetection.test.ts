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
        expect(ctx!.originalSelection).toBe(sel);
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
        const sel = '<img src="https://example.com/img.png" alt="X" />';
        const ctx = detectImageSyntax(sel);
        expect(ctx).not.toBeNull();
        expect(ctx!.type).toBe('html');
        expect(ctx!.sourceType).toBe('external');
        expect(ctx!.source).toBe('https://example.com/img.png');
        expect(ctx!.altText).toBe('X');
    });

    test('returns null for non-image text', () => {
        expect(detectImageSyntax('Some text without image')).toBeNull();
    });
});
