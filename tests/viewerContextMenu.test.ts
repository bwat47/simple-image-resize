import joplin from 'api';
import { getViewerContextMenuImage, receiveViewerMessage } from '../src/viewerContextMenu';
import { MATCH_VIEWER_IMAGE_COMMAND, SELECT_VIEWER_IMAGE_COMMAND } from '../src/contentScripts/cursorContentScript';

vi.mock('../src/logger', () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const execute = vi.mocked(joplin.commands.execute);
const target = { line: 2, lineEnd: 3, index: 0, resourceId: '0123456789abcdef0123456789abcdef' };

describe('getViewerContextMenuImage', () => {
    beforeEach(async () => {
        vi.useFakeTimers();
        execute.mockReset();
        execute.mockResolvedValue(true);
        // Drain any message a previous test left behind.
        vi.advanceTimersByTime(1000);
        const drained = getViewerContextMenuImage();
        await vi.advanceTimersByTimeAsync(1000);
        await drained;
        execute.mockClear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('matches the target from a message that arrived before the menu without moving the cursor', async () => {
        receiveViewerMessage(target);

        await expect(getViewerContextMenuImage()).resolves.toEqual(target);
        expect(execute).toHaveBeenCalledWith('editor.execCommand', {
            name: MATCH_VIEWER_IMAGE_COMMAND,
            args: [target],
        });
        expect(execute).not.toHaveBeenCalledWith('editor.execCommand', {
            name: SELECT_VIEWER_IMAGE_COMMAND,
            args: [target],
        });
    });

    it('waits for a message that arrives after the menu request', async () => {
        const result = getViewerContextMenuImage();
        await vi.advanceTimersByTimeAsync(50);
        receiveViewerMessage(target);

        await expect(result).resolves.toEqual(target);
    });

    it('returns false when the editor cannot match the target', async () => {
        execute.mockResolvedValue(false);
        receiveViewerMessage(target);

        await expect(getViewerContextMenuImage()).resolves.toBeNull();
    });

    it('does not touch the editor for a right-click that was not on an image', async () => {
        receiveViewerMessage(null);

        await expect(getViewerContextMenuImage()).resolves.toBeNull();
        expect(execute).not.toHaveBeenCalled();
    });

    it('ignores invalid messages', async () => {
        receiveViewerMessage({ ...target, resourceId: 'nope' });

        await expect(getViewerContextMenuImage()).resolves.toBeNull();
        expect(execute).not.toHaveBeenCalled();
    });

    it('gives up when no message arrives', async () => {
        const result = getViewerContextMenuImage();
        await vi.advanceTimersByTimeAsync(1000);

        await expect(result).resolves.toBeNull();
        expect(execute).not.toHaveBeenCalled();
    });

    it('ignores a message too old to belong to this menu', async () => {
        receiveViewerMessage(target);
        vi.advanceTimersByTime(1000);

        const result = getViewerContextMenuImage();
        await vi.advanceTimersByTimeAsync(1000);

        await expect(result).resolves.toBeNull();
        expect(execute).not.toHaveBeenCalled();
    });

    it('uses each message for one menu only', async () => {
        receiveViewerMessage(target);
        await getViewerContextMenuImage();
        execute.mockClear();

        const second = getViewerContextMenuImage();
        await vi.advanceTimersByTimeAsync(1000);

        await expect(second).resolves.toBeNull();
        expect(execute).not.toHaveBeenCalled();
    });
});
