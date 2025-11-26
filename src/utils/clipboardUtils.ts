import joplin from 'api';
import { ToastType } from 'api/types';
import { convertResourceToBase64 } from './resourceUtils';
import { showToast } from './toastUtils';
import { logger } from '../logger';
import { CONSTANTS } from '../constants';

/**
 * Converts an image source to a data URL.
 * Handles both Joplin resources and external URLs.
 */
async function getImageDataUrl(source: string, sourceType: 'resource' | 'external'): Promise<string> {
    if (sourceType === 'resource') {
        return await convertResourceToBase64(source);
    }

    // External image - fetch and convert to data URL with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONSTANTS.EXTERNAL_IMAGE_TIMEOUT_MS);
    try {
        const response = await fetch(source, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`Failed to fetch external image: ${response.status}`);
        }

        // Validate content-type to ensure we're fetching an image
        const contentType = response.headers.get('content-type');
        if (contentType && !contentType.startsWith('image/')) {
            throw new Error(`URL did not return an image (Content-Type: ${contentType})`);
        }
        if (!contentType) {
            logger.warn('External image fetch succeeded but Content-Type header is missing', { source });
        }

        const blob = await response.blob();
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read image data'));
            reader.readAsDataURL(blob);
        });
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Converts a modern image format (WebP, AVIF) to PNG using canvas.
 * Workaround for Joplin clipboard API limitations with modern image formats.
 */
// TODO: Remove this if https://github.com/laurent22/joplin/issues/12859 is addressed
async function convertToPNG(imageDataUrl: string, sourceFormat: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                ctx.drawImage(image, 0, 0);
                try {
                    const pngDataUrl = canvas.toDataURL('image/png');
                    resolve(pngDataUrl);
                } catch (err) {
                    if (err instanceof DOMException && err.name === 'SecurityError') {
                        reject(new Error('Canvas is tainted (CORS). Cannot convert to PNG.'));
                    } else {
                        reject(err);
                    }
                }
            } catch (err) {
                reject(err);
            }
        };

        image.onerror = () => {
            reject(new Error(`Failed to load image for ${sourceFormat} conversion`));
        };

        image.src = imageDataUrl;
    });
}

/**
 * Ensures the data URL is in a clipboard-compatible format.
 * Converts WebP and AVIF to PNG if needed due to Joplin clipboard API limitations.
 */
async function ensureClipboardCompatibleFormat(dataUrl: string): Promise<string> {
    if (dataUrl.startsWith('data:image/webp')) {
        logger.debug('Converting WebP image to PNG for clipboard compatibility');
        return await convertToPNG(dataUrl, 'WebP');
    }
    if (dataUrl.startsWith('data:image/avif')) {
        logger.debug('Converting AVIF image to PNG for clipboard compatibility');
        return await convertToPNG(dataUrl, 'AVIF');
    }
    return dataUrl;
}

/**
 * Copies an image to the clipboard.
 * Handles both Joplin resources and external URLs, with toast notifications.
 * Automatically converts WebP and AVIF images to PNG due to Joplin clipboard API limitations.
 */
export async function copyImageToClipboard(source: string, sourceType: 'resource' | 'external'): Promise<void> {
    try {
        let dataUrl = await getImageDataUrl(source, sourceType);
        dataUrl = await ensureClipboardCompatibleFormat(dataUrl);
        await joplin.clipboard.writeImage(dataUrl);
        await showToast('Image copied to clipboard', ToastType.Success);
    } catch (err) {
        logger.error('Error copying image to clipboard:', err);
        const message = err instanceof Error ? err.message : 'Unknown error occurred';
        await showToast(`Failed to copy image: ${message}`, ToastType.Error);
    }
}
