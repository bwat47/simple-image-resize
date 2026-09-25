/**
 * Menu and context menu registration for Simple Image Resize plugin.
 *
 * Handles:
 * - Submenu creation in Tools menu with keyboard shortcuts
 * - Toolbar button in editor toolbar
 * - Dynamic context menu items for images in the editor or markdown viewer
 */

import joplin from 'api';
import { MenuItem, MenuItemLocation, ToolbarButtonLocation } from 'api/types';
import { isEditorContextMenuOrigin, isOnImageInMarkdownEditor } from './cursorDetection';
import { logger } from './logger';
import { selectViewerContextMenuImage } from './viewerContextMenu';
import { settingsCache } from './settings';
import { getQuickResizeLabel, QUICK_RESIZE_SLOTS, tryParseQuickResizeOptions } from './quickResizeOptions';

function buildQuickResizeMenuItems(includeAccelerators: boolean): MenuItem[] {
    const quickResizeOptions = tryParseQuickResizeOptions(settingsCache.quickResizeOptions);

    return quickResizeOptions.map((option, index) => {
        const slot = QUICK_RESIZE_SLOTS[index];
        const menuItem: MenuItem = {
            label: getQuickResizeLabel(option),
            commandName: slot.commandName,
        };

        if (includeAccelerators) {
            menuItem.accelerator = slot.accelerator;
        }

        return menuItem;
    });
}

export async function registerMenus(): Promise<void> {
    const quickResizeItems = buildQuickResizeMenuItems(true);

    // Create submenu in Tools menu
    await joplin.views.menus.create(
        'simpleImageResizeMenu',
        'Simple Image Resize',
        [{ label: 'Resize Image', commandName: 'resizeImage', accelerator: 'CmdOrCtrl+Shift+R' }, ...quickResizeItems],
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
            // Only show menu items in the Markdown editor (Code View).
            const isMarkdown = await joplin.settings.globalValue('editor.codeView');
            logger.debug('Context menu filter: isMarkdown (Code View)=', isMarkdown);
            if (!isMarkdown) {
                return contextMenu;
            }

            // Editor right-clicks act on the image at the cursor. Viewer right-clicks
            // first move the editor cursor onto the clicked image, so the same
            // cursor-based commands then act on it.
            const isEditorOrigin = await isEditorContextMenuOrigin();
            const shouldShowResize = isEditorOrigin
                ? await isOnImageInMarkdownEditor()
                : await selectViewerContextMenuImage();

            if (!shouldShowResize) {
                // No image targeted, return menu unchanged
                return contextMenu;
            }

            // Check if we've already added our commands (avoid duplicates)
            const hasResizeCommand = contextMenu.items.some((item) => item.commandName === 'resizeImage');
            if (hasResizeCommand) {
                return contextMenu;
            }

            // Build menu items for image context
            // Add separator before our items
            const separator: MenuItem = { type: 'separator' };
            contextMenu.items.push(separator);

            contextMenu.items.push({
                commandName: 'resizeImage',
                label: 'Resize Image',
            });

            // Add quick resize options if enabled
            const showQuickResize = settingsCache.showQuickResizeInContextMenu;
            if (showQuickResize) {
                contextMenu.items.push(...buildQuickResizeMenuItems(false));
            }

            logger.debug('Added context menu items - cursor on image', { isEditorOrigin });

            return contextMenu;
        } catch (error) {
            logger.error('Error in context menu filter:', error);
            // Return original menu on error to avoid breaking context menu
            return contextMenu;
        }
    });
}
