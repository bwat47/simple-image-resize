/**
 * Editor-side image queries and document changes for the CodeMirror content script.
 *
 * Every function takes an `EditorState` or `Text` rather than an `EditorView`, so
 * the logic that reads and mutates a user's note can be tested against a real
 * parsed document without mounting an editor. The content script only adds the
 * command wiring around these functions.
 */

import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import type { EditorState, Text } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import type { EditorImageAtCursorResult, EditorPosition, ImageDetails } from '../shared/types';
import { logger } from '../shared/logger';
import { extractHtmlDetails, extractMarkdownDetails, type MarkdownImageParts } from './imageSyntaxParser';
import type { ViewerImageTarget } from '../shared/viewerImageTarget';
import type { ReplaceRangeArgs } from '../shared/editorCommands';

// Keep viewer context menus responsive when parsing a very large note.
const VIEWER_IMAGE_PARSE_TIMEOUT_MS = 200;

export type ImageNodeRange =
    | {
          type: 'markdown';
          from: number;
          to: number;
          /** Null for images without an inline destination, e.g. `![alt][ref]`. */
          parts: MarkdownImageParts | null;
      }
    | { type: 'html'; from: number; to: number };

/**
 * Validate arguments received across the plugin/editor boundary before using
 * them in document operations.
 *
 * Takes `unknown` because these values cross a runtime boundary: the editor
 * hands them over as plain data, so nothing has checked their shape yet.
 */
function isValidReplaceRangeArgs(args: unknown): args is ReplaceRangeArgs {
    const isValidPosition = (position: unknown): position is EditorPosition => {
        if (typeof position !== 'object' || position === null) {
            return false;
        }

        const candidate = position as Partial<EditorPosition>;
        return (
            typeof candidate.line === 'number' &&
            Number.isFinite(candidate.line) &&
            typeof candidate.ch === 'number' &&
            Number.isFinite(candidate.ch)
        );
    };

    // A non-object (null, undefined, a bare string) fails the field checks below.
    const candidate = (typeof args === 'object' && args !== null ? args : {}) as Partial<ReplaceRangeArgs>;

    if (
        typeof candidate.text !== 'string' ||
        typeof candidate.expectedText !== 'string' ||
        !isValidPosition(candidate.from) ||
        !isValidPosition(candidate.to)
    ) {
        logger.error('REPLACE_RANGE_COMMAND: invalid replacement arguments', args);
        return false;
    }

    const { from, to } = candidate;

    if (from.line > to.line || (from.line === to.line && from.ch > to.ch)) {
        logger.error('REPLACE_RANGE_COMMAND: from must be <= to', { from, to });
        return false;
    }

    return true;
}

/**
 * Slice the alt text, destination and title of a Markdown `Image` node from its
 * direct children. For `![a [b]](:/id "t")` the children are:
 * LinkMark `![`, Link `[b]`, LinkMark `]`, LinkMark `(`, URL `:/id`, LinkTitle `"t"`, LinkMark `)`.
 *
 * Only direct children are read, so a `]` inside a nested link, image or code span
 * cannot end the alt text.
 */
function readMarkdownImageParts(doc: Text, image: SyntaxNode): MarkdownImageParts | null {
    let altFrom = -1;
    let altTo = -1;
    let url: SyntaxNode | null = null;
    let title: SyntaxNode | null = null;

    for (let child = image.firstChild; child; child = child.nextSibling) {
        if (child.name === 'LinkMark') {
            const mark = doc.sliceString(child.from, child.to);
            if (mark === '![') altFrom = child.to;
            else if (mark === ']' && altTo === -1) altTo = child.from;
        } else if (child.name === 'URL') {
            url = child;
        } else if (child.name === 'LinkTitle') {
            title = child;
        }
    }

    if (altFrom === -1 || altTo === -1 || !url) return null;

    return {
        altText: doc.sliceString(altFrom, altTo),
        url: doc.sliceString(url.from, url.to),
        title: title ? doc.sliceString(title.from, title.to) : '',
    };
}

