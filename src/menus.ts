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
import { settingsCache } from './settings';

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
    joplin.workspace.filterEditorContextMenu(async (contextMenu) => {
        try {
            // Small delay to work around timing issue where cursor position
            // may not have updated yet when context menu filter is called
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Get image context directly from editor (pull architecture)
            // This is guaranteed to match the current cursor position
            const shouldShowResize = await isOnImageInMarkdownEditor();

            if (!shouldShowResize) {
                // No image at cursor, return menu unchanged
                return contextMenu;
            }

            // Check if we've already added our commands (avoid duplicates)
            const hasResizeCommand = contextMenu.items.some((item) => item.commandName === 'resizeImage');
            if (hasResizeCommand) {
                return contextMenu;
            }

            // Build menu items for image context
            contextMenu.items.push({
                commandName: 'resizeImage',
                label: 'Resize Image',
            });

            // Add quick resize options if enabled
            const showQuickResize = settingsCache.showQuickResizeInContextMenu;
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

            // Add copy image option if enabled
            const showCopyImage = settingsCache.showCopyImageInContextMenu;
            if (showCopyImage) {
                contextMenu.items.push({
                    commandName: 'copyImageToClipboard',
                    label: 'Copy Image',
                });
            }

            logger.debug('Added context menu items - cursor on image');

            return contextMenu;
        } catch (error) {
            logger.error('Error in context menu filter:', error);
            // Return original menu on error to avoid breaking context menu
            return contextMenu;
        }
    });
}
