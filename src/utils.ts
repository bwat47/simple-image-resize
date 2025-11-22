import joplin from 'api';
import { logger } from './logger';

/**
 * A simple validator for Joplin resource IDs (32-character hex string).
 */
export function validateResourceId(id: string): boolean {
    return !!id && typeof id === 'string' && /^[a-f0-9]{32}$/i.test(id);
}

/**
 * Converts binary data to base64 string using the FileReader API.
 */
async function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): Promise<string> {
    const blob = new Blob([buffer as BlobPart]);
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1]);
        };
        reader.onerror = () => reject(new Error('FileReader error'));
        reader.readAsDataURL(blob);
    });
}

/**
 * Converts data to base64, handling the formats Joplin returns:
 * - Desktop: ArrayBuffer/Uint8Array
 * - Web app: Object with numeric keys (e.g., {0: 137, 1: 80, ...})
 */
async function toBase64(data: unknown): Promise<string> {
    // ArrayBuffer or Uint8Array (desktop)
    if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
        return await arrayBufferToBase64(data);
    }

    // Object with numeric keys (web app) - check for array-like structure
    if (typeof data === 'object' && data !== null) {
        const obj = data as Record<string | number, number>;
        if ('0' in obj || 'length' in obj) {
            const length =
                typeof obj.length === 'number' ? obj.length : Object.keys(obj).filter((k) => /^\d+$/.test(k)).length;
            const bytes = new Uint8Array(length);
            for (let i = 0; i < length; i++) {
                bytes[i] = obj[i] ?? 0;
            }
            return await arrayBufferToBase64(bytes);
        }
    }

    throw new Error(`Unknown data format: ${typeof data}`);
}

/**
 * Converts a Joplin resource to a base64 data URL for use as an image src.
 * Works on Desktop and Web app (not Android - use resourcePath approach instead).
 */
export async function convertResourceToBase64(resourceId: string): Promise<string> {
    try {
        const resource = await joplin.data.get(['resources', resourceId], { fields: ['mime'] });
        const file = await joplin.data.get(['resources', resourceId, 'file']);

        if (!resource || !file) {
            throw new Error('Resource not found or is empty.');
        }

        const body = file.body ?? file;
        if (!body) {
            throw new Error('Could not find file data.');
        }

        const base64 = await toBase64(body);
        return `data:${resource.mime};base64,${base64}`;
    } catch (err) {
        logger.debug(`Error converting resource ${resourceId} to base64:`, err);
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Could not convert resource to base64: ${message}`);
    }
}
