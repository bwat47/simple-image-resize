/**
 * CodeMirror 6 content script for editor operations.
 *
 * Registers custom commands for:
 * - Cursor position and line text retrieval
 * - Text replacement at specified ranges
 * - Image dimension measurement (loads images in editor context)
 *
 * Enables image detection and editing on both desktop and mobile platforms.
 * The editor context has file access on mobile, allowing dimension fetching
 * for local resources that the main plugin context cannot access directly.
 */

// Command names - exported for use by other modules
export const CURSOR_INFO_COMMAND = 'simpleImageResize-getCursorInfo';
export const REPLACE_RANGE_COMMAND = 'simpleImageResize-replaceRange';
export const GET_IMAGE_DIMENSIONS_COMMAND = 'simpleImageResize-getImageDimensions';

interface CursorInfo {
    line: number; // 0-indexed line number
    ch: number; // character position within line
    lineText: string; // full text of the line
}

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

// CodeMirror types (minimal definitions for what we use)
interface CMDoc {
    line(n: number): { from: number; to: number; text: string };
    lineAt(pos: number): { number: number; from: number; text: string };
    lines: number;
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
            // Command: Get cursor position and current line text
            codeMirrorWrapper.registerCommand(CURSOR_INFO_COMMAND, (): CursorInfo | null => {
                try {
                    const view = codeMirrorWrapper.editor;
                    const state = view.state;
                    const pos = state.selection.main.head;
                    const line = state.doc.lineAt(pos);

                    return {
                        line: line.number - 1, // Convert to 0-indexed
                        ch: pos - line.from,
                        lineText: line.text,
                    };
                } catch {
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
