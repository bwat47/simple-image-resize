import joplin from 'api';
import { receiveViewerMessage, selectViewerContextMenuImage } from '../src/viewerContextMenu';
import { SELECT_VIEWER_IMAGE_COMMAND } from '../src/contentScripts/cursorContentScript';

vi.mock('../src/logger', () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const execute = vi.mocked(joplin.commands.execute);
const target = { line: 2, lineEnd: 3, index: 0, resourceId: '0123456789abcdef0123456789abcdef' };

describe('selectViewerContextMenuImage', () => {
    beforeEach(async () => {
        vi.useFakeTimers();
        execute.mockReset();
        execute.mockResolvedValue(true);
        // Drain any message a previous test left behind.
        vi.advanceTimersByTime(1000);
        const drained = selectViewerContextMenuImage();
        await vi.advanceTimersByTimeAsync(1000);
        await drained;
        execute.mockClear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('selects the target from a message that arrived before the menu', async () => {
        receiveViewerMessage(target);

        await expect(selectViewerContextMenuImage()).resolves.toBe(true);
        expect(execute).toHaveBeenCalledWith('editor.execCommand', {
            name: SELECT_VIEWER_IMAGE_COMMAND,
            args: [target],
        });
    });

    it('waits for a message that arrives after the menu request', async () => {
        const result = selectViewerContextMenuImage();
        await vi.advanceTimersByTimeAsync(50);
        receiveViewerMessage(target);

        await expect(result).resolves.toBe(true);
    });

    it('returns false when the editor cannot match the target', async () => {
        execute.mockResolvedValue(false);
        receiveViewerMessage(target);

        await expect(selectViewerContextMenuImage()).resolves.toBe(false);
    });

    it('does not touch the editor for a right-click that was not on an image', async () => {
        receiveViewerMessage(null);

        await expect(selectViewerContextMenuImage()).resolves.toBe(false);
        expect(execute).not.toHaveBeenCalled();
    });

    it('ignores invalid messages', async () => {
        receiveViewerMessage({ ...target, resourceId: 'nope' });

        await expect(selectViewerContextMenuImage()).resolves.toBe(false);
        expect(execute).not.toHaveBeenCalled();
    });

    it('gives up when no message arrives', async () => {
        const result = selectViewerContextMenuImage();
        await vi.advanceTimersByTimeAsync(1000);

        await expect(result).resolves.toBe(false);
        expect(execute).not.toHaveBeenCalled();
    });

    it('ignores a message too old to belong to this menu', async () => {
        receiveViewerMessage(target);
        vi.advanceTimersByTime(1000);

        const result = selectViewerContextMenuImage();
        await vi.advanceTimersByTimeAsync(1000);

        await expect(result).resolves.toBe(false);
        expect(execute).not.toHaveBeenCalled();
    });

    it('uses each message for one menu only', async () => {
        receiveViewerMessage(target);
        await selectViewerContextMenuImage();
        execute.mockClear();

        const second = selectViewerContextMenuImage();
        await vi.advanceTimersByTimeAsync(1000);

        await expect(second).resolves.toBe(false);
        expect(execute).not.toHaveBeenCalled();
    });
});
