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
import { REGEX_PATTERNS } from '../constants';
import { decodeHtmlEntities } from '../utils/stringUtils';
import { logger } from '../logger';

// Command names - exported for use by other modules
export const GET_IMAGE_AT_CURSOR_COMMAND = 'simpleImageResize-getImageAtCursor';
export const REPLACE_RANGE_COMMAND = 'simpleImageResize-replaceRange';
export const GET_IMAGE_DIMENSIONS_COMMAND = 'simpleImageResize-getImageDimensions';

interface EditorPosition {
    line: number; // 0-indexed line number
    ch: number; // character position within line
}

interface ReplaceRangeArgs {
    text: string;
    from: EditorPosition;
    to: EditorPosition;
}

interface ImageDimensions {
    width: number;
    height: number;
}

interface ImageAtCursorResult {
    type: 'markdown' | 'html';
    syntax: string;
    source: string;
    sourceType: 'resource' | 'external';
    altText: string;
    title: string;
    range: {
        from: EditorPosition;
        to: EditorPosition;
    };
}

// CodeMirror types (minimal definitions for what we use)
interface CMDoc {
    line(n: number): { from: number; to: number; text: string };
    lineAt(pos: number): { number: number; from: number; to: number; text: string };
    lines: number;
    sliceString(from: number, to: number): string;
}

interface CMState {
    doc: CMDoc;
    selection: { main: { head: number } };
}

interface CMView {
    state: CMState;
    dispatch(changes: { changes: { from: number; to: number; insert: string } }): void;
}

interface CodeMirrorWrapper {
    editor: CMView;
    registerCommand(name: string, callback: (...args: unknown[]) => unknown): void;
}

/**
 * Extract details from a Markdown image using simplified regex.
 */
function extractMarkdownDetails(imageText: string): Omit<ImageAtCursorResult, 'range'> | null {
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
function extractHtmlDetails(imageText: string): Omit<ImageAtCursorResult, 'range'> | null {
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
function findImagesOnLine(state: CMState): Array<{ type: 'markdown' | 'html'; from: number; to: number }> {
    const cursor = state.selection.main.head;
    const currentLine = state.doc.lineAt(cursor);
    const images: Array<{ type: 'markdown' | 'html'; from: number; to: number }> = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    syntaxTree(state as any).iterate({
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
function getImageAtCursor(state: CMState): ImageAtCursorResult | null {
    const cursor = state.selection.main.head;
    const images = findImagesOnLine(state);

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
function posToOffset(doc: CMDoc, pos: EditorPosition): number {
    // CM6 line() uses 1-indexed line numbers
    const lineNum = Math.max(1, Math.min(pos.line + 1, doc.lines));
    const lineInfo = doc.line(lineNum);
    const ch = Math.max(0, Math.min(pos.ch, lineInfo.to - lineInfo.from));
    return lineInfo.from + ch;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function (_context: { contentScriptId: string }) {
    return {
        plugin: function (codeMirrorWrapper: CodeMirrorWrapper) {
            // Command: Get image at cursor using syntax tree (primary method)
            codeMirrorWrapper.registerCommand(GET_IMAGE_AT_CURSOR_COMMAND, (): ImageAtCursorResult | null => {
                try {
                    const view = codeMirrorWrapper.editor;
                    return getImageAtCursor(view.state);
                } catch (error) {
                    logger.error('getImageAtCursor failed:', error);
                    return null;
                }
            });

            // Command: Replace text in a range
            codeMirrorWrapper.registerCommand(REPLACE_RANGE_COMMAND, (...args: unknown[]): boolean => {
                try {
                    // Args can come as [text, from, to] or as a single object
                    let replaceArgs: ReplaceRangeArgs;

                    if (args.length >= 3) {
                        // Called as (text, from, to)
                        replaceArgs = {
                            text: args[0] as string,
                            from: args[1] as EditorPosition,
                            to: args[2] as EditorPosition,
                        };
                    } else if (args.length === 1 && typeof args[0] === 'object') {
                        // Called as ({ text, from, to })
                        replaceArgs = args[0] as ReplaceRangeArgs;
                    } else {
                        return false;
                    }

                    const { text, from, to } = replaceArgs;
                    const view = codeMirrorWrapper.editor;
                    const doc = view.state.doc;

                    const fromOffset = posToOffset(doc, from);
                    const toOffset = posToOffset(doc, to);

                    view.dispatch({
                        changes: { from: fromOffset, to: toOffset, insert: text },
                    });

                    return true;
                } catch {
                    return false;
                }
            });

            // Command: Get image dimensions by loading it in the editor context
            // This runs inside the editor webview which has access to local files
            codeMirrorWrapper.registerCommand(
                GET_IMAGE_DIMENSIONS_COMMAND,
                (...args: unknown[]): Promise<ImageDimensions | null> => {
                    return new Promise((resolve) => {
                        try {
                            const imagePath = args[0] as string;
                            if (!imagePath || typeof imagePath !== 'string') {
                                resolve(null);
                                return;
                            }

                            const img = new Image();
                            const timeoutId = setTimeout(() => {
                                img.src = '';
                                resolve(null);
                            }, 5000);

                            img.onload = () => {
                                clearTimeout(timeoutId);
                                const width = img.naturalWidth;
                                const height = img.naturalHeight;
                                if (width > 0 && height > 0) {
                                    resolve({ width, height });
                                } else {
                                    resolve(null);
                                }
                            };

                            img.onerror = () => {
                                clearTimeout(timeoutId);
                                resolve(null);
                            };

                            img.src = imagePath;
                        } catch {
                            resolve(null);
                        }
                    });
                }
            );
        },
    };
}