/**
 * Extract image metadata from an image node found by `findImagesInRange`.
 */
function getImageDetails(doc: Text, image: ImageNodeRange): ImageDetails | null {
    const imageText = doc.sliceString(image.from, image.to);
    if (image.type === 'html') return extractHtmlDetails(imageText);
    return image.parts ? extractMarkdownDetails(imageText, image.parts) : null;
}

/**
 * Find all image nodes that intersect a document range, in document order,
 * using the syntax tree. Returns both Markdown Image nodes and HTML img tags.
 *
 * Handles three cases:
 * 1. Markdown images: ![alt](url) - detected as Image nodes
 * 2. Simple HTML in Markdown: <img src="..."> - detected as HTMLTag nodes
 * 3. Nested HTML in Markdown: <div><img src="..."></div> - detected within HTMLBlock nodes
 *
 * The viewer's markdown-it plugin counts images with the same rules; see
 * `viewerContentScript.ts`.
 */
function findImagesInRange(state: EditorState, from: number, to: number, tree = syntaxTree(state)): ImageNodeRange[] {
    const images: ImageNodeRange[] = [];

    tree.iterate({
        from,
        to,
        enter: (node) => {
            // Case 1: Markdown images (direct Image node)
            if (node.name === 'Image') {
                images.push({
                    type: 'markdown',
                    from: node.from,
                    to: node.to,
                    parts: readMarkdownImageParts(state.doc, node.node),
                });
                // An image nested in alt text, e.g. ![a ![b](:/y)](:/x), is part of the
                // outer image's alt text; markdown-it renders only the outer image.
                return false;
            }

            // Case 2: Simple HTML tags in Markdown (HTMLTag node)
            if (node.name === 'HTMLTag') {
                const tagText = state.doc.sliceString(node.from, node.to);
                if (/^<img\s/i.test(tagText)) {
                    images.push({
                        type: 'html',
                        from: node.from,
                        to: node.to,
                    });
                }
                return;
            }

            // Case 3: HTML blocks in Markdown (HTMLBlock node containing nested HTML)
            // Example: <div><img src="..."></div>
            if (node.name === 'HTMLBlock') {
                const blockText = state.doc.sliceString(node.from, node.to);
                const imgRegex = /<img\s[^>]*>/gi;
                let match: RegExpExecArray | null;
                while ((match = imgRegex.exec(blockText)) !== null) {
                    const imgStart = node.from + match.index;
                    const imgEnd = imgStart + match[0].length;
                    // The block can extend past the range, so skip tags outside it.
                    if (imgStart <= to && imgEnd >= from) {
                        images.push({
                            type: 'html',
                            from: imgStart,
                            to: imgEnd,
                        });
                    }
                }
            }
        },
    });

    return images;
}

/**
 * Find all image nodes on the cursor's line.
 */
export function findImagesOnLine(state: EditorState): ImageNodeRange[] {
    const currentLine = state.doc.lineAt(state.selection.main.head);
    return findImagesInRange(state, currentLine.from, currentLine.to);
}

/**
 * Resolve an image right-clicked in the markdown viewer to its node in the editor.
 *
 * Counts the images that start inside the target's source line range and takes
 * the one at the target's index. Fails safe: returns null when the range is
 * outside the document, its syntax tree cannot be parsed in time, the index is
 * out of range, or the image found does not embed the resource the viewer
 * rendered (for example when the viewer is still showing an older render of
 * the note).
 */
export function findImageForViewerTarget(state: EditorState, target: ViewerImageTarget): ImageNodeRange | null {
    const { doc } = state;
    if (target.line >= doc.lines) {
        return null;
    }

    // Target lines are 0-based with an exclusive end; CM6 lines are 1-based.
    const rangeFrom = doc.line(target.line + 1).from;
    const rangeTo = doc.line(Math.min(target.lineEnd, doc.lines)).to;

    // The hidden editor may not have parsed this part of a long note yet.
    const tree = ensureSyntaxTree(state, rangeTo, VIEWER_IMAGE_PARSE_TIMEOUT_MS);
    if (!tree) {
        return null;
    }

    const images = findImagesInRange(state, rangeFrom, rangeTo, tree).filter((image) => image.from >= rangeFrom);
    const image = images[target.index];
    if (!image) {
        return null;
    }

    const details = getImageDetails(doc, image);
    if (details?.sourceType !== 'resource' || details.source.toLowerCase() !== target.resourceId.toLowerCase()) {
        return null;
    }

    return image;
}

