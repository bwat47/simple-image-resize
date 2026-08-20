import { EditorState, Text } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import {
    findImagesOnLine,
    getImageAtCursor,
    isCursorInImageActivationRange,
    posToOffset,
    resolveReplaceChange,
} from '../src/contentScripts/cursorContentScript';

vi.mock('../src/logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

const RESOURCE_ID = '0123456789abcdef0123456789abcdef';

/** Cursor marker for test fixtures; not a character Markdown gives meaning to. */
const CURSOR = '‸';

/**
 * Build an EditorState with the same Markdown grammar Joplin's CM6 editor uses,
 * so the syntax-tree node names (Image / HTMLTag / HTMLBlock) are the real ones.
 *
 * `markdownLanguage` is the GFM-extended grammar; bare `markdown()` would parse
 * plain CommonMark, which is not what the editor runs.
 *
 * The cursor is marked in `doc` with CURSOR, which is stripped before parsing.
 * The marker is a character Markdown never uses, so table pipes and the like
 * stay usable in fixtures.
 */
function stateWithCursor(doc: string): EditorState {
    const cursor = doc.indexOf(CURSOR);
    if (cursor === -1) throw new Error(`Test document must contain a ${CURSOR} cursor marker`);
    const text = doc.slice(0, cursor) + doc.slice(cursor + CURSOR.length);

    return EditorState.create({
        doc: text,
        selection: { anchor: cursor },
        extensions: [markdown({ base: markdownLanguage })],
    });
}

const sliceAll = (state: EditorState, ranges: { from: number; to: number }[]): string[] =>
    ranges.map((range) => state.doc.sliceString(range.from, range.to));

describe('isCursorInImageActivationRange', () => {
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

    test('rejects cursor past the end of the image', () => {
        const imageNode = { type: 'markdown' as const, from: 0, to: 10 };

        expect(isCursorInImageActivationRange('', 11, imageNode)).toBe(false);
    });
});

describe('findImagesOnLine', () => {
    test('finds a Markdown image (Image node)', () => {
        const state = stateWithCursor(`![alt‸](:/${RESOURCE_ID} "title")`);
        const images = findImagesOnLine(state);

        expect(images).toHaveLength(1);
        expect(images[0].type).toBe('markdown');
        expect(sliceAll(state, images)).toEqual([`![alt](:/${RESOURCE_ID} "title")`]);
    });

    test('finds an inline HTML img tag (HTMLTag node) surrounded by prose', () => {
        const state = stateWithCursor('Before <img src="a.png" width="100"> af‸ter');
        const images = findImagesOnLine(state);

        expect(images).toHaveLength(1);
        expect(images[0].type).toBe('html');
        expect(sliceAll(state, images)).toEqual(['<img src="a.png" width="100">']);
    });

    test('ignores non-img HTML tags', () => {
        const state = stateWithCursor('Before <span class="x">te‸xt</span> after');

        expect(findImagesOnLine(state)).toEqual([]);
    });

    test('finds an img nested inside an HTML block (HTMLBlock node)', () => {
        const state = stateWithCursor('<div><img src="a.png" wid‸th="100"></div>');
        const images = findImagesOnLine(state);

        expect(images).toHaveLength(1);
        expect(images[0].type).toBe('html');
        expect(sliceAll(state, images)).toEqual(['<img src="a.png" width="100">']);
    });

    test('finds multiple imgs in one HTML block on the same line', () => {
        const state = stateWithCursor('<div><img src="a.png"><img src="b.png"></d‸iv>');

        expect(sliceAll(state, findImagesOnLine(state))).toEqual(['<img src="a.png">', '<img src="b.png">']);
    });

    test('returns only the imgs intersecting the cursor line of a multi-line HTML block', () => {
        const state = stateWithCursor('<div>\n<img src="a.png">\n<img src="b‸.png">\n</div>');

        expect(sliceAll(state, findImagesOnLine(state))).toEqual(['<img src="b.png">']);
    });

    test('returns an empty list when the cursor line has no image', () => {
        const state = stateWithCursor('Just some pro‸se here.');

        expect(findImagesOnLine(state)).toEqual([]);
    });

    test('does not return images from other lines', () => {
        const state = stateWithCursor(`![a](:/${RESOURCE_ID})\n\nplain te‸xt\n\n![b](:/${RESOURCE_ID})`);

        expect(findImagesOnLine(state)).toEqual([]);
    });
});

describe('getImageAtCursor', () => {
    test('returns Markdown image details with a 0-indexed range', () => {
        const state = stateWithCursor(`intro\n![Al‸t](:/${RESOURCE_ID} "My title")`);
        const result = getImageAtCursor(state);

        expect(result).toEqual({
            type: 'markdown',
            syntax: `![Alt](:/${RESOURCE_ID} "My title")`,
            source: RESOURCE_ID,
            sourceType: 'resource',
            altText: 'Alt',
            title: 'My title',
            range: {
                from: { line: 1, ch: 0 },
                to: { line: 1, ch: `![Alt](:/${RESOURCE_ID} "My title")`.length },
            },
        });
    });

    test('range maps back to exactly the image syntax', () => {
        const prefix = 'text before ';
        const image = '<img src="a.png" width="100">';
        // A leading line keeps this honest: ch is a column, not a document offset.
        const state = stateWithCursor(`line one\n${prefix}<img src="a.png" wi‸dth="100"> text after`);
        const result = getImageAtCursor(state)!;

        expect(result.range.from).toEqual({ line: 1, ch: prefix.length });
        expect(result.range.to).toEqual({ line: 1, ch: prefix.length + image.length });

        const from = posToOffset(state.doc, result.range.from);
        const to = posToOffset(state.doc, result.range.to);
        expect(state.doc.sliceString(from, to)).toBe(image);
    });

    test('detects an external HTML image nested in a div', () => {
        const state = stateWithCursor(
            '<div align="center"><img src="https://example.com/a.png" alt="Ext" width="50‸0"></div>'
        );

        expect(getImageAtCursor(state)).toMatchObject({
            type: 'html',
            source: 'https://example.com/a.png',
            sourceType: 'external',
            altText: 'Ext',
            syntax: '<img src="https://example.com/a.png" alt="Ext" width="500">',
        });
    });

    test('activates when the cursor sits in indentation before the image', () => {
        // Two spaces keeps this a paragraph (four would make it an indented code block).
        const state = stateWithCursor(`‸  ![Alt](:/${RESOURCE_ID})`);

        expect(getImageAtCursor(state)).toMatchObject({
            type: 'markdown',
            range: { from: { line: 0, ch: 2 } },
        });
    });

    test('does not activate when non-whitespace text precedes the cursor and the image', () => {
        const state = stateWithCursor(`Some‸ text ![Alt](:/${RESOURCE_ID})`);

        expect(getImageAtCursor(state)).toBeNull();
    });

    test('picks the image the cursor is inside when a line has two', () => {
        const state = stateWithCursor(`![a](:/${RESOURCE_ID}) ![b‸](:/${RESOURCE_ID})`);

        expect(getImageAtCursor(state)).toMatchObject({ altText: 'b' });
    });

    test('detects an image inside a GFM table cell', () => {
        const state = stateWithCursor(`| col |\n| --- |\n| ![Al‸t](:/${RESOURCE_ID}) |`);

        expect(getImageAtCursor(state)).toMatchObject({
            type: 'markdown',
            altText: 'Alt',
            syntax: `![Alt](:/${RESOURCE_ID})`,
            range: { from: { line: 2, ch: 2 } },
        });
    });

    test('returns null when the cursor line has no image', () => {
        expect(getImageAtCursor(stateWithCursor('nothing to see‸ here'))).toBeNull();
    });

    test('returns null when the img tag has no src the parser can extract', () => {
        const state = stateWithCursor('Before <img alt="bro‸ken"> after');

        expect(findImagesOnLine(state)).toHaveLength(1);
        expect(getImageAtCursor(state)).toBeNull();
    });

    test('spans a multi-line range for an image whose HTML block wraps lines', () => {
        const state = stateWithCursor('line one\n<div>\n<img src="a‸.png">\n</div>');
        const result = getImageAtCursor(state);

        expect(result?.range).toEqual({
            from: { line: 2, ch: 0 },
            to: { line: 2, ch: '<img src="a.png">'.length },
        });
    });
});

describe('posToOffset', () => {
    const doc = Text.of(['abc', 'defgh', 'ij']);

    test('converts a 0-indexed line/ch position to an absolute offset', () => {
        expect(posToOffset(doc, { line: 0, ch: 0 })).toBe(0);
        expect(posToOffset(doc, { line: 0, ch: 3 })).toBe(3);
        expect(posToOffset(doc, { line: 1, ch: 2 })).toBe(6);
        expect(posToOffset(doc, { line: 2, ch: 2 })).toBe(12);
    });

    test('clamps a line past the end of the document to the last line', () => {
        expect(posToOffset(doc, { line: 99, ch: 0 })).toBe(10);
    });

    test('clamps a negative line to the first line', () => {
        expect(posToOffset(doc, { line: -5, ch: 1 })).toBe(1);
    });

    test('clamps ch to the bounds of its line', () => {
        expect(posToOffset(doc, { line: 1, ch: 99 })).toBe(9);
        expect(posToOffset(doc, { line: 1, ch: -3 })).toBe(4);
    });
});

describe('resolveReplaceChange', () => {
    const doc = Text.of(['hello world', 'second line']);

    test('resolves a change when the expected text still matches', () => {
        const change = resolveReplaceChange(doc, {
            text: 'HELLO',
            from: { line: 0, ch: 0 },
            to: { line: 0, ch: 5 },
            expectedText: 'hello',
        });

        expect(change).toEqual({ from: 0, to: 5, insert: 'HELLO' });
    });

    test('resolves a change spanning multiple lines', () => {
        const change = resolveReplaceChange(doc, {
            text: 'x',
            from: { line: 0, ch: 6 },
            to: { line: 1, ch: 6 },
            expectedText: 'world\nsecond',
        });

        expect(change).toEqual({ from: 6, to: 18, insert: 'x' });
    });

    test('aborts when the document changed since detection', () => {
        const change = resolveReplaceChange(doc, {
            text: 'HELLO',
            from: { line: 0, ch: 0 },
            to: { line: 0, ch: 5 },
            expectedText: 'stale',
        });

        expect(change).toBeNull();
    });

    test('aborts when values received across the editor boundary are malformed', () => {
        expect(
            resolveReplaceChange(doc, {
                text: undefined,
                from: null,
                to: { line: 0, ch: 5 },
                expectedText: 'hello',
            })
        ).toBeNull();
    });

    test('aborts when a position is not an object at all', () => {
        expect(
            resolveReplaceChange(doc, {
                text: 'x',
                from: 0,
                to: { line: 0, ch: 5 },
                expectedText: 'hello',
            })
        ).toBeNull();
    });

    test('aborts without throwing when the arguments are not an object', () => {
        expect(resolveReplaceChange(doc, null)).toBeNull();
        expect(resolveReplaceChange(doc, undefined)).toBeNull();
        expect(resolveReplaceChange(doc, 'hello')).toBeNull();
    });

    test('aborts when from is after to', () => {
        expect(
            resolveReplaceChange(doc, {
                text: 'x',
                from: { line: 0, ch: 5 },
                to: { line: 0, ch: 1 },
                expectedText: 'ello',
            })
        ).toBeNull();
        expect(
            resolveReplaceChange(doc, {
                text: 'x',
                from: { line: 1, ch: 0 },
                to: { line: 0, ch: 0 },
                expectedText: '',
            })
        ).toBeNull();
    });

    test('aborts on non-finite positions', () => {
        expect(
            resolveReplaceChange(doc, {
                text: 'x',
                from: { line: NaN, ch: 0 },
                to: { line: 0, ch: 5 },
                expectedText: 'hello',
            })
        ).toBeNull();
        expect(
            resolveReplaceChange(doc, {
                text: 'x',
                from: { line: 0, ch: 0 },
                to: { line: Infinity, ch: 5 },
                expectedText: 'hello',
            })
        ).toBeNull();
        expect(
            resolveReplaceChange(doc, {
                text: 'x',
                from: { line: 0, ch: -Infinity },
                to: { line: 0, ch: 5 },
                expectedText: 'hello',
            })
        ).toBeNull();
    });

    test('applies the resolved change to produce the expected document', () => {
        const source = `![Alt](:/${RESOURCE_ID})`;
        const replacement = `<img src=":/${RESOURCE_ID}" width="100">`;
        const imageDoc = Text.of(['intro', source]);

        const change = resolveReplaceChange(imageDoc, {
            text: replacement,
            from: { line: 1, ch: 0 },
            to: { line: 1, ch: source.length },
            expectedText: source,
        });

        const updated = EditorState.create({ doc: imageDoc }).update({ changes: change! }).state.doc.toString();

        expect(updated).toBe(`intro\n${replacement}`);
    });

    test('round-trips a detected image: getImageAtCursor range replaces exactly the image', () => {
        const state = stateWithCursor('Text <img src="a.png" wid‸th="100"> more text');
        const detected = getImageAtCursor(state)!;

        const change = resolveReplaceChange(state.doc, {
            text: '<img src="a.png" width="200">',
            from: detected.range.from,
            to: detected.range.to,
            expectedText: detected.syntax,
        });

        expect(state.update({ changes: change! }).state.doc.toString()).toBe(
            'Text <img src="a.png" width="200"> more text'
        );
    });
});
