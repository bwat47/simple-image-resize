import MarkdownIt from 'markdown-it';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { installImagePositions } from '../src/contentScripts/viewerContentScript';
import {
    findImageForViewerTarget,
    getImageAtCursor,
    viewerImageCursorPosition,
} from '../src/contentScripts/cursorContentScript';
import { isViewerImageTarget, VIEWER_IMAGE_ATTRIBUTES, ViewerImageTarget } from '../src/viewerImageTarget';

vi.mock('../src/logger', () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** Distinct 32-hex resource IDs, so a resolved image proves which embed it is. */
const id = (n: number): string => n.toString(16).padStart(32, '0');

function render(doc: string, mapsToLine = true): string {
    const markdownIt = new MarkdownIt({ html: true });
    installImagePositions(markdownIt, { mapsToLine });
    return markdownIt.render(doc);
}

function editorState(doc: string): EditorState {
    return EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage })] });
}

/**
 * Collect viewer targets from rendered HTML, as viewerContextMenu.js would.
 * Plain markdown-it keeps the `:/id` source, so the resource ID is read from src.
 */
function viewerTargets(html: string): ViewerImageTarget[] {
    const targets: ViewerImageTarget[] = [];
    for (const [tag] of html.matchAll(/<img\b[^>]*>/gi)) {
        const attr = (name: string): string | undefined => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1];
        const line = attr(VIEWER_IMAGE_ATTRIBUTES.line);
        if (line === undefined) continue;
        targets.push({
            line: Number(line),
            lineEnd: Number(attr(VIEWER_IMAGE_ATTRIBUTES.lineEnd)),
            index: Number(attr(VIEWER_IMAGE_ATTRIBUTES.index)),
            resourceId: /src=":\/([a-f0-9]{32})"/.exec(tag)![1],
        });
    }
    return targets;
}

/**
 * Render `doc`, then for every annotated image do what a viewer right-click
 * does: resolve the target, place the cursor, and run cursor detection.
 * Returns the resource IDs the resize commands would act on.
 */
function resolveAll(doc: string): string[] {
    const state = editorState(doc);
    return viewerTargets(render(doc)).map((target) => {
        const image = findImageForViewerTarget(state, target);
        expect(image, `target ${JSON.stringify(target)} did not resolve`).not.toBeNull();

        const selected = state.update({ selection: { anchor: viewerImageCursorPosition(image!) } }).state;
        return getImageAtCursor(selected)!.source;
    });
}

describe('viewer image positions resolve to the same image in the editor', () => {
    it.each([
        ['paragraph with several images', `Text ![a](:/${id(1)}) and ![b](:/${id(2)}) end`, [1, 2]],
        ['HTML image block (resized image output)', `Intro\n\n<img src=":/${id(1)}" width="200">\n\nAfter`, [1]],
        [
            'HTML inline mixed with Markdown',
            `![a](:/${id(1)}) <img src=":/${id(2)}" width="10"> ![c](:/${id(3)})`,
            [1, 2, 3],
        ],
        ['multi-line HTML block', `<div>\n<img src=":/${id(1)}">\n<img src=":/${id(2)}">\n</div>`, [1, 2]],
        ['nested list items', `- one ![a](:/${id(1)})\n  - two ![b](:/${id(2)})\n- three ![c](:/${id(3)})`, [1, 2, 3]],
        ['blockquote across lines', `> quote\n> ![a](:/${id(1)})\n> ![b](:/${id(2)})`, [1, 2]],
        [
            'table cells in one row',
            `| a | b |\n|---|---|\n| ![a](:/${id(1)}) | ![b](:/${id(2)}) |\n| ![c](:/${id(3)}) | x |`,
            [1, 2, 3],
        ],
        ['touching Markdown images', `![a](:/${id(1)})![b](:/${id(2)})![c](:/${id(3)})`, [1, 2, 3]],
        [
            'touching HTML images',
            `<img src=":/${id(1)}" width="10"><img src=":/${id(2)}" width="10" /><img src=":/${id(3)}">`,
            [1, 2, 3],
        ],
        ['linked image', `[![a](:/${id(1)})](https://example.com) ![b](:/${id(2)})`, [1, 2]],
        ['image title', `![a](:/${id(1)} "Title") ![b](:/${id(2)})`, [1, 2]],
        [
            'fenced code is skipped by both sides',
            `\`\`\`\n![x](:/${id(9)})\n<img src=":/${id(8)}">\n\`\`\`\n\n![a](:/${id(1)})`,
            [1],
        ],
    ])('%s', (_name, doc, expectedIds) => {
        expect(resolveAll(doc)).toEqual(expectedIds.map(id));
    });

    it('picks the right copy when one resource appears twice in a block', () => {
        const doc = `![a](:/${id(1)}) and ![a](:/${id(1)})`;
        const state = editorState(doc);
        const [first, second] = viewerTargets(render(doc));

        expect(findImageForViewerTarget(state, first)!.from).toBe(0);
        expect(findImageForViewerTarget(state, second)!.from).toBe(doc.lastIndexOf('!['));
    });

    it('resolves an image beyond the editor syntax tree in a long note', () => {
        const doc = `${'ordinary text line\n'.repeat(1000)}\n![a](:/${id(1)})`;
        expect(resolveAll(doc)).toEqual([id(1)]);
    });
});

