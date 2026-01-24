/**
 * CodeMirror 6 content script for editor operations.
 *
 * Registers custom commands for:
 * - Image detection at cursor using syntax tree
 * - Text replacement at specified ranges
 * - Image dimension measurement (loads images in editor context)
 *
 * Enables image detection and editing on both desktop and mobile platforms.
 * The editor context has file access on mobile, allowing dimension fetching
 * for local resources that the main plugin context cannot access directly.
 */

import { syntaxTree } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { Text } from '@codemirror/state';
import type { CodeMirrorControl } from 'api/types';
import type { EditorImageAtCursorResult, EditorPosition } from '../types';
import { REGEX_PATTERNS, CONSTANTS } from '../constants';
import { decodeHtmlEntities } from '../utils/stringUtils';
import { logger } from '../logger';
import { measureImageDimensions, ImageDimensions } from '../utils/imageDimensionUtils';

// Command names - exported for use by other modules
export const GET_IMAGE_AT_CURSOR_COMMAND = 'simpleImageResize-getImageAtCursor';
export const REPLACE_RANGE_COMMAND = 'simpleImageResize-replaceRange';
export const GET_IMAGE_DIMENSIONS_COMMAND = 'simpleImageResize-getImageDimensions';

interface ReplaceRangeArgs {
    text: string;
    from: EditorPosition;
    to: EditorPosition;
    expectedText: string;
}

/**
 * Validates that range positions are logically correct (from <= to) and finite.
 * Checks for NaN, Infinity, and -Infinity which TypeScript's type system permits
 * but would break document operations.
 * @returns true if valid, false otherwise
 */
function validateRangePositions(args: ReplaceRangeArgs): boolean {
    const { from, to } = args;

    // Validate all position values are finite numbers (not NaN, Infinity, or -Infinity)
    if (
        !Number.isFinite(from.line) ||
        !Number.isFinite(from.ch) ||
        !Number.isFinite(to.line) ||
        !Number.isFinite(to.ch)
    ) {
        logger.error('REPLACE_RANGE_COMMAND: position values must be finite numbers', { from, to });
        return false;
    }

    // Validate from <= to
    if (from.line > to.line || (from.line === to.line && from.ch > to.ch)) {
        logger.error('REPLACE_RANGE_COMMAND: from must be <= to', { from, to });
        return false;
    }

    return true;
}

/**
 * Extract details from a Markdown image using simplified regex.
 */
function extractMarkdownDetails(imageText: string): Omit<EditorImageAtCursorResult, 'range'> | null {
    const match = imageText.match(REGEX_PATTERNS.MARKDOWN_EXTRACT);
    if (!match?.groups) return null;

    const { altText, src, title } = match.groups;

    // Determine if resource or external URL
    const resourceMatch = src.match(REGEX_PATTERNS.RESOURCE_ID);
    const urlMatch = src.match(REGEX_PATTERNS.EXTERNAL_URL);

    return {
        type: 'markdown',
        syntax: imageText,
        source: resourceMatch ? resourceMatch[1] : urlMatch ? urlMatch[1] : src,
        sourceType: resourceMatch ? 'resource' : 'external',
        altText: altText || '',
        title: title || '',
    };
}

/**
 * Extract details from HTML <img> tag using simplified regex.
 */
function extractHtmlDetails(imageText: string): Omit<EditorImageAtCursorResult, 'range'> | null {
    const srcMatch = imageText.match(REGEX_PATTERNS.HTML_SRC);
    if (!srcMatch) return null;

    const src = srcMatch[2]; // Group 2 contains the actual value (group 1 is the quote)
    const altMatch = imageText.match(REGEX_PATTERNS.HTML_ALT);
    const titleMatch = imageText.match(REGEX_PATTERNS.HTML_TITLE);

    // Determine if resource or external URL
    const resourceMatch = src.match(REGEX_PATTERNS.RESOURCE_ID);
    const urlMatch = src.match(REGEX_PATTERNS.EXTERNAL_URL);

    return {
        type: 'html',
        syntax: imageText,
        source: resourceMatch ? resourceMatch[1] : urlMatch ? urlMatch[1] : src,
        sourceType: resourceMatch ? 'resource' : 'external',
        altText: altMatch ? decodeHtmlEntities(altMatch[2]) : '', // Group 2 contains the value
        title: titleMatch ? decodeHtmlEntities(titleMatch[2]) : '', // Group 2 contains the value
    };
}

