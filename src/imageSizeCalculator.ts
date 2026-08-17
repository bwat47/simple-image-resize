import joplin from 'api';
import { getResourceBlob, validateResourceId } from './utils/resourceUtils';
import { logger } from './logger';
import { ImageDimensions } from './types';
import { GET_IMAGE_DIMENSIONS_COMMAND } from './contentScripts/cursorContentScript';
import {
    measureBlobImageDimensions,
    measureImageDimensions,
    EXTERNAL_IMAGE_LOAD_TIMEOUT_MS,
    RESOURCE_IMAGE_LOAD_TIMEOUT_MS,
} from './utils/imageDimensionUtils';

export const FALLBACK_IMAGE_DIMENSIONS = {
    width: 400,
    height: 300,
} as const;

//TODO: Look into simplifying image dimension retrieval if https://github.com/laurent22/joplin/issues/12099 is addressed

/**
 * Retrieves image dimensions from either a Joplin resource or external URL.
 *
 * Uses platform-appropriate strategies for dimension detection:
 * - Resources: content script (works on Android/Desktop) → Blob URL (less efficient fallback that works on all platforms) → defaults
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
 * 2. Blob URL created from resource bytes (works on all platforms)
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

    // Strategy 2: Try a Blob URL created from resource bytes (works on Web app + Desktop)
    try {
        logger.debug(`Trying resource Blob for: ${resourceId}`);
        const blob = await getResourceBlob(resourceId);
        const blobResult = await measureBlobImageDimensions(blob, {
            timeoutMs: RESOURCE_IMAGE_LOAD_TIMEOUT_MS,
        });
        logger.debug(`Resource Blob returned dimensions: ${blobResult.width}x${blobResult.height}`);
        return blobResult;
    } catch (err) {
        logger.debug('Resource Blob approach failed:', err);
    }

    // Strategy 3: Return default dimensions as last resort
    logger.warn(`All dimension strategies failed for resource ${resourceId}, using defaults`);
    return { ...FALLBACK_IMAGE_DIMENSIONS };
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
        return await measureImageDimensions(url, {
            timeoutMs: EXTERNAL_IMAGE_LOAD_TIMEOUT_MS,
            usePrivacySettings: true,
        });
    } catch (err: unknown) {
        logger.error(`Failed to get dimensions for external URL ${url}:`, err);
        const message = err instanceof Error ? err.message : String(err);
        throw Object.assign(new Error(`Could not determine external image dimensions: ${message}`), { cause: err });
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
