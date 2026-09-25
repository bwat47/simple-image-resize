/**
 * CodeMirror 6 content script for editor operations.
 *
 * Registers custom commands for:
 * - Image detection at cursor using syntax tree
 * - Moving the cursor onto an image right-clicked in the markdown viewer
 * - Text replacement at specified ranges
 * - Image dimension measurement (loads images in editor context)
 *
 * Enables image detection and editing on both desktop and mobile platforms.
 * The editor context has file access on mobile, allowing dimension fetching
 * for local resources that the main plugin context cannot access directly.
 */

import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { EditorState, Text } from '@codemirror/state';
import type { CodeMirrorControl, MarkdownEditorContentScriptModule } from 'api/types';
import type { EditorImageAtCursorResult, EditorPosition, ImageDimensions, ImageSyntax } from '../types';
import { logger } from '../logger';
import { extractImageDetails } from '../imageSyntaxParser';
import { measureImageDimensions, RESOURCE_IMAGE_LOAD_TIMEOUT_MS } from '../utils/imageDimensionUtils';
import { isViewerImageTarget, ViewerImageTarget } from '../viewerImageTarget';

// Command names - exported for use by other modules
export const GET_IMAGE_AT_CURSOR_COMMAND = 'simpleImageResize-getImageAtCursor';
export const REPLACE_RANGE_COMMAND = 'simpleImageResize-replaceRange';
export const GET_IMAGE_DIMENSIONS_COMMAND = 'simpleImageResize-getImageDimensions';
export const IS_EDITOR_CONTEXT_MENU_ORIGIN_COMMAND = 'simpleImageResize-isEditorContextMenuOrigin';
export const MATCH_VIEWER_IMAGE_COMMAND = 'simpleImageResize-matchViewerImage';
export const SELECT_VIEWER_IMAGE_COMMAND = 'simpleImageResize-selectViewerImage';

// Time window to consider a context menu event as originating from the editor (in milliseconds)
const EDITOR_CONTEXT_MENU_EVENT_GRACE_MS = 400;

// Keep viewer context menus responsive when parsing a very large note.
const VIEWER_IMAGE_PARSE_TIMEOUT_MS = 200;

export interface ReplaceRangeArgs {
    text: string;
    from: EditorPosition;
    to: EditorPosition;
    expectedText: string;
}

