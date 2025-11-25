import joplin from 'api';
import { ImageContext, EditorRange } from './types';
import { logger } from './logger';
import { GET_IMAGE_AT_CURSOR_COMMAND } from './contentScripts/cursorContentScript';

interface CursorDetectionResult {
    context: Omit<ImageContext, 'originalDimensions'>;
    range: EditorRange;
}

interface ImageAtCursorResult {
    type: 'markdown' | 'html';
    syntax: string;
    source: string;
    sourceType: 'resource' | 'external';
    altText: string;
    title: string;
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
        })) as ImageAtCursorResult | null;

        if (!result) {
            return null;
        }

        return {
            context: {
                type: result.type,
                syntax: result.syntax,
                source: result.source,
                sourceType: result.sourceType,
                altText: result.altText,
                title: result.title,
            },
            range: result.range,
        };
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
