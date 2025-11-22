import joplin from 'api';
import { CONSTANTS } from './constants';
import { validateResourceId, convertResourceToBase64 } from './utils';
import { logger } from './logger';
import { ImageDimensions } from './types';
import { GET_IMAGE_DIMENSIONS_COMMAND } from './contentScripts/cursorContentScript';

/**
 * Retrieves image dimensions from either a Joplin resource or external URL.
 *
 * Uses platform-appropriate strategies for dimension detection:
 * - Resources: content script (Android/Desktop) → base64 (Web/Desktop) → defaults
 * - External: DOM Image with CORS/privacy safeguards
 *
 * @param source - Resource ID (32-char hex) or external URL
 * @param sourceType - Whether source is a Joplin resource or external URL
 * @returns Image width and height in pixels
 * @throws Error if dimensions cannot be determined (external only)
 */
export async function getOriginalImageDimensions(
    source: string,
    sourceType: 'resource' | 'external'
): Promise<ImageDimensions> {
    if (sourceType === 'resource') {
        return getJoplinResourceDimensions(source);
    } else {
        return getExternalImageDimensions(source);
    }
}

/**
 * Get dimensions for a Joplin resource using multiple fallback strategies:
 * 1. Content script (works on Android + Desktop)
 * 2. Base64 conversion (works on Web app + Desktop)
 * 3. Default dimensions (last resort)
 */
async function getJoplinResourceDimensions(resourceId: string): Promise<ImageDimensions> {
    if (!validateResourceId(resourceId)) {
        throw new Error('Invalid resource ID');
    }

    // Strategy 1: Try content script with resourcePath (works on Android + Desktop)
    try {
        const resourcePath = await joplin.data.resourcePath(resourceId);
        if (resourcePath) {
            logger.debug(`Trying content script with path: ${resourcePath}`);
            const contentScriptResult = await getImageDimensionsViaContentScript(resourcePath);
            if (contentScriptResult) {
                logger.debug(
                    `Content script returned dimensions: ${contentScriptResult.width}x${contentScriptResult.height}`
                );
                return contentScriptResult;
            }
        }
    } catch (err) {
        logger.debug('Content script approach failed:', err);
    }

    // Strategy 2: Try base64 conversion (works on Web app + Desktop)
    try {
        logger.debug(`Trying base64 conversion for: ${resourceId}`);
        const dataUrl = await convertResourceToBase64(resourceId);
        if (dataUrl.startsWith('data:image')) {
            const base64Result = await measureImageFromPath(dataUrl, CONSTANTS.BASE64_TIMEOUT_MS);
            logger.debug(`Base64 returned dimensions: ${base64Result.width}x${base64Result.height}`);
            return base64Result;
        }
    } catch (err) {
        logger.debug('Base64 approach failed:', err);
    }

    // Strategy 3: Return default dimensions as last resort
    logger.warn(`All dimension strategies failed for resource ${resourceId}, using defaults`);
    return {
        width: CONSTANTS.DEFAULT_EXTERNAL_WIDTH,
        height: CONSTANTS.DEFAULT_EXTERNAL_HEIGHT,
    };
}

/**
 * Get image dimensions via the content script running in the editor context.
 * This has access to local files on mobile platforms.
 */
async function getImageDimensionsViaContentScript(imagePath: string): Promise<ImageDimensions | null> {
    try {
        const result = (await joplin.commands.execute('editor.execCommand', {
            name: GET_IMAGE_DIMENSIONS_COMMAND,
            args: [imagePath],
        })) as ImageDimensions | null;

        if (result && typeof result.width === 'number' && typeof result.height === 'number') {
            return result;
        }
        return null;
    } catch (error) {
        logger.debug('Content script dimension fetch failed:', error);
        return null;
    }
}

/**
 * Get dimensions for an external image URL using DOM Image with privacy safeguards.
 */
async function getExternalImageDimensions(url: string): Promise<ImageDimensions> {
    if (!isValidHttpUrl(url)) {
        throw new Error('Invalid external image URL');
    }

    try {
        return await measureExternalImageFromUrl(url, CONSTANTS.EXTERNAL_IMAGE_TIMEOUT_MS);
    } catch (err: unknown) {
        logger.error(`Failed to get dimensions for external URL ${url}:`, err);
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Could not determine external image dimensions: ${message}`);
    }
}

function isValidHttpUrl(string: string): boolean {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Measure image dimensions using a DOM Image from a file path or URL.
 * Works with local file paths, file:// URLs, and data URLs.
 */
async function measureImageFromPath(path: string, timeoutMs: number): Promise<ImageDimensions> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const timeoutId = setTimeout(() => {
            img.src = '';
            reject(new Error('Timeout: Could not load image to determine dimensions.'));
        }, timeoutMs);

        img.onload = () => {
            clearTimeout(timeoutId);
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
                resolve({ width, height });
            } else {
                reject(new Error('Invalid image dimensions after load.'));
            }
        };

        img.onerror = () => {
            clearTimeout(timeoutId);
            reject(new Error('Failed to load image for dimension measurement.'));
        };

        img.src = path;
    });
}

/**
 * Measure external image dimensions using DOM Image directly from URL.
 * Uses privacy-friendly defaults to minimize tracking.
 */
async function measureExternalImageFromUrl(url: string, timeoutMs: number): Promise<ImageDimensions> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const timeoutId = setTimeout(() => {
            img.src = '';
            reject(new Error('Timeout: Could not load external image to determine dimensions.'));
        }, timeoutMs);

        img.onload = () => {
            clearTimeout(timeoutId);
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
                resolve({ width, height });
            } else {
                reject(new Error('Invalid external image dimensions after load.'));
            }
        };

        img.onerror = () => {
            clearTimeout(timeoutId);
            reject(new Error('Failed to load external image. Check URL and network connection.'));
        };

        // Privacy-friendly defaults; some hosts may block based on Referer
        img.crossOrigin = 'anonymous';
        (img as unknown as { referrerPolicy?: string }).referrerPolicy = 'no-referrer';
        img.src = url;
    });
}
