import joplin from 'api';
import { ToastType, SettingItemType, MenuItemLocation } from 'api/types';
import { buildNewSyntax } from './imageSyntaxBuilder';
import { showResizeDialog } from './dialogHandler';
import { getOriginalImageDimensions } from './imageSizeCalculator';
import { detectImageAtCursor, isOnImageInMarkdownEditor } from './cursorDetection';
import { ImageContext } from './types';
import { CONSTANTS } from './constants';
import { logger } from './logger';
import { resizeDialogLock } from './dialogLock';

joplin.plugins.register({
    onStart: async function () {
        // Register plugin settings
        await joplin.settings.registerSection('imageResize', {
            label: 'Simple Image Resize',
            iconName: 'fas fa-expand-alt',
        });

        await joplin.settings.registerSettings({
            'imageResize.defaultResizeMode': {
                value: 'percentage',
                type: SettingItemType.String,
                section: 'imageResize',
                public: true,
                label: 'Default resize mode',
                description: 'The resize mode that will be selected by default when opening the resize dialog',
                isEnum: true,
                options: {
                    percentage: 'Percentage',
                    absolute: 'Absolute size',
                },
            },
        });

        // Enhanced resize command with intelligent detection
        await joplin.commands.register({
            name: 'resizeImage',
            label: 'Resize Image',
            iconName: 'fas fa-expand-alt',
            execute: async () => {
                let dialogLockAcquired = false;

                try {
                    // Detect image at cursor position
                    const cursorDetection = await detectImageAtCursor();

                    if (!cursorDetection) {
                        await joplin.views.dialogs.showToast({
                            message: 'No valid image found. Place cursor inside an image embed.',
                            type: ToastType.Info,
                        });
                        return;
                    }

                    const partialContext = cursorDetection.context;
                    const replacementRange = cursorDetection.range;

                    // Get original dimensions
                    logger.info(`Processing ${partialContext.sourceType}: ${partialContext.source}`);

                    let originalDimensions;
                    try {
                        originalDimensions = await getOriginalImageDimensions(
                            partialContext.source,
                            partialContext.sourceType
                        );
                    } catch (error) {
                        logger.warn('Dimension fetch failed:', error);

                        if (partialContext.sourceType === 'external') {
                            originalDimensions = {
                                width: CONSTANTS.DEFAULT_EXTERNAL_WIDTH,
                                height: CONSTANTS.DEFAULT_EXTERNAL_HEIGHT,
                            };
                            await joplin.views.dialogs.showToast({
                                message: `Using default dimensions for external image (${CONSTANTS.DEFAULT_EXTERNAL_WIDTH}×${CONSTANTS.DEFAULT_EXTERNAL_HEIGHT}).`,
                                type: ToastType.Info,
                            });
                        } else {
                            throw error;
                        }
                    }

                    // Show dialog
                    const defaultResizeMode = (await joplin.settings.value('imageResize.defaultResizeMode')) as
                        | 'percentage'
                        | 'absolute';
                    const fullContext: ImageContext = { ...partialContext, originalDimensions };

                    if (!resizeDialogLock.tryAcquire()) {
                        await joplin.views.dialogs.showToast({
                            message: 'Resize dialog is already open.',
                            type: ToastType.Info,
                        });
                        logger.info('Resize dialog invocation skipped because another instance is open.');
                        return;
                    }

                    dialogLockAcquired = true;

                    const result = await showResizeDialog(fullContext, defaultResizeMode);

                    if (result) {
                        const newSyntax = buildNewSyntax(fullContext, result);

                        // Replace the detected image at the specified range
                        await joplin.commands.execute('editor.execCommand', {
                            name: 'replaceRange',
                            args: [newSyntax, replacementRange.from, replacementRange.to],
                        });

                        await joplin.views.dialogs.showToast({
                            message: 'Image resized successfully!',
                            type: ToastType.Success,
                        });
                    }
                } catch (err) {
                    logger.error('Error:', err);
                    const message = err?.message || 'Unknown error occurred';
                    await joplin.views.dialogs.showToast({
                        message: `Operation failed: ${message}`,
                        type: ToastType.Error,
                    });
                } finally {
                    if (dialogLockAcquired) {
                        resizeDialogLock.release();
                    }
                }
            },
        });

        // Keep fallback menu item in Edit menu
        await joplin.views.menuItems.create('imageResizeMenuItem', 'resizeImage', MenuItemLocation.Edit);

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
                    logger.info('Added context menu item - cursor on image');
                }
            }

            return contextMenu;
        });
    },
});
