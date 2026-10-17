/**
 * Plugin-side wrapper around the CodeMirror content script's commands.
 *
 * Every `editor.execCommand` call the host makes goes through this module, so
 * the rest of the plugin works with typed functions instead of command names.
 */

import joplin from 'api';
import type { EditorImageAtCursorResult, EditorRange, ImageDetails, ImageDimensions } from '../shared/types';
import { logger } from '../shared/logger';
import {
    GET_IMAGE_AT_CURSOR_COMMAND,
    GET_IMAGE_DIMENSIONS_COMMAND,
    IS_EDITOR_CONTEXT_MENU_ORIGIN_COMMAND,
    MATCH_VIEWER_IMAGE_COMMAND,
    REPLACE_RANGE_COMMAND,
    SELECT_VIEWER_IMAGE_COMMAND,
} from '../shared/editorCommands';
import { isValidImageDimensions } from '../shared/imageDimensionUtils';
import type { ViewerImageTarget } from '../shared/viewerImageTarget';

interface CursorDetectionResult {
    context: ImageDetails;
    range: EditorRange;
}

/**
 * Detects if the cursor is currently inside a valid image embed.
 * Returns the image context and range for replacement.
 *
 * Uses syntax tree-based detection in the content script for reliable detection.
 */
export async function detectImageAtCursor(): Promise<CursorDetectionResult | null> {
    try {
        const result = (await joplin.commands.execute('editor.execCommand', {
            name: GET_IMAGE_AT_CURSOR_COMMAND,
        })) as EditorImageAtCursorResult | null;

        if (!result) {
            return null;
        }

        const { range, ...context } = result;
        return { context, range };
    } catch (error) {
        logger.warn('Cursor detection failed:', error);
        return null;
    }
}

/**
 * Checks if we're in the markdown editor and cursor is on an image.
 * Used for conditional context menu display.
 */
export async function isOnImageInMarkdownEditor(): Promise<boolean> {
    try {
        // Check if cursor is on an image using the content script
        const detection = await detectImageAtCursor();
        return detection !== null;
    } catch {
        return false;
    }
}

/**
 * Checks if the current context menu invocation originated from the markdown editor.
 * Returns false for markdown viewer and other non-editor surfaces.
 */
export async function isEditorContextMenuOrigin(): Promise<boolean> {
    try {
        const result: unknown = await joplin.commands.execute('editor.execCommand', {
            name: IS_EDITOR_CONTEXT_MENU_ORIGIN_COMMAND,
        });

        return result === true;
    } catch (error) {
        logger.debug('Editor context menu origin check failed:', error);
        return false;
    }
}

/**
 * Checks whether a viewer image still matches the note source without moving the cursor.
 */
export async function matchesViewerImageInEditor(target: ViewerImageTarget): Promise<boolean> {
    try {
        return (
            (await joplin.commands.execute('editor.execCommand', {
                name: MATCH_VIEWER_IMAGE_COMMAND,
                args: [target],
            })) === true
        );
    } catch (error) {
        logger.debug('Matching viewer image in editor failed:', error);
        return false;
    }
}

/**
 * Moves the editor cursor onto an image right-clicked in the markdown viewer.
 * Returns false when the editor could not match the target to an image.
 */
export async function selectViewerImageInEditor(target: ViewerImageTarget): Promise<boolean> {
    try {
        const result: unknown = await joplin.commands.execute('editor.execCommand', {
            name: SELECT_VIEWER_IMAGE_COMMAND,
            args: [target],
        });

        return result === true;
    } catch (error) {
        logger.debug('Selecting viewer image in editor failed:', error);
        return false;
    }
}

/**
 * Replaces an image embed in the editor.
 * Uses a custom content script command for cross-platform support (desktop + mobile).
 * Returns false when the replacement was skipped, e.g. because the range no
 * longer contains `originalSyntax` after the note changed.
 */
export async function replaceRangeInEditor(
    newSyntax: string,
    replacementRange: EditorRange,
    originalSyntax: string
): Promise<boolean> {
    const result: unknown = await joplin.commands.execute('editor.execCommand', {
        name: REPLACE_RANGE_COMMAND,
        args: [newSyntax, replacementRange.from, replacementRange.to, originalSyntax],
    });

    return result === true;
}

/**
 * Measures an image by loading it in the editor context.
 * The editor has access to local files on mobile platforms, unlike the plugin host.
 */
export async function measureImageInEditor(imagePath: string): Promise<ImageDimensions | null> {
    try {
        const result: unknown = await joplin.commands.execute('editor.execCommand', {
            name: GET_IMAGE_DIMENSIONS_COMMAND,
            args: [imagePath],
        });

        return isValidImageDimensions(result) ? result : null;
    } catch (error) {
        logger.debug('Content script dimension fetch failed:', error);
        return null;
    }
}
