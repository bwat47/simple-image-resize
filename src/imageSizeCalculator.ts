import { CONSTANTS } from './constants';
import { convertResourceToBase64, validateResourceId } from './utils';
import { logger } from './logger';
import { ImageDimensions } from './types';

/**
 * Retrieves image dimensions from either a Joplin resource or external URL.
 *
 * Uses DOM Image probes for dimension detection:
 * - Resources: converted to base64 data URL, then loaded via DOM Image
 * - External: loaded directly via DOM Image with CORS/privacy safeguards
 *
 * @param source - Resource ID (32-char hex) or external URL
 * @param sourceType - Whether source is a Joplin resource or external URL
 * @returns Image width and height in pixels
 * @throws Error if dimensions cannot be determined
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
 * Get dimensions for a Joplin resource by converting to base64 and probing with DOM Image.
 */
async function getJoplinResourceDimensions(resourceId: string): Promise<ImageDimensions> {
    if (!validateResourceId(resourceId)) {
        throw new Error('Invalid resource ID');
    }

    try {
        const dataUrl = await convertResourceToBase64(resourceId);
        if (!dataUrl.startsWith('data:image')) {
            throw new Error('Resource is not a valid image');
        }
        return await measureImageFromDataUrl(dataUrl, CONSTANTS.BASE64_TIMEOUT_MS);
    } catch (err: unknown) {
        logger.error(`Failed to get dimensions for resource ${resourceId}:`, err);
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Could not determine image dimensions: ${message}`);
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
 * Measure image dimensions using a DOM Image from a data URL.
 */
async function measureImageFromDataUrl(dataUrl: string, timeoutMs: number): Promise<ImageDimensions> {
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

        img.src = dataUrl;
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
