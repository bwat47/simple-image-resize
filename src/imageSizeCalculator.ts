import joplin from 'api';
import { CONSTANTS } from './constants';
import { validateResourceId, convertResourceToBase64 } from './utils/resourceUtils';
import { logger } from './logger';
import { ImageDimensions } from './types';
import { GET_IMAGE_DIMENSIONS_COMMAND } from './contentScripts/cursorContentScript';

//TODO: Look into simplifying image dimension retrieval if https://github.com/laurent22/joplin/issues/12099 is addressed

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
            const base64Result = await measureImage(dataUrl, { timeoutMs: CONSTANTS.BASE64_TIMEOUT_MS });
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
        return await measureImage(url, {
            timeoutMs: CONSTANTS.EXTERNAL_IMAGE_TIMEOUT_MS,
            usePrivacySettings: true,
        });
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

interface MeasureImageOptions {
    timeoutMs: number;
    usePrivacySettings?: boolean; // For external URLs: sets crossOrigin and referrerPolicy
}

/**
 * Measure image dimensions using a DOM Image.
 * Works with local file paths, file:// URLs, data URLs, and external URLs.
 */
async function measureImage(src: string, options: MeasureImageOptions): Promise<ImageDimensions> {
    const { timeoutMs, usePrivacySettings = false } = options;

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

        // Privacy-friendly defaults for external URLs to minimize tracking
        if (usePrivacySettings) {
            img.crossOrigin = 'anonymous';
            (img as unknown as { referrerPolicy?: string }).referrerPolicy = 'no-referrer';
        }

        img.src = src;
    });
}
