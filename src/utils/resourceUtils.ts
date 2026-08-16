import joplin from 'api';
import { logger } from '../logger';

/**
 * A simple validator for Joplin resource IDs (32-character hex string).
 */
export function validateResourceId(id: string): boolean {
    return !!id && typeof id === 'string' && /^[a-f0-9]{32}$/i.test(id);
}

function validateByte(value: unknown, index: number): number {
    if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 255) {
        throw new Error(`Invalid byte value at index ${index}`);
    }
    return value as number;
}

function copyByteValues(values: ArrayLike<unknown>): Uint8Array<ArrayBuffer> {
    const bytes = new Uint8Array(values.length);
    for (let index = 0; index < values.length; index++) {
        bytes[index] = validateByte(values[index], index);
    }
    return bytes;
}

function failUnknownFormat(shape: string): never {
    logger.debug(`toUint8Array: Unknown data type: ${shape}`);
    throw new Error(`Unknown resource data format: ${shape}`);
}

/**
 * Reads the two shapes a Buffer arrives in from the web app: index properties
 * carried on the object itself, or the Buffer#toJSON form with a nested array.
 */
function bytesFromObject(object: Record<string | number, unknown>): Uint8Array<ArrayBuffer> {
    // Buffer#toJSON form: { type: 'Buffer', data: [137, 80, ...] }. Checked before
    // Object.keys(), which allocates a string per byte on the numeric-key form.
    if (Array.isArray(object.data)) {
        logger.debug(`toUint8Array: Received nested data array (${object.data.length} bytes)`);
        return copyByteValues(object.data);
    }

    const keys = Object.keys(object);
    const numericKeys = keys.filter((key) => /^\d+$/.test(key));
    logger.debug(`toUint8Array: Object with ${keys.length} total keys, ${numericKeys.length} numeric keys`);

    if (numericKeys.length === 0) {
        failUnknownFormat(`object with keys [${keys.slice(0, 5).join(', ')}]`);
    }

    const bytes = new Uint8Array(numericKeys.length);
    for (let index = 0; index < numericKeys.length; index++) {
        if (!Object.prototype.hasOwnProperty.call(object, index)) {
            throw new Error(`Sparse resource data at missing index ${index}`);
        }
        bytes[index] = validateByte(object[index], index);
    }
    return bytes;
}

/**
 * Normalizes the binary formats returned by Joplin into a byte array:
 * - Desktop: ArrayBuffer or an ArrayBuffer view
 * - Web app: Array, or a Buffer in either of its two serialized forms - carrying
 *   contiguous numeric keys ({0: 137, 1: 80, ...}, nonnumeric metadata ignored),
 *   or the Buffer#toJSON form ({type: 'Buffer', data: [137, 80, ...]}).
 */
function toUint8Array(data: unknown): Uint8Array<ArrayBuffer> {
    if (data instanceof ArrayBuffer) {
        logger.debug('toUint8Array: Received ArrayBuffer');
        return new Uint8Array(data);
    }

    if (ArrayBuffer.isView(data)) {
        logger.debug('toUint8Array: Received ArrayBuffer view');
        const view = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        return Uint8Array.from(view);
    }

    if (Array.isArray(data)) {
        logger.debug('toUint8Array: Received Array');
        return copyByteValues(data);
    }

    if (typeof data === 'object' && data !== null) {
        return bytesFromObject(data as Record<string | number, unknown>);
    }

    failUnknownFormat(typeof data);
}

/**
 * Loads a Joplin image resource into a Blob.
 * Works on Desktop and Web app (not Android, where the resourcePath approach is used instead).
 */
export async function getResourceBlob(resourceId: string): Promise<Blob> {
    try {
        const resource = await joplin.data.get(['resources', resourceId], { fields: ['mime'] });
        const file = await joplin.data.get(['resources', resourceId, 'file']);

        if (!resource || !file) {
            throw new Error('Resource not found or is empty.');
        }

        if (typeof resource.mime !== 'string' || !resource.mime.toLowerCase().startsWith('image/')) {
            throw new Error('Resource is not an image.');
        }

        const body = file.body ?? file;
        if (body === null || body === undefined) {
            throw new Error('Could not find file data.');
        }

        const bytes = toUint8Array(body);
        if (bytes.byteLength === 0) {
            throw new Error('Resource file data is empty.');
        }

        return new Blob([bytes], { type: resource.mime });
    } catch (err) {
        logger.debug(`Error loading resource ${resourceId} as a Blob:`, err);
        const message = err instanceof Error ? err.message : String(err);
        throw Object.assign(new Error(`Could not create resource Blob: ${message}`), { cause: err });
    }
}
