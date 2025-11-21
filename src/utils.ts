import joplin from 'api';
import { logger } from './logger';

/**
 * A simple validator for Joplin resource IDs (32-character hex string).
 */
export function validateResourceId(id: string): boolean {
    return !!id && typeof id === 'string' && /^[a-f0-9]{32}$/i.test(id);
}

/**
 * Converts binary data to base64 string using browser-compatible APIs.
 * Works in both Node.js and browser environments.
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Converts data to base64, handling various input formats that Joplin might return.
 * On desktop, file.body is typically an ArrayBuffer.
 * On mobile, it might be a string (already base64) or other format.
 */
function toBase64(data: unknown): string {
    // Already a base64 string
    if (typeof data === 'string') {
        // Check if it looks like base64 (no obvious binary characters)
        // If it's already base64, return as-is; otherwise try to encode it
        if (/^[A-Za-z0-9+/=]+$/.test(data)) {
            logger.debug('Data appears to be base64 string already');
            return data;
        }
        // It's a regular string, encode it
        logger.debug('Data is a string, encoding to base64');
        return btoa(data);
    }

    // ArrayBuffer or Uint8Array
    if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
        logger.debug('Data is ArrayBuffer/Uint8Array, converting to base64');
        return arrayBufferToBase64(data);
    }

    // Array of numbers (byte array) - sometimes returned on mobile
    if (Array.isArray(data)) {
        logger.debug('Data is Array, treating as byte array');
        const bytes = new Uint8Array(data);
        return arrayBufferToBase64(bytes);
    }

    // Object with numeric keys (array-like) - another possible mobile format
    if (typeof data === 'object' && data !== null) {
        const obj = data as Record<string, unknown>;
        // Check if it looks like an array-like object with numeric keys
        if ('0' in obj || 'length' in obj) {
            logger.debug('Data is array-like object, converting to Uint8Array');
            const length = (obj.length as number) || Object.keys(obj).filter((k) => /^\d+$/.test(k)).length;
            const bytes = new Uint8Array(length);
            for (let i = 0; i < length; i++) {
                bytes[i] = (obj[i] as number) || 0;
            }
            return arrayBufferToBase64(bytes);
        }
    }

    logger.warn('Unknown data format for base64 conversion:', typeof data, data);
    throw new Error(`Unknown data format: ${typeof data}`);
}

/**
 * Converts a Joplin resource to a base64 data URL, which can be used as an image src.
 */
export async function convertResourceToBase64(resourceId: string): Promise<string> {
    try {
        // Fetch resource metadata and file content separately.
        const resource = await joplin.data.get(['resources', resourceId], { fields: ['mime'] });
        const file = await joplin.data.get(['resources', resourceId, 'file']);

        logger.debug('Resource metadata:', resource);
        logger.debug('File object keys:', file ? Object.keys(file) : 'null');

        if (!resource || !file) {
            throw new Error('Resource not found or is empty.');
        }

        // The API returns an object with the data - check various possible properties
        const body = file.body ?? file.data ?? file;
        logger.debug('Body type:', typeof body, body instanceof ArrayBuffer ? 'ArrayBuffer' : '');

        if (!body) {
            throw new Error('Could not find file data in the fetched file object.');
        }

        const base64 = toBase64(body);
        const dataUrl = `data:${resource.mime};base64,${base64}`;

        // Log a preview of the data URL for debugging (first 100 chars)
        logger.debug('Data URL preview:', dataUrl.substring(0, 100) + '...');

        return dataUrl;
    } catch (err) {
        logger.error(`Error converting resource ${resourceId} to base64:`, err);
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Could not convert resource to base64: ${message}`);
    }
}
