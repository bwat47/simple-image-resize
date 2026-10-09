import joplin from 'api';
import { ContentScriptType } from 'api/types';
import { registerSettings, initializeSettingsCache, settingsCache } from './settings';
import { registerCommands } from './commands';
import { registerMenus, registerContextMenu, registerToolbarButton } from './menus';
import { ResizeDialog } from './dialogHandler';
import { registerViewerContentScript } from './viewerContextMenu';

const CONTENT_SCRIPT_ID = 'simpleImageResize-cursorContentScript';

void joplin.plugins.register({
    onStart: async function () {
        await registerSettings();

        await initializeSettingsCache();

        await joplin.contentScripts.register(
            ContentScriptType.CodeMirrorPlugin,
            CONTENT_SCRIPT_ID,
            './contentScripts/cursorContentScript.js'
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
