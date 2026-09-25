import joplin from 'api';
import { getViewerContextMenuImage, receiveViewerMessage } from '../src/viewerContextMenu';
import { MATCH_VIEWER_IMAGE_COMMAND, SELECT_VIEWER_IMAGE_COMMAND } from '../src/contentScripts/cursorContentScript';

vi.mock('../src/logger', () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const execute = vi.mocked(joplin.commands.execute);
const target = { line: 2, lineEnd: 3, index: 0, resourceId: '0123456789abcdef0123456789abcdef' };
let clock = Date.now();

describe('getViewerContextMenuImage', () => {
    beforeEach(async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date((clock += 10_000)));
        execute.mockReset();
        execute.mockResolvedValue(true);
        // Drain any message a previous test left behind.
        vi.advanceTimersByTime(1000);
        const drained = getViewerContextMenuImage(Date.now());
        await vi.advanceTimersByTimeAsync(1000);
        await drained;
        execute.mockClear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('matches the target from a message that arrived before the menu without moving the cursor', async () => {
        receiveViewerMessage({ target, clickedAt: Date.now() });

        await expect(getViewerContextMenuImage(Date.now())).resolves.toEqual(target);
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
        const clickedAt = Date.now();
        const result = getViewerContextMenuImage(clickedAt);
        await vi.advanceTimersByTimeAsync(50);
        receiveViewerMessage({ target, clickedAt });

        await expect(result).resolves.toEqual(target);
    });

    it('returns no target when the editor cannot match the image', async () => {
        execute.mockResolvedValue(false);
        receiveViewerMessage({ target, clickedAt: Date.now() });

        await expect(getViewerContextMenuImage(Date.now())).resolves.toBeNull();
    });

    it('does not touch the editor for a right-click that was not on an image', async () => {
        receiveViewerMessage({ target: null, clickedAt: Date.now() });

        await expect(getViewerContextMenuImage(Date.now())).resolves.toBeNull();
        expect(execute).not.toHaveBeenCalled();
    });

    it('ignores invalid messages', async () => {
        receiveViewerMessage({ target: { ...target, resourceId: 'nope' }, clickedAt: Date.now() });

        await expect(getViewerContextMenuImage(Date.now())).resolves.toBeNull();
        expect(execute).not.toHaveBeenCalled();
    });

    it('gives up when no message arrives', async () => {
        const result = getViewerContextMenuImage(Date.now());
        await vi.advanceTimersByTimeAsync(1000);

        await expect(result).resolves.toBeNull();
        expect(execute).not.toHaveBeenCalled();
    });

    it('ignores a message too old to belong to this menu', async () => {
        receiveViewerMessage({ target, clickedAt: Date.now() });
        vi.advanceTimersByTime(1000);

        const result = getViewerContextMenuImage(Date.now());
        await vi.advanceTimersByTimeAsync(1000);

        await expect(result).resolves.toBeNull();
        expect(execute).not.toHaveBeenCalled();
    });

    it('uses each message for one menu only', async () => {
        receiveViewerMessage({ target, clickedAt: Date.now() });
        await getViewerContextMenuImage(Date.now());
        execute.mockClear();

        const second = getViewerContextMenuImage(Date.now());
        await vi.advanceTimersByTimeAsync(1000);

        await expect(second).resolves.toBeNull();
        expect(execute).not.toHaveBeenCalled();
    });

    it('discards a message that arrives just after its menu request timed out', async () => {
        const clickedAt = Date.now();
        const first = getViewerContextMenuImage(clickedAt);
        await vi.advanceTimersByTimeAsync(301);
        await expect(first).resolves.toBeNull();

        receiveViewerMessage({ target, clickedAt });
        const second = getViewerContextMenuImage(Date.now());
        await vi.advanceTimersByTimeAsync(301);

        await expect(second).resolves.toBeNull();
        expect(execute).not.toHaveBeenCalled();
    });

    it('keeps a click that happens while an earlier menu is waiting', async () => {
        const first = getViewerContextMenuImage(Date.now());
        await vi.advanceTimersByTimeAsync(50);
        const clickedAt = Date.now();
        receiveViewerMessage({ target, clickedAt });
        await expect(first).resolves.toBeNull();
        await expect(getViewerContextMenuImage(clickedAt)).resolves.toEqual(target);
    });

    it('gives a click to the later of two waiting menus', async () => {
        const first = getViewerContextMenuImage(Date.now());
        await vi.advanceTimersByTimeAsync(50);
        const clickedAt = Date.now();
        const second = getViewerContextMenuImage(clickedAt);

        receiveViewerMessage({ target, clickedAt });

        await expect(first).resolves.toBeNull();
        await expect(second).resolves.toEqual(target);
    });

    it('accepts a new click after discarding a timed-out menu', async () => {
        const first = getViewerContextMenuImage(Date.now());
        await vi.advanceTimersByTimeAsync(301);
        await first;

        receiveViewerMessage({ target, clickedAt: Date.now() });
        await expect(getViewerContextMenuImage(Date.now())).resolves.toEqual(target);
    });

    it('does not let an older delayed message replace a newer click', async () => {
        const olderClickAt = Date.now();
        vi.advanceTimersByTime(10);
        const newerClickAt = Date.now();
        receiveViewerMessage({ target: null, clickedAt: newerClickAt });
        receiveViewerMessage({ target, clickedAt: olderClickAt });

        await expect(getViewerContextMenuImage(Date.now())).resolves.toBeNull();
        expect(execute).not.toHaveBeenCalled();
    });
});
