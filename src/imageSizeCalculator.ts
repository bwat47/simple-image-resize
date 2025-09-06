import { CONSTANTS } from './constants';
import { convertResourceToBase64, validateResourceId } from './utils';

export interface ImageDimensions {
    width: number;
    height: number;
}

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
    try {
        // Reuse the helper function to get a data URL
        const base64DataUrl = await convertResourceToBase64(resourceId);

        if (!base64DataUrl.startsWith('data:image')) {
            throw new Error('Resource is not a valid image');
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            const timeoutId = setTimeout(() => {
                img.src = ''; // Stop the image from loading in the background
                reject(new Error('Timeout: Could not load image to determine dimensions.'));
            }, CONSTANTS.BASE64_TIMEOUT_MS);

            img.onload = () => {
                clearTimeout(timeoutId);
                resolve({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                });
            };

            img.onerror = () => {
                clearTimeout(timeoutId);
                reject(new Error('Failed to load image for dimension measurement.'));
            };

            img.src = base64DataUrl;
        });
    } catch (err) {
        console.error(`[image-resize] Failed to get dimensions for resource ${resourceId}:`, err);
        throw new Error(`Could not determine image dimensions: ${err.message}`);
    }
}

async function getExternalImageDimensions(url: string): Promise<ImageDimensions> {
    // Validate URL format
    if (!isValidHttpUrl(url)) {
        throw new Error('Invalid external image URL');
    }

    try {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const timeoutId = setTimeout(() => {
                img.src = ''; // Cancel loading
                reject(new Error('Timeout: Could not load external image to determine dimensions.'));
            }, CONSTANTS.EXTERNAL_IMAGE_TIMEOUT_MS);

            img.onload = () => {
                clearTimeout(timeoutId);
                resolve({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                });
            };

            img.onerror = () => {
                clearTimeout(timeoutId);
                reject(new Error('Failed to load external image. Check URL and network connection.'));
            };

            // Set CORS if needed - some external images block cross-origin requests
            img.crossOrigin = 'anonymous';
            img.src = url;
        });
    } catch (err) {
        console.error(`[image-resize] Failed to get dimensions for external URL ${url}:`, err);
        throw new Error(`Could not determine external image dimensions: ${err.message}`);
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
