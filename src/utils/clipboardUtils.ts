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
 * Copies an image to the clipboard.
 * Handles both Joplin resources and external URLs, with toast notifications.
 */
export async function copyImageToClipboard(source: string, sourceType: 'resource' | 'external'): Promise<void> {
    try {
        const dataUrl = await getImageDataUrl(source, sourceType);
        await joplin.clipboard.writeImage(dataUrl);
        await showToast('Image copied to clipboard.', ToastType.Success);
    } catch (err) {
        logger.error('Error copying image to clipboard:', err);
        const message = err instanceof Error ? err.message : 'Unknown error occurred';
        await showToast(`Failed to copy image: ${message}`, ToastType.Error);
        throw err;
    }
}
