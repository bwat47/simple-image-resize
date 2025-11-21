import joplin from 'api';
import { registerSettings } from './settings';
import { registerCommands } from './commands';
import { registerMenus, registerContextMenu, registerToolbarButton } from './menus';

joplin.plugins.register({
    onStart: async function () {
        // Register plugin settings
        await registerSettings();

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
