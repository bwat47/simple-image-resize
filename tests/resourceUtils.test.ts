import joplin from 'api';
import type { Mock } from 'vitest';
import { getResourceBlob } from '../src/utils/resourceUtils';

const RESOURCE_ID = '0123456789abcdef0123456789abcdef';
const getMock = joplin.data.get as Mock;

function mockResource(data: unknown, mime = 'image/png', wrapped = false): void {
    getMock.mockResolvedValueOnce({ mime }).mockResolvedValueOnce(wrapped ? { body: data } : data);
}

async function blobBytes(blob: Blob): Promise<number[]> {
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
}

describe('getResourceBlob', () => {
    beforeEach(() => {
        getMock.mockReset();
    });

    it.each([
        ['ArrayBuffer', () => Uint8Array.from([137, 80, 78, 71]).buffer],
        ['Uint8Array', () => Uint8Array.from([137, 80, 78, 71])],
        ['Buffer-compatible view', () => Buffer.from([137, 80, 78, 71])],
        ['number array', () => [137, 80, 78, 71]],
        ['numeric-key object', () => ({ 0: 137, 1: 80, 2: 78, 3: 71 })],
    ])('normalizes a %s response', async (_label, createData) => {
        mockResource(createData());

        const blob = await getResourceBlob(RESOURCE_ID);

        expect(blob.type).toBe('image/png');
        expect(await blobBytes(blob)).toEqual([137, 80, 78, 71]);
    });

    it('unwraps file.body responses', async () => {
        mockResource(Uint8Array.from([1, 2, 3]), 'image/webp', true);

        const blob = await getResourceBlob(RESOURCE_ID);

        expect(blob.type).toBe('image/webp');
        expect(await blobBytes(blob)).toEqual([1, 2, 3]);
    });

    it('ignores nonnumeric metadata on web numeric-key objects', async () => {
        mockResource({ 0: 137, 1: 80, 2: 78, 3: 71, length: 4, type: 'Buffer' });

        const blob = await getResourceBlob(RESOURCE_ID);

        expect(blob.type).toBe('image/png');
        expect(await blobBytes(blob)).toEqual([137, 80, 78, 71]);
    });

    it('rejects sparse numeric-key objects', async () => {
        mockResource({ 0: 1, 2: 3 });

        await expect(getResourceBlob(RESOURCE_ID)).rejects.toThrow('Sparse resource data at missing index 1');
    });

    it.each([[[256]], [[-1]], [[1.5]], [['1']]])('rejects invalid byte values in %j', async (data) => {
        mockResource(data);

        await expect(getResourceBlob(RESOURCE_ID)).rejects.toThrow('Invalid byte value at index 0');
    });

    it('rejects empty resource data', async () => {
        mockResource(new Uint8Array());

        await expect(getResourceBlob(RESOURCE_ID)).rejects.toThrow('Resource file data is empty');
    });

    it('rejects unknown resource data formats', async () => {
        mockResource('not binary data');

        await expect(getResourceBlob(RESOURCE_ID)).rejects.toThrow('Unknown resource data format: string');
    });

    it('rejects missing resources', async () => {
        getMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

        await expect(getResourceBlob(RESOURCE_ID)).rejects.toThrow('Resource not found or is empty');
    });

    it('rejects resources with a non-image MIME type', async () => {
        mockResource(Uint8Array.from([1, 2, 3]), 'application/pdf');

        await expect(getResourceBlob(RESOURCE_ID)).rejects.toThrow('Resource is not an image');
    });
});
