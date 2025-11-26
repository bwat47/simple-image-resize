/**
 * Shared utility for measuring image dimensions.
 * Used by both main plugin context and content script context.
 */

export interface ImageDimensions {
    width: number;
    height: number;
}

export interface MeasureImageOptions {
    timeoutMs: number;
    usePrivacySettings?: boolean; // For external URLs: sets crossOrigin and referrerPolicy
}

/**
 * Measure image dimensions using a DOM Image.
 * Works with local file paths, file:// URLs, data URLs, and external URLs.
 *
 * @param src - Image source (path, URL, or data URL)
 * @param options - Configuration options for timeout and privacy settings
 * @returns Promise that resolves with dimensions or rejects on error
 */
export async function measureImageDimensions(src: string, options: MeasureImageOptions): Promise<ImageDimensions> {
    const { timeoutMs, usePrivacySettings = false } = options;

    return new Promise((resolve, reject) => {
        const img = new Image();
        const timeoutId = setTimeout(() => {
            img.onload = img.onerror = null; // Remove handlers to prevent race conditions
            img.src = ''; // Attempt to abort loading
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
