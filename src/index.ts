import joplin from 'api';
import { ContentScriptType } from 'api/types';
import { registerSettings, initializeSettingsCache, settingsCache } from './host/settings';
import { registerCommands } from './host/commands';
import { registerMenus, registerContextMenu, registerToolbarButton } from './host/menus';
import { ResizeDialog } from './host/resizeDialogHost';
import { registerViewerContentScript } from './host/viewerMessages';
import { EDITOR_CONTENT_SCRIPT_ID } from './shared/editorCommands';

void joplin.plugins.register({
    onStart: async function () {
        await registerSettings();

        await initializeSettingsCache();

        await joplin.contentScripts.register(
            ContentScriptType.CodeMirrorPlugin,
            EDITOR_CONTENT_SCRIPT_ID,
            './editor/cursorContentScript.js'
        );

        await registerViewerContentScript();

        const resizeDialog = new ResizeDialog(joplin.views.dialogs);
        await registerCommands(resizeDialog);

        await registerMenus();

        if (settingsCache.showFormattingToolbarIcon) {
            await registerToolbarButton();
        }

        registerContextMenu();
    },
});
