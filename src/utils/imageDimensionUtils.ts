/**
 * Shared utility for measuring image dimensions.
 * Used by both main plugin context and content script context.
 */

import type { ImageDimensions } from '../types';

export interface MeasureImageOptions {
    timeoutMs: number;
    useNoReferrer?: boolean;
}

/**
 * Image load timeouts used by imageSizeCalculator and cursorContentScript.
 */
export const RESOURCE_IMAGE_LOAD_TIMEOUT_MS = 5000;
// Longer than the resource timeout because external images cross the network.
export const EXTERNAL_IMAGE_LOAD_TIMEOUT_MS = 10000;

/**
 * Check that a value contains finite, positive image dimensions.
 */
export function isValidImageDimensions(value: unknown): value is ImageDimensions {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const dimensions = value as Partial<ImageDimensions>;
    return (
        typeof dimensions.width === 'number' &&
        Number.isFinite(dimensions.width) &&
        dimensions.width > 0 &&
        typeof dimensions.height === 'number' &&
        Number.isFinite(dimensions.height) &&
        dimensions.height > 0
    );
}

/**
 * Measure image dimensions using a DOM Image.
 * Works with local file paths, file:// URLs, blob: object URLs, and external URLs.
 *
 * @param src - Image source (path or URL)
 * @param options - Configuration options for timeout and referrer privacy
 * @returns Promise that resolves with dimensions or rejects on error
 */
export async function measureImageDimensions(src: string, options: MeasureImageOptions): Promise<ImageDimensions> {
    const { timeoutMs, useNoReferrer = false } = options;

    return new Promise((resolve, reject) => {
        const img = new Image();
        const timeoutId = setTimeout(() => {
            img.onload = img.onerror = null; // Remove handlers to prevent race conditions
            img.src = ''; // Attempt to abort loading
            reject(new Error('Timeout: Could not load image to determine dimensions.'));
        }, timeoutMs);

        img.onload = () => {
            clearTimeout(timeoutId);
            const dimensions = { width: img.naturalWidth, height: img.naturalHeight };
            if (isValidImageDimensions(dimensions)) {
                resolve(dimensions);
            } else {
                reject(new Error('Invalid image dimensions after load.'));
            }
        };

        img.onerror = () => {
            clearTimeout(timeoutId);
            reject(new Error('Failed to load image for dimension measurement.'));
        };

        // Avoid disclosing the note's origin when measuring external images.
        if (useNoReferrer) {
            (img as unknown as { referrerPolicy?: string }).referrerPolicy = 'no-referrer';
        }

        img.src = src;
    });
}

/**
 * Measure image dimensions from a Blob using a temporary object URL.
 * The URL is always revoked after the image finishes loading or fails.
 */
export async function measureBlobImageDimensions(blob: Blob, options: MeasureImageOptions): Promise<ImageDimensions> {
    const objectUrl = URL.createObjectURL(blob);
    try {
        return await measureImageDimensions(objectUrl, options);
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}
