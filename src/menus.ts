/**
 * Menu and context menu registration for Simple Image Resize plugin.
 *
 * Handles:
 * - Submenu creation in Tools menu with keyboard shortcuts
 * - Toolbar button in editor toolbar
 * - Dynamic context menu items based on cursor position and settings
 */

import joplin from 'api';
import { MenuItemLocation, ToolbarButtonLocation } from 'api/types';
import { isOnImageInMarkdownEditor } from './cursorDetection';
import { logger } from './logger';
import { SETTING_SHOW_QUICK_RESIZE_IN_CONTEXT_MENU } from './settings';

export async function registerMenus(): Promise<void> {
    // Create submenu in Tools menu
    await joplin.views.menus.create(
        'simpleImageResizeMenu',
        'Simple Image Resize',
        [
            { label: 'Resize Image', commandName: 'resizeImage', accelerator: 'CmdOrCtrl+Shift+R' },
            { label: 'Resize 100%', commandName: 'resize100', accelerator: 'CmdOrCtrl+Shift+1' },
            { label: 'Resize 75%', commandName: 'resize75', accelerator: 'CmdOrCtrl+Shift+2' },
            { label: 'Resize 50%', commandName: 'resize50', accelerator: 'CmdOrCtrl+Shift+3' },
            { label: 'Resize 25%', commandName: 'resize25', accelerator: 'CmdOrCtrl+Shift+4' },
        ],
        MenuItemLocation.Tools
    );
}

export async function registerToolbarButton(): Promise<void> {
    await joplin.views.toolbarButtons.create(
        'resizeImageToolbarButton',
        'resizeImage',
        ToolbarButtonLocation.EditorToolbar
    );
}

export function registerContextMenu(): void {
    // Enhanced context menu with intelligent showing
    joplin.workspace.filterEditorContextMenu(async (contextMenu) => {
        // Only show resize option when cursor is on an image in markdown editor
        const shouldShowResize = await isOnImageInMarkdownEditor();

        if (shouldShowResize) {
            const hasResizeCommand = contextMenu.items.some((item) => item.commandName === 'resizeImage');

            if (!hasResizeCommand) {
                contextMenu.items.push({
                    commandName: 'resizeImage',
                    label: 'Resize Image',
                });

                // Add quick resize options if enabled
                const showQuickResize = await joplin.settings.value(SETTING_SHOW_QUICK_RESIZE_IN_CONTEXT_MENU);
                if (showQuickResize) {
                    contextMenu.items.push(
                        {
                            commandName: 'resize100',
                            label: 'Resize 100%',
                        },
                        {
                            commandName: 'resize75',
                            label: 'Resize 75%',
                        },
                        {
                            commandName: 'resize50',
                            label: 'Resize 50%',
                        },
                        {
                            commandName: 'resize25',
                            label: 'Resize 25%',
                        }
                    );
                }

                logger.info('Added context menu item - cursor on image');
            }
        }

        return contextMenu;
    });
}
