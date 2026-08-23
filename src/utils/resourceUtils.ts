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

function failUnknownFormat(shape: string): never {
    logger.debug(`toUint8Array: Unknown data type: ${shape}`);
    throw new Error(`Unknown resource data format: ${shape}`);
}

/**
 * Reads the web app shape: a Buffer that Joplin's IPC deep-copied key by key, so
 * the byte indices arrive as own properties. Keys the walk picked up off the
 * prototype are ignored.
 */
function bytesFromObject(object: Record<string | number, unknown>): Uint8Array<ArrayBuffer> {
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
 * Normalizes the binary formats returned by Joplin into a byte array.
 *
 * The Data API always reads the file as a Node Buffer; what reaches the plugin
 * depends on how that Buffer crosses into the plugin sandbox:
 * - Desktop: Electron IPC structured-clones it into a Uint8Array.
 * - Web app: RemoteMessenger has no case for typed arrays (its SerializableData
 *   covers only ArrayBuffer, Blob, and FileSystemHandle), so it deep-copies the
 *   Buffer with for...in, yielding {0: 137, 1: 80, ...}.
 *
 * Desktop and the web app each produce one of those. The ArrayBuffer branch is defensive,
 * as is the Blob guard in getResourceBlob: those are two of the three types Joplin's
 * IPC passes through untouched, so either could appear if the transport ever stops
 * deep-copying the Buffer. Nothing produces them today.
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

    if (typeof data === 'object' && data !== null) {
        return bytesFromObject(data as Record<string | number, unknown>);
    }

    failUnknownFormat(typeof data);
}

/**
 * Loads a Joplin image resource into a Blob.
 * Works on desktop and the web app. Native mobile cannot transport the Buffer
 * returned by the resource file endpoint through the plugin API.
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

        // Blob is one of the three types Joplin's plugin IPC passes through untouched,
        // so it is the likeliest shape to appear if the transport ever stops deep-copying
        // the Buffer. Nothing produces it today.
        if (body instanceof Blob) {
            if (body.size === 0) {
                throw new Error('Resource file data is empty.');
            }
            return body.type ? body : new Blob([body], { type: resource.mime });
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
