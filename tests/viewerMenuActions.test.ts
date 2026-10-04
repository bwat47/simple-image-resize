import joplin from 'api';
import { registerCommands } from '../src/commands';
import { registerContextMenu } from '../src/menus';
import { receiveViewerMessage } from '../src/viewerContextMenu';
import {
    GET_IMAGE_AT_CURSOR_COMMAND,
    IS_EDITOR_CONTEXT_MENU_ORIGIN_COMMAND,
    MATCH_VIEWER_IMAGE_COMMAND,
    SELECT_VIEWER_IMAGE_COMMAND,
} from '../src/contentScripts/cursorContentScript';
import { settingsCache } from '../src/settings';

vi.mock('../src/logger', () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const target = { line: 2, lineEnd: 3, index: 0, resourceId: '0123456789abcdef0123456789abcdef' };

type EditorCommandArgs = { name: string };

/** Answers `editor.execCommand` calls from a map of command name to result. */
function mockEditorCommands(results: Record<string, unknown>): void {
    vi.mocked(joplin.commands.execute).mockImplementation((_command, args: EditorCommandArgs) =>
        args.name in results
            ? Promise.resolve(results[args.name])
            : Promise.reject(new Error(`Unexpected editor command: ${args.name}`))
    );
}

/** Returns the filter registered by the most recent `registerContextMenu()` call. */
function getContextMenuFilter(): Parameters<typeof joplin.workspace.filterEditorContextMenu>[0] {
    const filterMock = vi.mocked(joplin.workspace.filterEditorContextMenu);
    return filterMock.mock.calls[0][0];
}

describe('viewer context menu actions', () => {
    beforeEach(() => {
        vi.mocked(joplin.commands.execute).mockReset();
        vi.mocked(joplin.commands.register).mockClear();
        vi.mocked(joplin.workspace.filterEditorContextMenu).mockClear();
        vi.mocked(joplin.settings.globalValues).mockResolvedValue([true]);
        settingsCache.showQuickResizeInContextMenu = true;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it.each([false, undefined, 'true'])('omits resize items when code view is %s', async (codeView) => {
        vi.mocked(joplin.settings.globalValues).mockResolvedValue([codeView]);
        registerContextMenu();
        const filter = getContextMenuFilter();

        expect(await filter({ items: [] })).toEqual({ items: [] });
        expect(joplin.settings.globalValues).toHaveBeenCalledWith(['editor.codeView']);
        expect(joplin.commands.execute).not.toHaveBeenCalled();
    });

    it('checks the image without moving the cursor and passes it to every viewer resize item', async () => {
        mockEditorCommands({ [IS_EDITOR_CONTEXT_MENU_ORIGIN_COMMAND]: false, [MATCH_VIEWER_IMAGE_COMMAND]: true });
        registerContextMenu();
        const filter = getContextMenuFilter();

        receiveViewerMessage({ target, clickedAt: Date.now() });
        const menu = await filter({ items: [] });

        expect(menu.items.filter((item) => item.commandName?.startsWith('resize'))).toHaveLength(6);
        for (const item of menu.items.filter((item) => item.commandName?.startsWith('resize'))) {
            expect(item.commandArgs).toEqual([target]);
        }
        expect(joplin.commands.execute).not.toHaveBeenCalledWith('editor.execCommand', {
            name: SELECT_VIEWER_IMAGE_COMMAND,
            args: [target],
        });
    });

    it.each(['resizeImage', 'resize100'])('selects and revalidates only when %s is chosen', async (commandName) => {
        await registerCommands({} as Parameters<typeof registerCommands>[0]);
        const command = vi
            .mocked(joplin.commands.register)
            .mock.calls.find(([registration]) => registration.name === commandName)![0];
        vi.mocked(joplin.commands.execute).mockResolvedValue(false);

        await command.execute(target);

        expect(joplin.commands.execute).toHaveBeenCalledWith('editor.execCommand', {
            name: SELECT_VIEWER_IMAGE_COMMAND,
            args: [target],
        });
        expect(joplin.commands.execute).not.toHaveBeenCalledWith('editor.execCommand', {
            name: GET_IMAGE_AT_CURSOR_COMMAND,
        });
    });

    it('discards a viewer message when an editor-origin menu skips it', async () => {
        vi.useFakeTimers();
        mockEditorCommands({ [IS_EDITOR_CONTEXT_MENU_ORIGIN_COMMAND]: true, [GET_IMAGE_AT_CURSOR_COMMAND]: null });
        registerContextMenu();
        const filter = getContextMenuFilter();

        const clickedAt = Date.now();
        receiveViewerMessage({ target, clickedAt });
        await filter({ items: [] });
        receiveViewerMessage({ target, clickedAt });

        mockEditorCommands({ [IS_EDITOR_CONTEXT_MENU_ORIGIN_COMMAND]: false, [MATCH_VIEWER_IMAGE_COMMAND]: true });
        const nextMenu = filter({ items: [] });
        await vi.advanceTimersByTimeAsync(301);

        await expect(nextMenu).resolves.toEqual({ items: [] });
        expect(joplin.commands.execute).not.toHaveBeenCalledWith('editor.execCommand', {
            name: MATCH_VIEWER_IMAGE_COMMAND,
            args: [target],
        });
    });

    it('keeps a viewer click that lands while an editor menu is still being built', async () => {
        vi.useFakeTimers();
        let releaseOrigin: (origin: boolean) => void = () => {};
        vi.mocked(joplin.commands.execute).mockImplementation((_command, args: EditorCommandArgs) => {
            if (args.name === IS_EDITOR_CONTEXT_MENU_ORIGIN_COMMAND) {
                return new Promise((resolve) => {
                    releaseOrigin = resolve;
                });
            }
            if (args.name === GET_IMAGE_AT_CURSOR_COMMAND) return Promise.resolve(null);
            return Promise.reject(new Error(`Unexpected editor command: ${args.name}`));
        });
        registerContextMenu();
        const filter = getContextMenuFilter();

        const editorMenu = filter({ items: [] });
        await vi.advanceTimersByTimeAsync(50);
        const clickedAt = Date.now();
        releaseOrigin(true);
        await editorMenu;

        receiveViewerMessage({ target, clickedAt });
        mockEditorCommands({ [IS_EDITOR_CONTEXT_MENU_ORIGIN_COMMAND]: false, [MATCH_VIEWER_IMAGE_COMMAND]: true });

        const menu = await filter({ items: [] });
        expect(menu.items.find((item) => item.commandName === 'resizeImage')?.commandArgs).toEqual([target]);
    });
});