export interface ImageNodeRange {
    type: ImageSyntax;
    from: number;
    to: number;
}

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

    // Validate from <= to
    if (from.line > to.line || (from.line === to.line && from.ch > to.ch)) {
        logger.error('REPLACE_RANGE_COMMAND: from must be <= to', { from, to });
        return false;
    }

    return true;
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
                });
                return;
            }

            // Case 2: Simple HTML tags in Markdown (HTMLTag node)
            if (node.name === 'HTMLTag') {
                const tagText = state.doc.sliceString(node.from, node.to);
                // Check if it's an img tag (self-closing or opening tag)
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
                // Find all <img> tags within the block
                const imgRegex = /<img\s[^>]*>/gi;
                let match: RegExpExecArray | null;
                while ((match = imgRegex.exec(blockText)) !== null) {
                    const imgStart = node.from + match.index;
                    const imgEnd = imgStart + match[0].length;
                    // Only include if the img tag intersects with the range
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
 * Find all image nodes on the current line using syntax tree.
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

    const details = extractImageDetails(doc.sliceString(image.from, image.to), image.type);
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
 * Get the image at cursor position using syntax tree.
 * This is the main detection function that replaces regex-based detection.
 */
export function getImageAtCursor(state: EditorState): EditorImageAtCursorResult | null {
    const cursor = state.selection.main.head;
    const images = findImagesOnLine(state);

    // Find the image that contains the cursor
    for (const imageNode of images) {
        const imageLine = state.doc.lineAt(imageNode.from);
        const lineTextBeforeImage = state.doc.sliceString(imageLine.from, imageNode.from);

        if (isCursorInImageActivationRange(lineTextBeforeImage, cursor, imageNode)) {
            const imageText = state.doc.sliceString(imageNode.from, imageNode.to);
            const details = extractImageDetails(imageText, imageNode.type);

            if (details) {
                // Convert absolute positions to line/ch format
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
 * Convert line/ch position to absolute document position.
 * CM6 doc.line() expects 1-indexed line numbers, so we convert
 * from our 0-indexed EditorPosition before calling it.
 */
export function posToOffset(doc: Text, pos: EditorPosition): number {
    // CM6 line() uses 1-indexed line numbers
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

export default function (): MarkdownEditorContentScriptModule {
    return {
        plugin: function (editorControl: CodeMirrorControl) {
            if (!editorControl?.cm6) {
                logger.warn('CodeMirror 6 not available; skipping content script commands.');
                return;
            }

            const view = editorControl.editor as EditorView;
            let lastEditorContextMenuAt = 0;
            let editorContextMenuOriginPending = false;

            // Track right-clicks in the editor to distinguish editor-origin
            // context menu opens from viewer-origin context menu opens.
            view.dom.addEventListener(
                'contextmenu',
                () => {
                    lastEditorContextMenuAt = Date.now();
                    editorContextMenuOriginPending = true;
                },
                true
            );

            editorControl.registerCommand(IS_EDITOR_CONTEXT_MENU_ORIGIN_COMMAND, (): boolean => {
                const wasRecentlyTriggeredInEditor =
                    editorContextMenuOriginPending &&
                    Date.now() - lastEditorContextMenuAt <= EDITOR_CONTEXT_MENU_EVENT_GRACE_MS;

                // Consume the marker so origin is bound to a single menu invocation.
                editorContextMenuOriginPending = false;

                return wasRecentlyTriggeredInEditor;
            });

            editorControl.registerCommand(MATCH_VIEWER_IMAGE_COMMAND, (target: unknown): boolean => {
                return isViewerImageTarget(target) && findImageForViewerTarget(view.state, target) !== null;
            });

            // Called after a viewer resize item is chosen. Does not scroll or focus the editor.
            editorControl.registerCommand(SELECT_VIEWER_IMAGE_COMMAND, (target: unknown): boolean => {
                try {
                    if (!isViewerImageTarget(target)) {
                        logger.warn('SELECT_VIEWER_IMAGE_COMMAND: invalid target', target);
                        return false;
                    }

                    const image = findImageForViewerTarget(view.state, target);
                    if (!image) {
                        logger.debug('SELECT_VIEWER_IMAGE_COMMAND: no matching image for target', target);
                        return false;
                    }

                    view.dispatch({ selection: { anchor: viewerImageCursorPosition(image) } });
                    return true;
                } catch (error) {
                    logger.error('SELECT_VIEWER_IMAGE_COMMAND: failed to select image', error);
                    return false;
                }
            });

            // Command: Get image at cursor using syntax tree (primary method)
            editorControl.registerCommand(GET_IMAGE_AT_CURSOR_COMMAND, (): EditorImageAtCursorResult | null => {
                try {
                    return getImageAtCursor(view.state);
                } catch (error) {
                    logger.error('getImageAtCursor failed:', error);
                    return null;
                }
            });

            // Command: Replace text in a range
            editorControl.registerCommand(
                REPLACE_RANGE_COMMAND,
                (text: unknown, from: unknown, to: unknown, expectedText: unknown): boolean => {
                    try {
                        const change = resolveReplaceChange(view.state.doc, { text, from, to, expectedText });
                        if (!change) {
                            return false;
                        }

                        view.dispatch({ changes: change });

                        return true;
                    } catch (err) {
                        logger.error('REPLACE_RANGE_COMMAND: failed to replace text', err);
                        return false;
                    }
                }
            );

            // Command: Get image dimensions by loading it in the editor context
            // This runs inside the editor webview which has access to local files
            editorControl.registerCommand(
                GET_IMAGE_DIMENSIONS_COMMAND,
                async (...args: unknown[]): Promise<ImageDimensions | null> => {
                    try {
                        const imagePath = args[0] as string;
                        if (!imagePath || typeof imagePath !== 'string') {
                            return null;
                        }

                        return await measureImageDimensions(imagePath, {
                            timeoutMs: RESOURCE_IMAGE_LOAD_TIMEOUT_MS,
                        });
                    } catch {
                        return null;
                    }
                }
            );
        },
    };
}
