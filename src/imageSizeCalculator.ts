import joplin from 'api';
import { CONSTANTS } from './constants';
import { convertResourceToBase64, validateResourceId } from './utils';
import { logger } from './logger';

export interface ImageDimensions {
    width: number;
    height: number;
}

/**
 * Retrieves image dimensions from either a Joplin resource or external URL.
 *
 * Uses Joplin Imaging API with fallback to DOM Image probes if needed.
 * For resources: falls back to base64 conversion. For external: uses CORS-friendly DOM Image.
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

async function getJoplinResourceDimensions(resourceId: string): Promise<ImageDimensions> {
    if (!validateResourceId(resourceId)) {
        throw new Error('Invalid resource ID');
    }
    let handle: string | undefined;
    try {
        // Primary path: Imaging API
        handle = await joplin.imaging.createFromResource(resourceId);
        const size = (await joplin.imaging.getSize(handle)) as { width: number; height: number };
        const { width, height } = size;
        if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
            return { width, height };
        }
        // Fall through to base64 fallback
        throw new Error('Invalid image dimensions returned by imaging API.');
    } catch (err: unknown) {
        logger.warn(`Imaging API failed to get resource dimensions for ${resourceId}, trying base64 fallback:`, err);
        // Fallback: convert to base64 and probe with DOM Image
        try {
            const dataUrl = await convertResourceToBase64(resourceId);
            if (!dataUrl.startsWith('data:image')) {
                throw new Error('Resource is not a valid image');
            }
            const dims = await measureImageFromDataUrl(dataUrl, CONSTANTS.BASE64_TIMEOUT_MS);
            return dims;
        } catch (err2: unknown) {
            logger.error(`Base64 fallback failed to get dimensions for resource ${resourceId}:`, err2);
            const e = err2 as { message?: unknown } | string;
            const msg = typeof e === 'object' && e && 'message' in e ? String(e.message) : String(err2);
            throw new Error(`Could not determine image dimensions: ${msg}`);
        }
    } finally {
        if (handle) await joplin.imaging.free(handle);
    }
}

async function getExternalImageDimensions(url: string): Promise<ImageDimensions> {
    // Validate URL format
    if (!isValidHttpUrl(url)) {
        throw new Error('Invalid external image URL');
    }
    let handle: string | undefined;
    try {
        // Imaging API downloads the file, then we can query its size
        handle = await joplin.imaging.createFromPath(url);
        const size = (await joplin.imaging.getSize(handle)) as { width: number; height: number };
        const { width, height } = size;
        if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
            return { width, height };
        }
        // Fall through to DOM-based measurement as a secondary fallback
        throw new Error('Invalid external image dimensions returned by imaging API.');
    } catch (err: unknown) {
        logger.warn(`Imaging API failed to get external dimensions for ${url}, trying DOM Image fallback:`, err);
        try {
            const dims = await measureExternalImageFromUrl(url, CONSTANTS.EXTERNAL_IMAGE_TIMEOUT_MS);
            return dims;
        } catch (err2: unknown) {
            logger.error(`Failed to get dimensions for external URL ${url}:`, err2);
            const e = err2 as { message?: unknown } | string;
            const msg = typeof e === 'object' && e && 'message' in e ? String(e.message) : String(err2);
            throw new Error(`Could not determine external image dimensions: ${msg}`);
        }
    } finally {
        if (handle) await joplin.imaging.free(handle);
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

// Helper: measure image dimensions using a DOM Image from a data URL
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

// Helper: measure external image using DOM Image directly from URL
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
