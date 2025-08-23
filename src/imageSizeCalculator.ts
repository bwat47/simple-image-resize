import { CONSTANTS } from './constants';
import { convertResourceToBase64, validateResourceId } from './utils';

export interface ImageDimensions {
  width: number;
  height: number;
}

export async function getOriginalImageDimensions(
  resourceId: string
): Promise<ImageDimensions> {
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
    console.error(`[image-resize] Failed to get dimensions for ${resourceId}:`, err);
    throw new Error(`Could not determine image dimensions: ${err.message}`);
  }
}