/**
 * Find all image nodes on the current line using syntax tree.
 * Returns both Markdown Image nodes and HTML img tags.
 *
 * Handles three cases:
 * 1. Markdown images: ![alt](url) - detected as Image nodes
 * 2. Simple HTML in Markdown: <img src="..."> - detected as HTMLTag nodes
 * 3. Nested HTML in Markdown: <div><img src="..."></div> - detected within HTMLBlock nodes
 */
function findImagesOnLine(view: EditorView): Array<{ type: 'markdown' | 'html'; from: number; to: number }> {
    const state = view.state;
    const cursor = state.selection.main.head;
    const currentLine = state.doc.lineAt(cursor);
    const images: Array<{ type: 'markdown' | 'html'; from: number; to: number }> = [];

    syntaxTree(state).iterate({
        from: currentLine.from,
        to: currentLine.to,
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
                    // Only include if the img tag intersects with current line
                    if (imgStart <= currentLine.to && imgEnd >= currentLine.from) {
                        images.push({
                            type: 'html',
                            from: imgStart,
                            to: imgEnd,
                        });
                    }
                }
                return;
            }
        },
    });

    return images;
}

/**
 * Get the image at cursor position using syntax tree.
 * This is the main detection function that replaces regex-based detection.
 */
function getImageAtCursor(view: EditorView): EditorImageAtCursorResult | null {
    const state = view.state;
    const cursor = state.selection.main.head;
    const images = findImagesOnLine(view);

    // Find the image that contains the cursor
    for (const imageNode of images) {
        if (cursor >= imageNode.from && cursor <= imageNode.to) {
            const imageText = state.doc.sliceString(imageNode.from, imageNode.to);
            const details =
                imageNode.type === 'markdown' ? extractMarkdownDetails(imageText) : extractHtmlDetails(imageText);

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
function posToOffset(doc: Text, pos: EditorPosition): number {
    // CM6 line() uses 1-indexed line numbers
    const lineNum = Math.max(1, Math.min(pos.line + 1, doc.lines));
    const lineInfo = doc.line(lineNum);
    const ch = Math.max(0, Math.min(pos.ch, lineInfo.to - lineInfo.from));
    return lineInfo.from + ch;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function (_context: { contentScriptId: string }) {
    return {
        plugin: function (editorControl: CodeMirrorControl) {
            if (!editorControl?.cm6) {
                logger.warn('CodeMirror 6 not available; skipping content script commands.');
                return;
            }

            // Command: Get image at cursor using syntax tree (primary method)
            editorControl.registerCommand(GET_IMAGE_AT_CURSOR_COMMAND, (): EditorImageAtCursorResult | null => {
                try {
                    const view = editorControl.editor as EditorView;
                    // Force view to sync/measure before reading cursor position
                    // This works around a timing issue where the view might not
                    // have synced with the cursor position update from the right-click event
                    // See: https://codemirror.net/docs/ref/#view.EditorView.requestMeasure
                    view.requestMeasure();

                    return getImageAtCursor(view);
                } catch (error) {
                    logger.error('getImageAtCursor failed:', error);
                    return null;
                }
            });

            // Command: Replace text in a range
            editorControl.registerCommand(REPLACE_RANGE_COMMAND, (...args: unknown[]): boolean => {
                try {
                    // Args can come as [text, from, to, expectedText] or as a single object
                    let replaceArgs: ReplaceRangeArgs;

                    if (args.length === 4) {
                        // Called as (text, from, to, expectedText)
                        replaceArgs = {
                            text: args[0] as string,
                            from: args[1] as EditorPosition,
                            to: args[2] as EditorPosition,
                            expectedText: args[3] as string,
                        };
                    } else if (args.length === 1 && typeof args[0] === 'object') {
                        // Called as ({ text, from, to, expectedText })
                        replaceArgs = args[0] as ReplaceRangeArgs;
                    } else {
                        logger.error('REPLACE_RANGE_COMMAND: invalid arguments format - expectedText is required');
                        return false;
                    }

                    // Validate arguments to prevent document corruption
                    if (!validateRangePositions(replaceArgs)) {
                        return false;
                    }

                    const { text, from, to, expectedText } = replaceArgs;
                    const view = editorControl.editor as EditorView;
                    const doc = view.state.doc;

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
                        return false;
                    }

                    view.dispatch({
                        changes: { from: fromOffset, to: toOffset, insert: text },
                    });

                    return true;
                } catch (err) {
                    logger.error('REPLACE_RANGE_COMMAND: failed to replace text', err);
                    return false;
                }
            });

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
                            timeoutMs: CONSTANTS.BASE64_TIMEOUT_MS,
                            usePrivacySettings: false,
                        });
                    } catch {
                        return null;
                    }
                }
            );
        },
    };
}
