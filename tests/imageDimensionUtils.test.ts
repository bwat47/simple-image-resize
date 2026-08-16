import { measureBlobImageDimensions } from '../src/utils/imageDimensionUtils';

class FakeImage {
    private static latestInstance: FakeImage;
    public onload: (() => void) | null = null;
    public onerror: (() => void) | null = null;
    public naturalWidth = 640;
    public naturalHeight = 480;
    public crossOrigin = '';
    public referrerPolicy = '';
    private source = '';

    public constructor() {
        FakeImage.latestInstance = this;
    }

    public static get latest(): FakeImage {
        return FakeImage.latestInstance;
    }

    public get src(): string {
        return this.source;
    }

    public set src(value: string) {
        this.source = value;
    }
}

describe('measureBlobImageDimensions', () => {
    beforeEach(() => {
        vi.stubGlobal('Image', FakeImage);
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:resource-image');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('measures a Blob through an object URL and revokes it after success', async () => {
        const blob = new Blob([Uint8Array.from([1, 2, 3])], { type: 'image/png' });
        const resultPromise = measureBlobImageDimensions(blob, { timeoutMs: 1000 });

        expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
        expect(FakeImage.latest.src).toBe('blob:resource-image');
        FakeImage.latest.onload?.();

        await expect(resultPromise).resolves.toEqual({ width: 640, height: 480 });
        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:resource-image');
    });

    it('revokes the object URL after an image load error', async () => {
        const resultPromise = measureBlobImageDimensions(new Blob([Uint8Array.from([1])]), {
            timeoutMs: 1000,
        });

        FakeImage.latest.onerror?.();

        await expect(resultPromise).rejects.toThrow('Failed to load image for dimension measurement');
        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    });

    it('revokes the object URL after a timeout', async () => {
        vi.useFakeTimers();
        const resultPromise = measureBlobImageDimensions(new Blob([Uint8Array.from([1])]), {
            timeoutMs: 1000,
        });
        const rejection = expect(resultPromise).rejects.toThrow('Timeout: Could not load image');

        await vi.advanceTimersByTimeAsync(1000);

        await rejection;
        expect(FakeImage.latest.src).toBe('');
        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    });
});
