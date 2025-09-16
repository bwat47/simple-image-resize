import joplin from 'api';
import { REGEX_PATTERNS } from './constants';
import { detectImageSyntax } from './imageDetection';
import { ImageContext, EditorPosition, EditorRange } from './types';

export interface CursorDetectionResult {
    context: Omit<ImageContext, 'originalDimensions'>;
    range: EditorRange;
}

/**
 * Detects if the cursor is currently inside a valid image embed.
 * Returns the image context and range for replacement.
 */
export async function detectImageAtCursor(): Promise<CursorDetectionResult | null> {
    try {
        const cursor = (await joplin.commands.execute('editor.execCommand', {
            name: 'getCursor',
        })) as EditorPosition;

        if (!cursor) return null;

        const lineText = (await joplin.commands.execute('editor.execCommand', {
            name: 'getLine',
            args: [cursor.line],
        })) as string;

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
            if (cursor.ch >= startCh && cursor.ch <= endCh) {
                const partialContext = detectImageSyntax(match[0]);

                if (partialContext) {
                    return {
                        context: { ...partialContext, originalSelection: match[0] },
                        range: {
                            from: { line: cursor.line, ch: startCh },
                            to: { line: cursor.line, ch: endCh },
                        },
                    };
                }
            }
        }

        return null;
    } catch (error) {
        console.warn('[Image Resize] Cursor detection failed:', error);
        return null;
    }
}

/**
 * Checks if we're in the markdown editor and cursor is on an image.
 * Used for conditional context menu display.
 */
export async function isOnImageInMarkdownEditor(): Promise<boolean> {
    try {
        // First check if we're in markdown editor
        await joplin.commands.execute('editor.execCommand', { name: 'getCursor' });

        // Then check if cursor is on an image
        const detection = await detectImageAtCursor();
        return detection !== null;
    } catch {
        return false;
    }
}
