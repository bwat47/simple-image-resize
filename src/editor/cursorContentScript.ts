/**
 * CodeMirror 6 content script for editor operations.
 *
 * Registers custom commands for:
 * - Image detection at cursor
 * - Matching an image right-clicked in the markdown viewer to the note source,
 *   and moving the cursor onto it
 * - Telling whether a context menu was opened from the editor
 * - Text replacement at specified ranges
 * - Image dimension measurement (loads images in editor context)
 *
 * Enables image detection and editing on both desktop and mobile platforms.
 * The editor context has file access on mobile, allowing dimension fetching
 * for local resources that the main plugin context cannot access directly.
 *
 * The queries and document changes behind these commands live in
 * `editorImageQueries.ts`; this module only binds them to the editor view.
 */

import type { EditorView } from '@codemirror/view';
import type { CodeMirrorControl, MarkdownEditorContentScriptModule } from 'api/types';
import type { EditorImageAtCursorResult, ImageDimensions } from '../shared/types';
import { logger } from '../shared/logger';
import { measureImageDimensions, RESOURCE_IMAGE_LOAD_TIMEOUT_MS } from '../shared/imageDimensionUtils';
import { isViewerImageTarget } from '../shared/viewerImageTarget';
import {
    GET_IMAGE_AT_CURSOR_COMMAND,
    GET_IMAGE_DIMENSIONS_COMMAND,
    IS_EDITOR_CONTEXT_MENU_ORIGIN_COMMAND,
    MATCH_VIEWER_IMAGE_COMMAND,
    REPLACE_RANGE_COMMAND,
    SELECT_VIEWER_IMAGE_COMMAND,
} from '../shared/editorCommands';
import {
    findImageForViewerTarget,
    getImageAtCursor,
    resolveReplaceChange,
    viewerImageCursorPosition,
} from './editorImageQueries';

// Time window to consider a context menu event as originating from the editor (in milliseconds)
const EDITOR_CONTEXT_MENU_EVENT_GRACE_MS = 400;

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

            editorControl.registerCommand(GET_IMAGE_AT_CURSOR_COMMAND, (): EditorImageAtCursorResult | null => {
                try {
                    return getImageAtCursor(view.state);
                } catch (error) {
                    logger.error('getImageAtCursor failed:', error);
                    return null;
                }
            });

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

            // Runs in the editor webview, which can load local files the plugin host cannot on mobile.
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