describe('installImagePositions', () => {
    it('leaves renders without line mapping unchanged', () => {
        const doc = `![a](:/${id(1)})\n\n<img src=":/${id(2)}">`;
        expect(render(doc, false)).toBe(new MarkdownIt({ html: true }).render(doc));
    });

    it('adds each position attribute once when installed twice on the same renderer', () => {
        const markdownIt = new MarkdownIt({ html: true });
        installImagePositions(markdownIt, { mapsToLine: true });
        installImagePositions(markdownIt, { mapsToLine: true });

        const html = markdownIt.render(`![a](:/${id(1)}) <img src=":/${id(2)}">`);
        const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)].map(([tag]) => tag);
        expect(imageTags).toHaveLength(2);
        for (const tag of imageTags) {
            for (const attribute of Object.values(VIEWER_IMAGE_ATTRIBUTES)) {
                expect(tag.match(new RegExp(`\\b${attribute}=`, 'g'))).toHaveLength(1);
            }
        }
    });
});

describe('findImageForViewerTarget', () => {
    const doc = `Intro\n\n![a](:/${id(1)})`;
    const target: ViewerImageTarget = { line: 2, lineEnd: 3, index: 0, resourceId: id(1) };

    it('resolves a matching target', () => {
        expect(findImageForViewerTarget(editorState(doc), target)).not.toBeNull();
    });

    it('rejects a target whose resource does not match (stale viewer render)', () => {
        expect(findImageForViewerTarget(editorState(doc), { ...target, resourceId: id(2) })).toBeNull();
    });

    it('rejects an index past the images in range', () => {
        expect(findImageForViewerTarget(editorState(doc), { ...target, index: 1 })).toBeNull();
    });

    it('rejects a line range outside the document', () => {
        expect(findImageForViewerTarget(editorState(doc), { ...target, line: 3, lineEnd: 4 })).toBeNull();
    });

    it('rejects external images', () => {
        const state = editorState('![a](https://example.com/a.png)');
        expect(findImageForViewerTarget(state, { line: 0, lineEnd: 1, index: 0, resourceId: id(1) })).toBeNull();
    });
});

describe('isViewerImageTarget', () => {
    const valid = { line: 1, lineEnd: 2, index: 0, resourceId: id(1) };

    it('accepts a valid target', () => {
        expect(isViewerImageTarget(valid)).toBe(true);
    });

    it.each([
        ['null', null],
        ['non-object', 'x'],
        ['negative line', { ...valid, line: -1 }],
        ['fractional index', { ...valid, index: 0.5 }],
        ['empty line range', { ...valid, lineEnd: 1 }],
        ['invalid resource ID', { ...valid, resourceId: 'abc' }],
    ])('rejects %s', (_name, value) => {
        expect(isViewerImageTarget(value)).toBe(false);
    });
});
