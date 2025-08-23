import joplin from 'api';

/**
 * A simple validator for Joplin resource IDs (32-character hex string).
 */
export function validateResourceId(id: string): boolean {
  return !!id && typeof id === 'string' && /^[a-f0-9]{32}$/i.test(id);
}

/**
 * Converts a Joplin resource to a base64 data URL, which can be used as an image src.
 */
export async function convertResourceToBase64(resourceId: string): Promise<string> {
  try {
    // Fetch resource metadata and file content separately.
    const resource = await joplin.data.get(['resources', resourceId], { fields: ['mime'] });
    const file = await joplin.data.get(['resources', resourceId, 'file']);

    if (!resource || !file) {
      throw new Error('Resource not found or is empty.');
    }

    // The API returns an object, and the ArrayBuffer is expected to be in the `body` property.
    if (!file.body) {
      throw new Error('Could not find a `body` property in the fetched file object.');
    }

    const buffer = Buffer.from(file.body);
    const base64 = buffer.toString('base64');

    return `data:${resource.mime};base64,${base64}`;
  } catch (err) {
    console.error(`[Image Resize] Error converting resource ${resourceId} to base64:`, err);
    throw new Error(`Could not convert resource to base64: ${err.message}`);
  }
}
