import { isCursorInImageActivationRange } from '../src/contentScripts/cursorContentScript';

describe('Cursor content script image activation range', () => {
    test('allows cursor in leading whitespace before an image', () => {
        const imageNode = { type: 'html' as const, from: 4, to: 76 };

        expect(isCursorInImageActivationRange('    ', 0, imageNode)).toBe(true);
        expect(isCursorInImageActivationRange('    ', 3, imageNode)).toBe(true);
        expect(isCursorInImageActivationRange('    ', 4, imageNode)).toBe(true);
        expect(isCursorInImageActivationRange('    ', 76, imageNode)).toBe(true);
    });

    test('does not allow cursor before image when preceding line text is not only whitespace', () => {
        const imageNode = { type: 'html' as const, from: 7, to: 79 };

        expect(isCursorInImageActivationRange('Text   ', 3, imageNode)).toBe(false);
        expect(isCursorInImageActivationRange('Text   ', 6, imageNode)).toBe(false);
        expect(isCursorInImageActivationRange('Text   ', 7, imageNode)).toBe(true);
    });
});
