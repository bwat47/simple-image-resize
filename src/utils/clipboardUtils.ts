import joplin from 'api';
import { ToastType } from 'api/types';
import { convertResourceToBase64 } from './resourceUtils';
import { showToast } from './toastUtils';
import { logger } from '../logger';

/**
 * Converts an image source to a data URL.
 * Handles both Joplin resources and external URLs.
 */
async function getImageDataUrl(source: string, sourceType: 'resource' | 'external'): Promise<string> {
    if (sourceType === 'resource') {
        return await convertResourceToBase64(source);
    }

    // External image - fetch and convert to data URL
    const response = await fetch(source);
    if (!response.ok) {
        throw new Error(`Failed to fetch external image: ${response.status}`);
    }
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image data'));
        reader.readAsDataURL(blob);
    });
}

/**
 * Converts a WebP data URL to PNG using canvas.
 * Workaround for Joplin clipboard API bug with WebP images.
 */
// TODO: Remove this if https://github.com/laurent22/joplin/issues/12859 is addressed

async function convertWebPToPNG(webpDataUrl: string): Promise<string> {
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
                const pngDataUrl = canvas.toDataURL('image/png');
                resolve(pngDataUrl);
            } catch (err) {
                reject(err);
            }
        };

        image.onerror = () => {
            reject(new Error('Failed to load image for WebP conversion'));
        };

        image.src = webpDataUrl;
    });
}

/**
 * Ensures the data URL is in a clipboard-compatible format.
 * Converts WebP to PNG if needed due to Joplin clipboard API limitations.
 */
async function ensureClipboardCompatibleFormat(dataUrl: string): Promise<string> {
    if (dataUrl.startsWith('data:image/webp')) {
        logger.debug('Converting WebP image to PNG for clipboard compatibility');
        return await convertWebPToPNG(dataUrl);
    }
    return dataUrl;
}

/**
 * Copies an image to the clipboard.
 * Handles both Joplin resources and external URLs, with toast notifications.
 * Automatically converts WebP images to PNG due to Joplin clipboard API limitations.
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
