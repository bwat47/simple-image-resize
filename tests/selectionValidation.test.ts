import { hasMultipleImages, selectionHasOnlySingleImage, containsAnyImage } from '../src/selectionValidation';

// Shared sample IDs
const id1 = '0123456789abcdef0123456789abcdef';
const id2 = 'fedcba9876543210fedcba9876543210';

const mdImg1 = `![Alt one](:/${id1})`;
const mdImg2 = `![Alt two](:/${id2})`;
const htmlImg1 = `<img src=":/${id1}" alt="Alt one" />`;
const htmlImg2 = `<img src=":/${id2}" width="100" height="50" />`;

describe('selection validation helpers', () => {
    describe('hasMultipleImages', () => {
        test('false for single markdown image', () => {
            expect(hasMultipleImages(mdImg1)).toBe(false);
        });
        test('false for single html image', () => {
            expect(hasMultipleImages(htmlImg1)).toBe(false);
        });
        test('true for two markdown images', () => {
            expect(hasMultipleImages(`${mdImg1} some text ${mdImg2}`)).toBe(true);
        });
        test('true for markdown + html mix', () => {
            expect(hasMultipleImages(`${mdImg1}\n${htmlImg2}`)).toBe(true);
        });
    });

    describe('selectionHasOnlySingleImage', () => {
        test('true for exactly one markdown image (trim whitespace)', () => {
            expect(selectionHasOnlySingleImage(`  ${mdImg1}  `)).toBe(true);
        });
        test('true for exactly one html image (trim whitespace/newlines)', () => {
            expect(selectionHasOnlySingleImage(`\n${htmlImg1}\n`)).toBe(true);
        });
        test('false when extra non-whitespace text present with image', () => {
            expect(selectionHasOnlySingleImage(`${mdImg1} trailing`)).toBe(false);
        });
        test('false when empty / whitespace only', () => {
            expect(selectionHasOnlySingleImage('   \n\t')).toBe(false);
        });
    });

    describe('containsAnyImage', () => {
        test('true for markdown image inside surrounding text', () => {
            expect(containsAnyImage(`prefix ${mdImg1} suffix`)).toBe(true);
        });
        test('true for html image', () => {
            expect(containsAnyImage(htmlImg1)).toBe(true);
        });
        test('false for text with no images', () => {
            expect(containsAnyImage('no images here')).toBe(false);
        });
    });
});
