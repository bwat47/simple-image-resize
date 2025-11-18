import joplin from 'api';
import { ToastType, SettingItemType, MenuItemLocation } from 'api/types';
import { buildNewSyntax } from './imageSyntaxBuilder';
import { showResizeDialog } from './dialogHandler';
import { getOriginalImageDimensions } from './imageSizeCalculator';
import { detectImageAtCursor, isOnImageInMarkdownEditor } from './cursorDetection';
import { ImageContext, EditorRange } from './types';
import { CONSTANTS } from './constants';
import { logger } from './logger';
import { resizeDialogLock } from './dialogLock';

joplin.plugins.register({
    onStart: async function () {
        // Shared function to handle image detection and dimension fetching
        async function detectAndPrepareImage() {
            const cursorDetection = await detectImageAtCursor();

            if (!cursorDetection) {
                await joplin.views.dialogs.showToast({
                    message: 'No valid image found. Place cursor inside an image embed.',
                    type: ToastType.Info,
                });
                return null;
            }

            const partialContext = cursorDetection.context;
            const replacementRange = cursorDetection.range;

            // Get original dimensions
            logger.info(`Processing ${partialContext.sourceType}: ${partialContext.source}`);

            let originalDimensions;
            try {
                originalDimensions = await getOriginalImageDimensions(partialContext.source, partialContext.sourceType);
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

            const fullContext: ImageContext = { ...partialContext, originalDimensions };
            return { fullContext, replacementRange };
        }

        // Shared function to replace image in editor
        async function replaceImageInEditor(newSyntax: string, replacementRange: EditorRange) {
            await joplin.commands.execute('editor.execCommand', {
                name: 'replaceRange',
                args: [newSyntax, replacementRange.from, replacementRange.to],
            });
        }

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
            'imageResize.showQuickResizeInContextMenu': {
                value: false,
                type: SettingItemType.Bool,
                section: 'imageResize',
                public: true,
                label: 'Display quick resize options in context menu',
                description: 'Show quick resize options (25%, 50%, 75%, 100%) in the right-click context menu',
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
                    const prepared = await detectAndPrepareImage();
                    if (!prepared) return;

                    const { fullContext, replacementRange } = prepared;

                    // Show dialog
                    const defaultResizeMode = (await joplin.settings.value('imageResize.defaultResizeMode')) as
                        | 'percentage'
                        | 'absolute';

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
                        await replaceImageInEditor(newSyntax, replacementRange);

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

        // Quick resize command: 100% (Removes custom size by converting back to markdown)
        await joplin.commands.register({
            name: 'resize100',
            label: 'Resize 100%',
            execute: async () => {
                try {
                    const prepared = await detectAndPrepareImage();
                    if (!prepared) return;

                    const { fullContext, replacementRange } = prepared;

                    // Convert to markdown (original size)
                    const newSyntax = buildNewSyntax(fullContext, {
                        targetSyntax: 'markdown',
                        altText: fullContext.altText,
                        resizeMode: 'percentage',
                        percentage: 100,
                    });

                    await replaceImageInEditor(newSyntax, replacementRange);

                    await joplin.views.dialogs.showToast({
                        message: 'Custom size removed - converted to Markdown syntax.',
                        type: ToastType.Success,
                    });
                } catch (err) {
                    logger.error('Error:', err);
                    const message = err?.message || 'Unknown error occurred';
                    await joplin.views.dialogs.showToast({
                        message: `Operation failed: ${message}`,
                        type: ToastType.Error,
                    });
                }
            },
        });

        // Quick resize command: 75%
        await joplin.commands.register({
            name: 'resize75',
            label: 'Resize 75%',
            execute: async () => {
                try {
                    const prepared = await detectAndPrepareImage();
                    if (!prepared) return;

                    const { fullContext, replacementRange } = prepared;

                    const newSyntax = buildNewSyntax(fullContext, {
                        targetSyntax: 'html',
                        altText: fullContext.altText,
                        resizeMode: 'percentage',
                        percentage: 75,
                    });

                    await replaceImageInEditor(newSyntax, replacementRange);

                    await joplin.views.dialogs.showToast({
                        message: 'Image resized to 75%.',
                        type: ToastType.Success,
                    });
                } catch (err) {
                    logger.error('Error:', err);
                    const message = err?.message || 'Unknown error occurred';
                    await joplin.views.dialogs.showToast({
                        message: `Operation failed: ${message}`,
                        type: ToastType.Error,
                    });
                }
            },
        });

        // Quick resize command: 50%
        await joplin.commands.register({
            name: 'resize50',
            label: 'Resize 50%',
            execute: async () => {
                try {
                    const prepared = await detectAndPrepareImage();
                    if (!prepared) return;

                    const { fullContext, replacementRange } = prepared;

                    const newSyntax = buildNewSyntax(fullContext, {
                        targetSyntax: 'html',
                        altText: fullContext.altText,
                        resizeMode: 'percentage',
                        percentage: 50,
                    });

                    await replaceImageInEditor(newSyntax, replacementRange);

                    await joplin.views.dialogs.showToast({
                        message: 'Image resized to 50%.',
                        type: ToastType.Success,
                    });
                } catch (err) {
                    logger.error('Error:', err);
                    const message = err?.message || 'Unknown error occurred';
                    await joplin.views.dialogs.showToast({
                        message: `Operation failed: ${message}`,
                        type: ToastType.Error,
                    });
                }
            },
        });

        // Quick resize command: 25%
        await joplin.commands.register({
            name: 'resize25',
            label: 'Resize 25%',
            execute: async () => {
                try {
                    const prepared = await detectAndPrepareImage();
                    if (!prepared) return;

                    const { fullContext, replacementRange } = prepared;

                    const newSyntax = buildNewSyntax(fullContext, {
                        targetSyntax: 'html',
                        altText: fullContext.altText,
                        resizeMode: 'percentage',
                        percentage: 25,
                    });

                    await replaceImageInEditor(newSyntax, replacementRange);

                    await joplin.views.dialogs.showToast({
                        message: 'Image resized to 25%.',
                        type: ToastType.Success,
                    });
                } catch (err) {
                    logger.error('Error:', err);
                    const message = err?.message || 'Unknown error occurred';
                    await joplin.views.dialogs.showToast({
                        message: `Operation failed: ${message}`,
                        type: ToastType.Error,
                    });
                }
            },
        });

        // Create submenu in Edit menu
        await joplin.views.menus.create(
            'simpleImageResizeMenu',
            'Simple Image Resize',
            [
                { label: 'Resize Image', commandName: 'resizeImage' },
                { label: 'Resize 100%', commandName: 'resize100' },
                { label: 'Resize 75%', commandName: 'resize75' },
                { label: 'Resize 50%', commandName: 'resize50' },
                { label: 'Resize 25%', commandName: 'resize25' },
            ],
            MenuItemLocation.Edit
        );

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
                    const showQuickResize = await joplin.settings.value('imageResize.showQuickResizeInContextMenu');
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
    },
});
