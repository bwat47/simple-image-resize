/**
 * CodeMirror 6 content script for cursor detection.
 *
 * Registers a custom command that returns cursor position and line text,
 * enabling image detection on both desktop and mobile platforms.
 */

// Command name for getting cursor info - used by cursorDetection.ts
export const CURSOR_INFO_COMMAND = 'simpleImageResize-getCursorInfo';

interface CursorInfo {
    line: number; // 0-indexed line number
    ch: number; // character position within line
    lineText: string; // full text of the line
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function (_context: { contentScriptId: string }) {
    return {
        plugin: function (codeMirrorWrapper: {
            editor: {
                state: {
                    doc: { lineAt(pos: number): { number: number; from: number; text: string } };
                    selection: { main: { head: number } };
                };
            };
            registerCommand(name: string, callback: () => CursorInfo | null): void;
        }) {
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
        },
    };
}
