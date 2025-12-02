import joplin from 'api';
import { ContentScriptType } from 'api/types';
import { registerSettings, initializeSettingsCache } from './settings';
import { registerCommands } from './commands';
import { registerMenus, registerContextMenu, registerToolbarButton } from './menus';

const CONTENT_SCRIPT_ID = 'simpleImageResize-cursorContentScript';

joplin.plugins.register({
    onStart: async function () {
        // Register plugin settings
        await registerSettings();

        // Initialize settings cache for synchronous access
        await initializeSettingsCache();

        // Register CodeMirror content script for cursor detection (mobile support)
        await joplin.contentScripts.register(
            ContentScriptType.CodeMirrorPlugin,
            CONTENT_SCRIPT_ID,
            './contentScripts/cursorContentScript.js'
        );

        // Register all resize commands
        await registerCommands();

        // Register menus
        await registerMenus();

        // Register toolbar button
        await registerToolbarButton();

        // Register context menu
        registerContextMenu();
    },
});
