import { detectImageSyntax } from '../src/imageDetection';

describe('detectImageSyntax', () => {
    test('detects markdown image', () => {
        const sel = '![Alt text](:/0123456789abcdef0123456789abcdef)';
        const ctx = detectImageSyntax(sel);
        expect(ctx).not.toBeNull();
        expect(ctx!.type).toBe('markdown');
        expect(ctx!.resourceId).toBe('0123456789abcdef0123456789abcdef');
        expect(ctx!.altText).toBe('Alt text');
        expect(ctx!.originalSelection).toBe(sel);
    });

    test('detects html image and extracts alt', () => {
        const sel = '<img src=":/0123456789abcdef0123456789abcdef" alt="Sample" width="800" />';
        const ctx = detectImageSyntax(sel);
        expect(ctx).not.toBeNull();
        expect(ctx!.type).toBe('html');
        expect(ctx!.altText).toBe('Sample');
    });

    test('returns null for non-image text', () => {
        expect(detectImageSyntax('Some text without image')).toBeNull();
    });
});