/**
 * Cursor position that selects a viewer-targeted image.
 *
 * One character inside the image rather than at its start: when images touch
 * (`![a](:/x)![b](:/y)`), an image's start is also the previous image's end,
 * and cursor detection treats a cursor at an image's end as on that image.
 */
export function viewerImageCursorPosition(image: ImageNodeRange): number {
    return image.from + 1;
}

/**
 * Treat indentation before an image as part of its activation area while keeping
 * the replacement range scoped to the image syntax itself.
 */
export function isCursorInImageActivationRange(
    lineTextBeforeImage: string,
    cursor: number,
    imageNode: ImageNodeRange
): boolean {
    const leadingWhitespaceStart = imageNode.from - lineTextBeforeImage.length;
    const activationFrom = /^\s*$/.test(lineTextBeforeImage) ? leadingWhitespaceStart : imageNode.from;

    return cursor >= activationFrom && cursor <= imageNode.to;
}

/**
 * Get the image under the cursor, with its range as 0-indexed line/ch
 * positions for the plugin host.
 */
export function getImageAtCursor(state: EditorState): EditorImageAtCursorResult | null {
    const cursor = state.selection.main.head;
    const images = findImagesOnLine(state);

    for (const imageNode of images) {
        const imageLine = state.doc.lineAt(imageNode.from);
        const lineTextBeforeImage = state.doc.sliceString(imageLine.from, imageNode.from);

        if (isCursorInImageActivationRange(lineTextBeforeImage, cursor, imageNode)) {
            const details = getImageDetails(state.doc, imageNode);

            if (details) {
                const fromLine = state.doc.lineAt(imageNode.from);
                const toLine = state.doc.lineAt(imageNode.to);

                return {
                    ...details,
                    range: {
                        from: {
                            line: fromLine.number - 1, // Convert to 0-indexed
                            ch: imageNode.from - fromLine.from,
                        },
                        to: {
                            line: toLine.number - 1, // Convert to 0-indexed
                            ch: imageNode.to - toLine.from,
                        },
                    },
                };
            }
        }
    }

    return null;
}

/**
 * Convert a 0-indexed line/ch position to a document offset. CM6 lines are
 * 1-indexed. Out-of-range lines and columns are clamped to the document.
 */
export function posToOffset(doc: Text, pos: EditorPosition): number {
    const lineNum = Math.max(1, Math.min(pos.line + 1, doc.lines));
    const lineInfo = doc.line(lineNum);
    const ch = Math.max(0, Math.min(pos.ch, lineInfo.to - lineInfo.from));
    return lineInfo.from + ch;
}

/**
 * Resolve replacement arguments into a CodeMirror change spec.
 *
 * Validates values received across the editor boundary and uses optimistic
 * concurrency to ensure the text has not changed since image detection.
 *
 * @returns the change to dispatch, or null if the replacement must be aborted
 */
export function resolveReplaceChange(doc: Text, args: unknown): { from: number; to: number; insert: string } | null {
    if (!isValidReplaceRangeArgs(args)) {
        return null;
    }

    const { text, from, to, expectedText } = args;

    const fromOffset = posToOffset(doc, from);
    const toOffset = posToOffset(doc, to);

    // Optimistic concurrency control: Verify text hasn't changed
    const currentText = doc.sliceString(fromOffset, toOffset);
    if (currentText !== expectedText) {
        logger.warn(
            'replaceRange: Content changed since detection; aborting replacement.',
            '\nExpected:',
            expectedText,
            '\nFound:',
            currentText
        );
        return null;
    }

    return { from: fromOffset, to: toOffset, insert: text };
}
