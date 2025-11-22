import joplin from 'api';
import { REGEX_PATTERNS } from './constants';
import { detectImageSyntax } from './imageDetection';
import { ImageContext, EditorRange } from './types';
import { logger } from './logger';
import { CURSOR_INFO_COMMAND } from './contentScripts/cursorContentScript';

interface CursorDetectionResult {
    context: Omit<ImageContext, 'originalDimensions'>;
    range: EditorRange;
}

interface CursorInfo {
    line: number;
    ch: number;
    lineText: string;
}

/**
 * Gets cursor info using the content script command.
 * This approach works on both desktop and mobile platforms.
 */
async function getCursorInfoViaContentScript(): Promise<CursorInfo | null> {
    try {
        const result = (await joplin.commands.execute('editor.execCommand', {
            name: CURSOR_INFO_COMMAND,
        })) as CursorInfo | null;

        if (
            result &&
            typeof result.line === 'number' &&
            typeof result.ch === 'number' &&
            typeof result.lineText === 'string'
        ) {
            return result;
        }
        return null;
    } catch (error) {
        logger.debug('Content script cursor detection not available:', error);
        return null;
    }
}

/**
 * Detects if the cursor is currently inside a valid image embed.
 * Returns the image context and range for replacement.
 *
 * Uses content script for cursor detection which works on both desktop and mobile.
 */
export async function detectImageAtCursor(): Promise<CursorDetectionResult | null> {
    try {
        const cursorInfo = await getCursorInfoViaContentScript();

        if (!cursorInfo) {
            logger.warn('Could not get cursor info');
            return null;
        }

        const { line, ch, lineText } = cursorInfo;

        if (!lineText) return null;

        // Find all image matches on the current line
        const allMatches = [
            ...Array.from(lineText.matchAll(REGEX_PATTERNS.MARKDOWN_IMAGE_GLOBAL)),
            ...Array.from(lineText.matchAll(REGEX_PATTERNS.HTML_IMAGE_GLOBAL)),
        ];

        // Check if cursor is inside any image match
        for (const match of allMatches) {
            if (match.index === undefined) continue;

            const startCh = match.index;
            const endCh = match.index + match[0].length;

            // Check if cursor is within this image's bounds
            if (ch >= startCh && ch <= endCh) {
                const partialContext = detectImageSyntax(match[0]);

                if (partialContext) {
                    return {
                        context: partialContext,
                        range: {
                            from: { line, ch: startCh },
                            to: { line, ch: endCh },
                        },
                    };
                }
            }
        }

        return null;
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
