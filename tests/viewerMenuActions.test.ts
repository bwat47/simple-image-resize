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

describe('viewer context menu actions', () => {
    beforeEach(() => {
        vi.mocked(joplin.commands.execute).mockReset();
        vi.mocked(joplin.commands.register).mockClear();
        vi.mocked(joplin.workspace.filterEditorContextMenu).mockClear();
        vi.mocked(joplin.settings.globalValue).mockResolvedValue(true);
        settingsCache.showQuickResizeInContextMenu = true;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('checks the image without moving the cursor and passes it to every viewer resize item', async () => {
        vi.mocked(joplin.commands.execute).mockImplementation(async (_command, args) => {
            if (args.name === IS_EDITOR_CONTEXT_MENU_ORIGIN_COMMAND) return false;
            if (args.name === MATCH_VIEWER_IMAGE_COMMAND) return true;
            throw new Error(`Unexpected editor command: ${args.name}`);
        });
        registerContextMenu();
        const filter = vi.mocked(joplin.workspace.filterEditorContextMenu).mock.calls[0][0];

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
        vi.mocked(joplin.commands.execute).mockImplementation(async (_command, args) => {
            if (args.name === IS_EDITOR_CONTEXT_MENU_ORIGIN_COMMAND) return true;
            if (args.name === GET_IMAGE_AT_CURSOR_COMMAND) return null;
            throw new Error(`Unexpected editor command: ${args.name}`);
        });
        registerContextMenu();
        const filter = vi.mocked(joplin.workspace.filterEditorContextMenu).mock.calls[0][0];

        const clickedAt = Date.now();
        receiveViewerMessage({ target, clickedAt });
        await filter({ items: [] });
        receiveViewerMessage({ target, clickedAt });

        vi.mocked(joplin.commands.execute).mockImplementation(async (_command, args) => {
            if (args.name === IS_EDITOR_CONTEXT_MENU_ORIGIN_COMMAND) return false;
            if (args.name === MATCH_VIEWER_IMAGE_COMMAND) return true;
            throw new Error(`Unexpected editor command: ${args.name}`);
        });
        const nextMenu = filter({ items: [] });
        await vi.advanceTimersByTimeAsync(301);

        await expect(nextMenu).resolves.toEqual({ items: [] });
        expect(joplin.commands.execute).not.toHaveBeenCalledWith('editor.execCommand', {
            name: MATCH_VIEWER_IMAGE_COMMAND,
            args: [target],
        });
    });
});
