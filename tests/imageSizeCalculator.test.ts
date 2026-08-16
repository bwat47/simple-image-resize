import joplin from 'api';
import type { Mock, MockInstance } from 'vitest';
import { getResourceBlob } from '../src/utils/resourceUtils';
import { measureBlobImageDimensions, measureImageDimensions } from '../src/utils/imageDimensionUtils';
import { getOriginalImageDimensions } from '../src/imageSizeCalculator';

vi.mock('../src/contentScripts/cursorContentScript', () => ({
    GET_IMAGE_DIMENSIONS_COMMAND: 'simpleImageResize-getImageDimensions',
}));

vi.mock('../src/utils/resourceUtils', () => ({
    getResourceBlob: vi.fn(),
    validateResourceId: vi.fn((id: string) => /^[a-f0-9]{32}$/i.test(id)),
}));

vi.mock('../src/utils/imageDimensionUtils', () => ({
    measureBlobImageDimensions: vi.fn(),
    measureImageDimensions: vi.fn(),
}));

const RESOURCE_ID = '0123456789abcdef0123456789abcdef';
const resourcePathMock = joplin.data.resourcePath as Mock;
const executeMock = joplin.commands.execute as Mock;
const getResourceBlobMock = vi.mocked(getResourceBlob);
const measureBlobMock = vi.mocked(measureBlobImageDimensions);
const measureImageMock = vi.mocked(measureImageDimensions);

describe('getOriginalImageDimensions', () => {
    let consoleWarnSpy: MockInstance;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
    });

    it('prefers editor-context resourcePath measurement', async () => {
        resourcePathMock.mockResolvedValue('/resources/image.png');
        executeMock.mockResolvedValue({ width: 800, height: 600 });

        await expect(getOriginalImageDimensions(RESOURCE_ID, 'resource')).resolves.toEqual({
            width: 800,
            height: 600,
        });
        expect(executeMock).toHaveBeenCalledWith('editor.execCommand', {
            name: 'simpleImageResize-getImageDimensions',
            args: ['/resources/image.png'],
        });
        expect(getResourceBlobMock).not.toHaveBeenCalled();
    });

    it('falls back to Blob measurement when editor-context measurement fails', async () => {
        const blob = new Blob([Uint8Array.from([1, 2, 3])], { type: 'image/png' });
        resourcePathMock.mockResolvedValue('/resources/image.png');
        executeMock.mockResolvedValue(null);
        getResourceBlobMock.mockResolvedValue(blob);
        measureBlobMock.mockResolvedValue({ width: 1024, height: 768 });

        await expect(getOriginalImageDimensions(RESOURCE_ID, 'resource')).resolves.toEqual({
            width: 1024,
            height: 768,
        });
        expect(measureBlobMock).toHaveBeenCalledWith(blob, { timeoutMs: 5000 });
    });

    it('uses default dimensions when both resource strategies fail', async () => {
        resourcePathMock.mockRejectedValue(new Error('Path unavailable'));
        getResourceBlobMock.mockRejectedValue(new Error('Bytes unavailable'));

        await expect(getOriginalImageDimensions(RESOURCE_ID, 'resource')).resolves.toEqual({
            width: 400,
            height: 300,
        });
        expect(consoleWarnSpy).toHaveBeenCalledOnce();
    });

    it('leaves external URL measurement unchanged', async () => {
        measureImageMock.mockResolvedValue({ width: 320, height: 200 });

        await expect(getOriginalImageDimensions('https://example.com/image.png', 'external')).resolves.toEqual({
            width: 320,
            height: 200,
        });
        expect(measureImageMock).toHaveBeenCalledWith('https://example.com/image.png', {
            timeoutMs: 10000,
            usePrivacySettings: true,
        });
        expect(getResourceBlobMock).not.toHaveBeenCalled();
    });
});
